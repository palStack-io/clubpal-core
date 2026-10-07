import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg, #08080a)',
        color: 'var(--t1, #fff)',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Something went wrong on our end</h1>
        <p style={{ color: 'var(--t2, #9898b0)', maxWidth: '400px' }}>
          Try refreshing the page, and we'll take it from there.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--rose, #f43f5e)',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}
