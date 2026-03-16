import { useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import BillSplitSection from '../billsplit/BillSplitSection'

export default function BillSplitModal({ isOpen, onClose, event, attendees, currentUser }) {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--s2)',
          border: '1px solid var(--glass)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalIn 0.15s ease',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '20px 24px 16px', borderBottom: '1px solid var(--glass)' }}>
          <h2 style={{ flex: 1, fontSize: '18px', fontWeight: 800, color: 'var(--t1)', margin: 0 }}>
            💳 Split the Bill
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: '2px' }}
          >
            <XMarkIcon style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', padding: '20px 24px 24px' }}>
          <BillSplitSection event={event} attendees={attendees} currentUser={currentUser} />
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
