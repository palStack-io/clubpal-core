import { useNavigate } from 'react-router-dom'

const GRADIENTS = {
  rose:   'linear-gradient(120deg, #f43f5e 0%, #6366f1 100%)',
  purple: 'linear-gradient(120deg, #a855f7 0%, #6366f1 100%)',
  warm:   'linear-gradient(120deg, #f59e0b 0%, #f43f5e 100%)',
}

function fmtDate(dt) {
  if (!dt) return null
  try {
    return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return null }
}

function daysToGo(dt) {
  if (!dt) return null
  const diff = Math.ceil((new Date(dt) - new Date()) / 86400000)
  if (Number.isNaN(diff)) return null
  return diff
}

function Countdown({ dt }) {
  const days = daysToGo(dt)
  if (days == null) return null
  const label = days <= 0 ? 'Today' : String(days)
  const sub = days <= 0 ? 'Happening now' : days === 1 ? 'day to go' : 'days to go'
  return (
    <div className="cp-hero-countdown">
      <b>{label}</b>
      <small>{sub}</small>
    </div>
  )
}

/* ---- Event slide ---- */
function EventSlide({ event }) {
  const navigate = useNavigate()
  const img = event.cover_url || event.banner_url
  const bg = img
    ? { backgroundImage: `linear-gradient(105deg, rgba(8,6,14,0.4), rgba(8,6,14,0.1)), url(${img})` }
    : { backgroundImage: GRADIENTS.rose }

  return (
    <div
      className="cp-hero-slide"
      style={bg}
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/events/${event.id}`)}
      onKeyDown={e => { if (e.key === 'Enter') navigate(`/events/${event.id}`) }}
    >
      <div className="cp-hero-scrim" />
      <div className="cp-hero-body">
        <div style={{ minWidth: 0 }}>
          <span className="cp-hero-badge">Next Event</span>
          <h2 className="cp-hero-title">{event.title}</h2>
          <div className="cp-hero-meta">
            {event.scheduled_date && <span>📅 {fmtDate(event.scheduled_date)}</span>}
            {event.location && <span>📍 {event.location}</span>}
          </div>
        </div>
        <Countdown dt={event.scheduled_date} />
      </div>
    </div>
  )
}

/* ---- Empty-state fallback slide (no upcoming events) ---- */
function EmptySlide({ title, subtitle }) {
  return (
    <div className="cp-hero-slide" style={{ backgroundImage: GRADIENTS.warm }}>
      <div className="cp-hero-scrim" />
      <div className="cp-hero-body">
        <div style={{ minWidth: 0 }}>
          <span className="cp-hero-badge">Your Dashboard</span>
          <h2 className="cp-hero-title">{title}</h2>
          <div className="cp-hero-meta"><span>{subtitle}</span></div>
        </div>
      </div>
    </div>
  )
}

export default function HeroSlide({ slide }) {
  if (slide.kind === 'event') return <EventSlide event={slide.event} />
  return <EmptySlide title={slide.title} subtitle={slide.subtitle} />
}
