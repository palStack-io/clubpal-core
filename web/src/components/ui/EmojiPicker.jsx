import { useState, useRef, useEffect } from 'react'

const CATEGORIES = {
  'Smileys': ['😀','😂','🥹','😍','🤩','😎','🥳','😤','🤯','😱','🥺','😈','💀','🤡','👻','👽','🤖','💩','🙈','🙉'],
  'Gestures': ['👍','👎','👏','🙌','🤝','✌️','🤞','🤟','🤘','👊','✊','🫶','❤️‍🔥','💪','🫡','🤙','👋','🖐️','✋','🫰'],
  'People': ['💃','🕺','🧑‍🤝‍🧑','👫','👯','🏃','🚶','🧘','🏄','🏊','⛷️','🏋️','🚴','🤸','🎭','👑','🎩','🧢','👓','🎒'],
  'Nature': ['🌸','🌺','🌻','🌹','🌈','☀️','🌙','⭐','✨','🔥','💧','🌊','🍀','🌿','🌴','🎄','🐶','🐱','🐻','🦋'],
  'Food': ['🍕','🍔','🍟','🌮','🍣','🍜','🍝','🥗','🍩','🍰','🎂','🍫','🍿','☕','🍷','🍺','🥂','🧃','🍹','🥤'],
  'Activities': ['⚽','🏀','🏈','⚾','🎾','🏐','🎱','🎮','🎲','🎯','🎪','🎨','🎬','🎤','🎧','🎸','🎹','🎵','🎶','🏆'],
  'Travel': ['🚗','🚀','✈️','🚢','🏠','🏰','🗼','🎡','🎢','🏖️','🏔️','⛺','🌅','🌄','🗺️','🧭','🎪','🏟️','🛤️','🌉'],
  'Symbols': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💯','💢','💥','💫','💬','👀','🎉','🎊','🏅','🥇','✅'],
}

export default function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState('Smileys')
  const ref = useRef()

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose?.()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: '44px',
        left: 0,
        zIndex: 50,
        width: '300px',
        background: 'var(--s1)',
        border: '1px solid var(--glass)',
        borderRadius: '14px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      {/* Category tabs */}
      <div style={{
        display: 'flex',
        gap: '2px',
        padding: '8px 8px 0',
        borderBottom: '1px solid var(--glass)',
        overflowX: 'auto',
      }}>
        {Object.keys(CATEGORIES).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '5px 8px',
              borderRadius: '6px 6px 0 0',
              border: 'none',
              fontSize: '10px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: activeCategory === cat ? 'var(--s3)' : 'transparent',
              color: activeCategory === cat ? 'var(--t1)' : 'var(--t4)',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gap: '2px',
        padding: '8px',
        maxHeight: '200px',
        overflowY: 'auto',
      }}>
        {CATEGORIES[activeCategory].map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect?.(emoji); onClose?.() }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              padding: '4px',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'background 0.1s',
              lineHeight: 1,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--s3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
