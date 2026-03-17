import { useState, useEffect } from 'react'
import { billSplitApi } from '../../api/billSplit'
import ReceiptUpload from './ReceiptUpload'
import OCRReview from './OCRReview'
import AssignItems from './AssignItems'
import ConfirmAndSend from './ConfirmAndSend'
import SettlementTracker from './SettlementTracker'
import ClaimingStatus from './ClaimingStatus'
import Card from '../ui/Card'
import Button from '../ui/Button'

export default function BillSplitSection({ event, attendees, currentUser }) {
  // step: 'loading' | 'cta' | 'upload' | 'review' | 'choose-flow' | 'assign' | 'confirm' | 'claiming' | 'settled'
  const [step, setStep] = useState('loading')
  const [split, setSplit] = useState(null)
  const [ocrResult, setOcrResult] = useState(null)
  const [items, setItems] = useState([])
  const [tax, setTax] = useState(0)
  const [tip, setTip] = useState(0)
  const [paymentNote, setPaymentNote] = useState('')
  const [claimUrl, setClaimUrl] = useState('')
  const [claimMode, setClaimMode] = useState(false)

  useEffect(() => {
    billSplitApi.getByEvent(event.id)
      .then(data => {
        if (data) {
          setSplit(data)
          if (data.status === 'claiming') {
            setClaimUrl(`${window.location.origin}/claim/${data.claim_token || ''}`)
            setStep('claiming')
          } else {
            setStep('settled')
          }
        } else {
          setStep('cta')
        }
      })
      .catch(() => setStep('cta'))
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

  if (step === 'loading') return (
    <div className="flex justify-center py-8">
      <div className="animate-spin h-6 w-6 border-2 border-rose-400 border-t-transparent rounded-full" />
    </div>
  )

  if (step === 'settled' && split) return (
    <SettlementTracker
      split={split}
      currentUser={currentUser}
      onRefresh={() => billSplitApi.getByEvent(event.id).then(setSplit)}
    />
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
      onBack={() => setStep('cta')}
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
      currentUser={currentUser}
      paymentNote={paymentNote}
      onPaymentNoteChange={setPaymentNote}
      claimMode={claimMode}
      onBack={() => claimMode ? setStep('choose-flow') : setStep('assign')}
      onClaimStarted={(createdSplit, url) => {
        setSplit(createdSplit)
        setClaimUrl(url)
        setStep('claiming')
      }}
      onComplete={(createdSplit) => { setSplit(createdSplit); setStep('settled') }}
    />
  )

  if (step === 'claiming' && split) return (
    <ClaimingStatus
      splitId={split.id}
      claimUrl={claimUrl}
      currentUser={currentUser}
      onFinalize={(updatedSplit) => { setSplit(updatedSplit); setStep('settled') }}
    />
  )

  return null
}
