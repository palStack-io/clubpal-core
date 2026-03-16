import { useState, useEffect } from 'react'
import { billSplitApi } from '../../api/billSplit'
import ReceiptUpload from './ReceiptUpload'
import OCRReview from './OCRReview'
import AssignItems from './AssignItems'
import ConfirmAndSend from './ConfirmAndSend'
import SettlementTracker from './SettlementTracker'
import Card from '../ui/Card'
import Button from '../ui/Button'

export default function BillSplitSection({ event, attendees, currentUser }) {
  // step: 'loading' | 'cta' | 'upload' | 'review' | 'assign' | 'confirm' | 'settled'
  const [step, setStep] = useState('loading')
  const [split, setSplit] = useState(null)
  const [ocrResult, setOcrResult] = useState(null)
  const [items, setItems] = useState([])
  const [tax, setTax] = useState(0)
  const [tip, setTip] = useState(0)
  const [paymentNote, setPaymentNote] = useState('')

  useEffect(() => {
    billSplitApi.getByEvent(event.id)
      .then(data => {
        if (data) { setSplit(data); setStep('settled') }
        else setStep('cta')
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
      onNext={() => setStep('assign')}
      onBack={() => setStep('upload')}
    />
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
      onBack={() => setStep('review')}
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
      onBack={() => setStep('assign')}
      onComplete={(createdSplit) => { setSplit(createdSplit); setStep('settled') }}
    />
  )

  return null
}
