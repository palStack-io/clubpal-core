import { useState, useEffect } from 'react'
import { billSplitApi } from '../../api/billSplit'
import ReceiptUpload from './ReceiptUpload'
import OCRReview from './OCRReview'
import AssignItems from './AssignItems'
import ConfirmAndSend from './ConfirmAndSend'
import SettlementTracker from './SettlementTracker'
import ClaimingStatus from './ClaimingStatus'
import PastBillsAccordion from './PastBillsAccordion'
import Card from '../ui/Card'
import Button from '../ui/Button'

export default function BillSplitSection({ event, attendees, currentUser }) {
  // step: 'loading' | 'cta' | 'upload' | 'review' | 'choose-flow' | 'assign' | 'confirm' | 'claiming' | 'settled'
  const [step, setStep] = useState('loading')
  const [splits, setSplits] = useState([])   // all rounds for this event
  const [ocrResult, setOcrResult] = useState(null)
  const [items, setItems] = useState([])
  const [tax, setTax] = useState(0)
  const [tip, setTip] = useState(0)
  const [paymentNote, setPaymentNote] = useState('')
  const [claimUrl, setClaimUrl] = useState('')
  const [claimMode, setClaimMode] = useState(false)
  const [guests, setGuests] = useState([])

  // Derived — latest round is last in ASC-ordered array
  const activeSplit = splits.length > 0 ? splits[splits.length - 1] : null
  const pastSplits = splits.length > 1 ? splits.slice(0, -1) : []

  const loadSplits = async () => {
    try {
      const data = await billSplitApi.getByEvent(event.id)
      const arr = Array.isArray(data) ? data : (data ? [data] : [])
      setSplits(arr)
      return arr
    } catch {
      setSplits([])
      return []
    }
  }

  useEffect(() => {
    loadSplits().then(arr => {
      const latest = arr.length > 0 ? arr[arr.length - 1] : null
      if (!latest) {
        setStep('cta')
      } else if (latest.status === 'claiming') {
        setClaimUrl(`${window.location.origin}/claim/${latest.claim_token || ''}`)
        setStep('claiming')
      } else {
        setStep('settled')
      }
    })
  }, [event.id])

  const goingAttendees = attendees.filter(a => a.rsvp_status === 'going' || a.status === 'going')

  const handleOCRComplete = (result) => {
    setOcrResult(result)
    const draftItems = result.items.map((item, i) => ({ ...item, id: `ocr-${i}`, assigned_to: [] }))
    setItems(draftItems)
    setTax(result.tax)
    setTip(result.tip)
    setStep('review')
  }

  const handleManualEntry = () => {
    setItems([])
    setTax(0)
    setTip(0)
    setOcrResult(null)
    setStep('review')
  }

  const handleAddAnother = () => {
    setItems([])
    setTax(0)
    setTip(0)
    setOcrResult(null)
    setPaymentNote('')
    setClaimMode(false)
    setGuests([])
    setStep('upload')
  }

  const handleSplitComplete = async (createdSplit) => {
    const arr = await loadSplits()
    const latest = arr[arr.length - 1]
    if (latest?.status === 'claiming') {
      setClaimUrl(`${window.location.origin}/claim/${latest.claim_token || ''}`)
      setStep('claiming')
    } else {
      setStep('settled')
    }
  }

  if (step === 'loading') return (
    <div className="flex justify-center py-8">
      <div className="animate-spin h-6 w-6 border-2 border-rose-400 border-t-transparent rounded-full" />
    </div>
  )

  if (step === 'settled' && activeSplit) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SettlementTracker
        split={activeSplit}
        currentUser={currentUser}
        onRefresh={loadSplits}
        onAddAnother={handleAddAnother}
      />
      {pastSplits.length > 0 && (
        <PastBillsAccordion splits={pastSplits} currentUser={currentUser} />
      )}
    </div>
  )

  if (step === 'cta') return (
    <Card>
      <Card.Body>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[var(--t1)]">Split the Bill</h3>
            <p className="text-sm text-[var(--t2)] mt-1">Scan the receipt and split with your group</p>
          </div>
          <Button variant="primary" onClick={() => setStep('upload')}>
            Split Bill 💳
          </Button>
        </div>
      </Card.Body>
    </Card>
  )

  if (step === 'upload') return (
    <ReceiptUpload
      eventId={event.id}
      onOCRComplete={handleOCRComplete}
      onManualEntry={handleManualEntry}
      onBack={() => setStep(activeSplit ? 'settled' : 'cta')}
    />
  )

  if (step === 'review') return (
    <OCRReview
      items={items}
      tax={tax}
      tip={tip}
      confidence={ocrResult?.confidence}
      onChange={(newItems, newTax, newTip) => { setItems(newItems); setTax(newTax); setTip(newTip) }}
      onNext={() => setStep('choose-flow')}
      onBack={() => setStep('upload')}
    />
  )

  if (step === 'choose-flow') return (
    <Card>
      <Card.Body>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>How should items be assigned?</h3>
        <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 20 }}>
          You can assign items yourself, or send a link for everyone to tap what they ordered.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button variant="primary" onClick={() => { setClaimMode(false); setStep('assign') }}>
            📝 I'll assign items myself
          </Button>
          <Button
            variant="ghost"
            onClick={() => { setClaimMode(true); setStep('confirm') }}
          >
            🔗 Send link for members to claim
          </Button>
        </div>
        <button
          onClick={() => setStep('review')}
          style={{ marginTop: 12, fontSize: 13, color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}
        >
          ← Back
        </button>
      </Card.Body>
    </Card>
  )

  if (step === 'assign') return (
    <AssignItems
      items={items}
      tax={tax}
      tip={tip}
      attendees={goingAttendees}
      currentUser={currentUser}
      onChange={setItems}
      guests={guests}
      onGuestsChange={setGuests}
      onNext={() => setStep('confirm')}
      onBack={() => setStep('choose-flow')}
    />
  )

  if (step === 'confirm') return (
    <ConfirmAndSend
      event={event}
      items={items}
      tax={tax}
      tip={tip}
      attendees={goingAttendees}
      guests={guests}
      currentUser={currentUser}
      paymentNote={paymentNote}
      onPaymentNoteChange={setPaymentNote}
      claimMode={claimMode}
      onBack={() => claimMode ? setStep('choose-flow') : setStep('assign')}
      onClaimStarted={async (createdSplit, url) => {
        await loadSplits()
        setClaimUrl(url)
        setStep('claiming')
      }}
      onComplete={handleSplitComplete}
    />
  )

  if (step === 'claiming' && activeSplit) {
    const isPayer = activeSplit.paid_by_user_id === currentUser?.id
    if (!isPayer) {
      const token = activeSplit.claim_token
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card>
            <Card.Body>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>💸</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 8 }}>
                  Pick your items
                </h3>
                <p style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 20 }}>
                  <strong>{activeSplit.paid_by_name}</strong> is splitting the bill for this event.
                  Tap the button below to claim what you ordered.
                </p>
                {token ? (
                  <Button variant="primary" onClick={() => window.location.href = `/claim/${token}`}>
                    Claim My Items →
                  </Button>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--t3)' }}>Claim link loading…</p>
                )}
              </div>
            </Card.Body>
          </Card>
          {pastSplits.length > 0 && (
            <PastBillsAccordion splits={pastSplits} currentUser={currentUser} />
          )}
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ClaimingStatus
          splitId={activeSplit.id}
          claimUrl={claimUrl}
          currentUser={currentUser}
          onFinalize={async (updatedSplit) => {
            await loadSplits()
            setStep('settled')
          }}
        />
        {pastSplits.length > 0 && (
          <PastBillsAccordion splits={pastSplits} currentUser={currentUser} />
        )}
      </div>
    )
  }

  return null
}
