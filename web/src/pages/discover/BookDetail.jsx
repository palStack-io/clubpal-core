import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'
import BackButton from '../../components/ui/BackButton'
import { enrichApi } from '../../api/enrich'
import PickModal from '../../components/discover/PickModal'
import CreatePollModal from '../../components/modals/CreatePollModal'

const ACCENT = '#a855f7'

export default function BookDetail() {
  const { volumeId } = useParams()
  const navigate = useNavigate()
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPick, setShowPick] = useState(false)
  const [showPoll, setShowPoll] = useState(false)

  useEffect(() => {
    enrichApi.getBook(volumeId)
      .then(setBook)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [volumeId])

  if (loading) return (
    <AppShell>
      <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid var(--glass)', borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    </AppShell>
  )

  if (!book) return (
    <AppShell>
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)', paddingTop: '80px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>📚</div>
        <div style={{ fontWeight: 700, color: 'var(--t2)' }}>Book not found</div>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div style={{ padding: '20px' }}>
        <BackButton />

        {/* Cover + title block */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', marginBottom: '20px' }}>
          <div style={{ width: '96px', flexShrink: 0 }}>
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt={book.title}
                style={{ width: '100%', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}
              />
            ) : (
              <div style={{
                width: '96px', aspectRatio: '2/3', background: 'rgba(168,85,247,0.12)',
                borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '32px',
              }}>
                📖
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--t1)', margin: 0, lineHeight: 1.3 }}>
              {book.title}
            </h1>
            {book.authors?.length > 0 && (
              <div style={{ fontSize: '13px', color: 'var(--t3)', marginTop: '4px' }}>
                {book.authors.join(', ')}
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
              {book.rating && (
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>
                  ★ {book.rating.toFixed(1)}
                </span>
              )}
              {book.page_count && (
                <span style={{ fontSize: '12px', color: 'var(--t3)' }}>{book.page_count} pages</span>
              )}
              {book.published_date && (
                <span style={{ fontSize: '12px', color: 'var(--t3)' }}>{book.published_date.slice(0, 4)}</span>
              )}
            </div>
            {book.publisher && (
              <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>{book.publisher}</div>
            )}
          </div>
        </div>

        {/* Description */}
        {book.description && (
          <div style={{
            background: 'var(--s2)', border: '1px solid var(--glass)',
            borderRadius: '14px', padding: '16px', marginBottom: '16px',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
              About
            </div>
            <p style={{ fontSize: '13px', color: 'var(--t2)', lineHeight: 1.6, margin: 0 }}>
              {book.description}
            </p>
          </div>
        )}

        {/* Preview link */}
        {book.preview_link && (
          <div style={{ marginBottom: '16px' }}>
            <a
              href={book.preview_link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '13px', color: ACCENT, textDecoration: 'underline', fontWeight: 600 }}
            >
              Preview on Google Books →
            </a>
          </div>
        )}

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={() => setShowPick(true)}
            style={{
              flex: 1, background: ACCENT, color: '#fff', border: 'none',
              borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Pick This Book
          </button>
          <button
            onClick={() => setShowPoll(true)}
            style={{
              padding: '14px 18px', background: 'var(--s3)', color: 'var(--t2)', border: '1px solid var(--glass)',
              borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            💬 Poll Group
          </button>
        </div>
      </div>

      {showPick && (
        <PickModal title={book.title} location={null} activityType="books" onClose={() => setShowPick(false)} onPollGroup={() => { setShowPick(false); setShowPoll(true) }} />
      )}
      <CreatePollModal isOpen={showPoll} onClose={() => setShowPoll(false)} activityName={book?.title} activityType="books" onCreated={() => setShowPoll(false)} />
    </AppShell>
  )
}
