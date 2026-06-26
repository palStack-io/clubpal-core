import './inviteMotion.css'

export default function InviteMotion({ type, accent }) {
  if (!type || type === 'none') return null

  const wrap = { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }

  if (type === 'waves') {
    return (
      <div style={wrap}>
        <div style={{ position: 'absolute', left: '-25%', right: '-25%', bottom: 24, height: 130, borderRadius: '50%', background: `radial-gradient(ellipse, ${accent}55, transparent 66%)`, animation: 'inviteWave 6s ease-in-out infinite alternate' }} />
      </div>
    )
  }

  if (type === 'aurora' || type === 'spotlight') {
    return (
      <div style={wrap}>
        <div style={{
          position: 'absolute', inset: '-22%',
          background: type === 'aurora'
            ? `linear-gradient(115deg, transparent 4%, ${accent}aa 28%, rgba(255,255,255,0.42) 45%, #14b8a699 62%, transparent 88%)`
            : 'linear-gradient(105deg, transparent 22%, rgba(255,255,255,0.66) 48%, transparent 72%)',
          filter: type === 'aurora' ? 'blur(12px)' : 'blur(5px)',
          mixBlendMode: 'screen',
          animation: 'inviteSweep 4.6s ease-in-out infinite alternate',
        }} />
        {type === 'aurora' && (
          <div style={{
            position: 'absolute', inset: '-18%',
            background: `linear-gradient(65deg, transparent 15%, #6366f188 42%, ${accent}77 58%, transparent 82%)`,
            filter: 'blur(22px)', mixBlendMode: 'screen',
            animation: 'inviteSweep 6.2s ease-in-out infinite alternate-reverse',
          }} />
        )}
        {type === 'spotlight' && (
          <div style={{
            position: 'absolute', inset: '-16%',
            background: `radial-gradient(circle at 50% 50%, ${accent}66, transparent 45%)`,
            filter: 'blur(12px)', opacity: 0.9,
          }} />
        )}
      </div>
    )
  }

  if (type === 'fireworks') {
    return (
      <div style={wrap}>
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} style={{
            position: 'absolute',
            left: `${10 + i * 13}%`, top: `${12 + (i % 4) * 16}%`,
            width: 56, height: 56, borderRadius: '50%',
            border: `2px solid ${i % 2 ? '#fff' : accent}`,
            boxShadow: `0 0 22px ${accent}88, inset 0 0 16px ${accent}55`,
            opacity: 0,
            animation: `inviteBurst ${1.9 + i * 0.12}s ease-out infinite`,
            animationDelay: `${i * 0.26}s`,
          }} />
        ))}
      </div>
    )
  }

  // confetti / sparkles / fireflies (default)
  return (
    <div style={wrap}>
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} style={{
          position: 'absolute',
          left: `${7 + i * 8}%`, top: `${12 + (i % 4) * 15}%`,
          width:  type === 'confetti' ? 8 : 6,
          height: type === 'confetti' ? 15 : 6,
          borderRadius: type === 'confetti' ? 2 : '50%',
          background: i % 2 ? '#fff' : accent,
          opacity: 0.62,
          animation: `${type === 'sparkles' || type === 'fireflies' ? 'inviteGlow' : 'inviteFloat'} ${2.6 + i * 0.18}s ease-in-out infinite`,
          animationDelay: `${i * 0.16}s`,
        }} />
      ))}
    </div>
  )
}
