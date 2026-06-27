import { useReleaseBanner } from '../../hooks/useReleaseBanner'
import Modal from './Modal'

export default function ReleaseBanner() {
  const { release, visible, dismiss } = useReleaseBanner()

  if (!visible || !release) return null

  return (
    <Modal
      isOpen={visible}
      onClose={dismiss}
      title={`What's New · v${release.version}`}
      size="md"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {release.title && release.title !== "What's New" && (
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--t2)', fontWeight: 700 }}>
            {release.title}
          </p>
        )}
        {release.items?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {release.items.map((item, i) => (
              <div key={item.text || i} style={{ display: 'flex', gap: '10px', fontSize: '14px', color: 'var(--t2)', lineHeight: 1.45 }}>
                <span style={{ flexShrink: 0 }}>{item.emoji || '•'}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--t2)' }}>
            A new ClubPal update is ready.
          </p>
        )}
      </div>
    </Modal>
  )
}
