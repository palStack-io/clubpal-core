export default function StickerLayer({ stickers = [] }) {
  if (!stickers.length) return null
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {stickers.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${s.x * 100}%`,
            top: `${s.y * 100}%`,
            fontSize: `${1.5 * (s.scale || 1)}rem`,
            transform: `rotate(${s.rotation || 0}deg)`,
            userSelect: 'none',
          }}
        >
          {s.id}
        </span>
      ))}
    </div>
  )
}
