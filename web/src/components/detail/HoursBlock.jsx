/**
 * Hours list with today's entry highlighted in green.
 * Google's weekdayDescriptions starts at Monday (index 0).
 * JS getDay() returns 0=Sun … 6=Sat, so todayIdx = (getDay() + 6) % 7.
 */
export default function HoursBlock({ hours }) {
  if (!hours?.weekdayDescriptions?.length) return null

  // todayIdx: Mon=0 … Sun=6 (matching Google's array order)
  const todayIdx = (new Date().getDay() + 6) % 7

  return (
    <div
      style={{
        background: 'var(--s2)',
        border: '1px solid var(--glass)',
        borderRadius: '14px',
        padding: '16px',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--t3)',
          textTransform: 'uppercase',
          letterSpacing: '0.7px',
          marginBottom: '10px',
        }}
      >
        Hours
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {hours.weekdayDescriptions.map((day, i) => {
          const isToday = i === todayIdx
          return (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: isToday ? 700 : 400,
                color: isToday ? 'var(--green)' : 'var(--t2)',
                padding: isToday ? '5px 8px' : '1px 0',
                borderRadius: isToday ? '8px' : 0,
                background: isToday ? 'rgba(34,211,160,0.07)' : 'transparent',
              }}
            >
              {isToday && (
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    background: 'var(--green)',
                    color: '#000',
                    padding: '1px 5px',
                    borderRadius: '100px',
                    letterSpacing: '0.3px',
                    flexShrink: 0,
                  }}
                >
                  Today
                </span>
              )}
              {day}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
