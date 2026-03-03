import { useState } from 'react'
import BaseModal from './BaseModal'
import Button from '../ui/Button'
import { FormGroup, FormInput } from '../ui/Form'

export default function CreateApiKeyModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdKey, setCreatedKey] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const key = await onCreate(name.trim())
      setCreatedKey(key)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(createdKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setName('')
    setCreatedKey(null)
    setCopied(false)
    onClose()
  }

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create API Key"
      footer={
        createdKey ? (
          <Button variant="primary" onClick={handleClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={loading} disabled={!name.trim()}>
              Create Key
            </Button>
          </>
        )
      }
    >
      {createdKey ? (
        <div>
          <p style={{ fontSize: '13px', color: 'var(--t2)', marginBottom: '12px' }}>
            Copy this key now — it won't be shown again.
          </p>
          <div
            style={{
              background: 'var(--s3)',
              border: '1px solid var(--glass)',
              borderRadius: '10px',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: 'var(--rose-soft)',
              wordBreak: 'break-all',
              marginBottom: '10px',
            }}
          >
            {createdKey}
          </div>
          <Button variant="ghost" onClick={handleCopy} style={{ width: '100%' }}>
            {copied ? '✓ Copied!' : 'Copy to Clipboard'}
          </Button>
        </div>
      ) : (
        <FormGroup label="Key Name" required>
          <FormInput
            placeholder="e.g. Home Assistant"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
          />
        </FormGroup>
      )}
    </BaseModal>
  )
}
