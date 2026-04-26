export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="mb-4 p-4 rounded-full" style={{ background: 'var(--s3)' }}>
          <Icon className="h-8 w-8" style={{ color: 'var(--t3)' }} />
        </div>
      )}
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--t1)' }}>{title}</h3>
      {description && (
        <p className="text-sm max-w-sm mb-6" style={{ color: 'var(--t2)' }}>{description}</p>
      )}
      {action && action}
    </div>
  )
}
