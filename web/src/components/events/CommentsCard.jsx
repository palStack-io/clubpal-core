import { useState, useRef } from 'react'
import Card from '../ui/Card'
import Avatar from '../ui/Avatar'
import EmojiPicker from '../ui/EmojiPicker'
import GifPicker from '../ui/GifPicker'

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/** Render comment content — detects [gif:URL] patterns and renders inline images */
function renderContent(content) {
  if (!content) return null

  const gifPattern = /\[gif:(https?:\/\/[^\]]+)\]/g
  const parts = []
  let lastIndex = 0
  let match

  while ((match = gifPattern.exec(content)) !== null) {
    // Text before the gif
    if (match.index > lastIndex) {
      parts.push(
        <span key={`t-${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>
      )
    }
    // The gif image
    parts.push(
      <img
        key={`g-${match.index}`}
        src={match[1]}
        alt="GIF"
        style={{
          display: 'block',
          maxWidth: '200px',
          maxHeight: '150px',
          borderRadius: '8px',
          marginTop: '4px',
        }}
      />
    )
    lastIndex = match.index + match[0].length
  }

  // Remaining text
  if (lastIndex < content.length) {
    parts.push(<span key={`t-${lastIndex}`}>{content.slice(lastIndex)}</span>)
  }

  return parts.length > 0 ? parts : content
}

function CommentItem({ comment, currentUser, onDelete }) {
  const canDelete =
    currentUser &&
    (String(comment.user_id) === String(currentUser.id) || currentUser.is_admin)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '10px',
        padding: '10px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <Avatar
        user={{
          full_name: comment.author_name || comment.full_name,
          username: comment.username,
          avatar_url: comment.avatar_url,
        }}
        size="sm"
      />
      <div style={{ flex: 1 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: 'var(--t1)' }}>
            {comment.author_name || comment.full_name || comment.username || 'Unknown'}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--t4)' }}>
            {comment.created_at ? timeAgo(comment.created_at) : ''}
          </span>
          {canDelete && (
            <button
              onClick={() => onDelete && onDelete(comment.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--t4)',
                fontSize: '10px',
                cursor: 'pointer',
                marginLeft: '8px',
                padding: '0 2px',
              }}
            >
              ×
            </button>
          )}
        </div>
        {/* Bubble */}
        <span
          style={{
            display: 'block',
            fontSize: '12px',
            color: 'var(--t2)',
            lineHeight: 1.6,
            background: 'var(--s3)',
            padding: '10px 12px',
            borderRadius: '0 12px 12px 12px',
            marginTop: '4px',
          }}
        >
          {renderContent(comment.content)}
        </span>
      </div>
    </div>
  )
}

export default function CommentsCard({
  eventId,
  groupId,
  comments = [],
  currentUser,
  onAdd,
  onDelete,
  loading,
}) {
  const inputId = eventId || groupId
  const [input, setInput] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const inputRef = useRef()

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    onAdd && onAdd(trimmed)
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  const handleEmojiSelect = (emoji) => {
    const el = inputRef.current
    if (el) {
      const start = el.selectionStart || input.length
      const end = el.selectionEnd || input.length
      const newValue = input.slice(0, start) + emoji + input.slice(end)
      setInput(newValue)
      // Focus and set cursor after emoji
      setTimeout(() => {
        el.focus()
        el.setSelectionRange(start + emoji.length, start + emoji.length)
      }, 0)
    } else {
      setInput(prev => prev + emoji)
    }
    setShowEmoji(false)
  }

  const handleGifSelect = (gifContent) => {
    onAdd && onAdd(gifContent)
    setShowGif(false)
  }

  return (
    <Card>
      <Card.Header title={`Comments (${comments.length})`} />
      <Card.Body>
        {/* Thread list */}
        {comments.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '28px 0 16px',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '6px' }}>💬</div>
            <div style={{ fontSize: '13px', color: 'var(--t3)', marginBottom: '4px' }}>
              No comments yet
            </div>
            <span
              style={{ fontSize: '12px', color: 'var(--rose-soft)', cursor: 'pointer' }}
              onClick={() => inputRef.current?.focus()}
            >
              Be the first
            </span>
          </div>
        ) : (
          <div>
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                currentUser={currentUser}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}

        {/* Compose row */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            borderTop: '1px solid var(--glass)',
            paddingTop: '12px',
            marginTop: comments.length === 0 ? '0' : '4px',
            position: 'relative',
          }}
        >
          <Avatar
            user={{
              full_name: currentUser?.full_name,
              avatar_url: currentUser?.avatar_url,
            }}
            size="sm"
          />

          {/* Emoji button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowEmoji(v => !v); setShowGif(false) }}
              style={{
                width: '28px',
                height: '28px',
                flexShrink: 0,
                background: showEmoji ? 'var(--s3)' : 'none',
                borderRadius: '6px',
                border: '1px solid var(--glass)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                transition: 'background 0.1s',
              }}
              title="Add emoji"
            >
              😊
            </button>
            {showEmoji && (
              <EmojiPicker
                onSelect={handleEmojiSelect}
                onClose={() => setShowEmoji(false)}
              />
            )}
          </div>

          {/* GIF button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowGif(v => !v); setShowEmoji(false) }}
              style={{
                height: '28px',
                padding: '0 8px',
                flexShrink: 0,
                background: showGif ? 'var(--s3)' : 'none',
                borderRadius: '6px',
                border: '1px solid var(--glass)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--t3)',
                transition: 'background 0.1s',
              }}
              title="Add GIF"
            >
              GIF
            </button>
            {showGif && (
              <GifPicker
                onSelect={handleGifSelect}
                onClose={() => setShowGif(false)}
              />
            )}
          </div>

          <input
            ref={inputRef}
            id={`comment-input-${inputId}`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment…"
            style={{
              flex: 1,
              background: 'var(--s3)',
              border: '1px solid var(--glass)',
              borderRadius: '10px',
              padding: '8px 12px',
              fontSize: '13px',
              color: 'var(--t1)',
              outline: 'none',
              transition: 'border 0.15s',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--rose-border)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--glass)')}
          />
          <button
            onClick={handleSend}
            style={{
              width: '32px',
              height: '32px',
              flexShrink: 0,
              background: 'linear-gradient(135deg, var(--rose-soft), var(--rose))',
              borderRadius: '8px',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
          >
            →
          </button>
        </div>
      </Card.Body>
    </Card>
  )
}
