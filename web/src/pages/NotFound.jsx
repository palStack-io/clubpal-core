import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="text-center">
        <p className="text-7xl font-bold mb-4" style={{ color: 'var(--rose)' }}>404</p>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--t1)' }}>Page not found</h1>
        <p className="mb-8" style={{ color: 'var(--t2)' }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center px-5 py-2.5 font-medium rounded-lg transition-colors"
          style={{ background: 'var(--rose)', color: '#fff' }}
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
