import { useState, useRef } from 'react'
import Card from '../ui/Card'
import Avatar from '../ui/Avatar'
import EmojiPicker from '../ui/EmojiPicker'
import GifPicker from '../ui/GifPicker'
import { gatewayClient } from '../../api/client'

function toUTC(str) {
  if (!str) return str
  return /Z$|[+-]\d{2}:?\d{2}$/.test(str) ? str : `${str}Z`
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(toUTC(dateStr))) / 1000
  const m = Math.floor(diff / 60)
  if (m < 1) return 'just now'
  if (diff < 3600) return `${m}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/** Render comment content — handles [gif:URL] tokens and @mention highlights */
function renderContent(content) {
  if (!content) return null

  // Split content by tokens: [gif:URL] or @word
  const tokenPattern = /\[gif:(https?:\/\/[^\]]+)\]|@(\w+)/g
  const parts = []
  let lastIndex = 0

  for (const match of content.matchAll(tokenPattern)) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>)
    }

    if (match[0].startsWith('[gif:')) {
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
    } else {
      // @mention highlight
      parts.push(
        <span
          key={`m-${match.index}`}
          style={{
            color: 'var(--rose-soft)',
            background: 'var(--rose-glow)',
            borderRadius: '4px',
            padding: '1px 4px',
            fontWeight: 600,
          }}
        >
          {match[0]}
        </span>
      )
    }

    lastIndex = match.index + match[0].length
  }

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
  members = [],
  mentionContext,
}) {
  const inputId = eventId || groupId
  const [input, setInput] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const [mention, setMention] = useState(null) // { query, cursorStart }
  const inputRef = useRef()

  // Members filtered for @autocomplete
  const mentionOptions = mention
    ? members
        .filter(m => {
          const q = mention.query.toLowerCase()
          return (
            !q ||
            (m.username || '').toLowerCase().startsWith(q) ||
            (m.full_name || '').toLowerCase().startsWith(q)
          )
        })
        .slice(0, 5)
    : []

  const handleInputChange = (e) => {
    const val = e.target.value
    setInput(val)
    const cursor = e.target.selectionStart
    const before = val.slice(0, cursor)
    const atMatch = before.match(/@(\w*)$/)
    if (atMatch) {
      setMention({ query: atMatch[1], cursorStart: cursor - atMatch[0].length })
    } else {
      setMention(null)
    }
  }

  const selectMention = (member) => {
    const username = member.username || (member.full_name || '').split(' ')[0]?.toLowerCase() || 'user'
    const cursor = inputRef.current?.selectionStart ?? input.length
    const before = input.slice(0, mention.cursorStart) + `@${username} `
    const after = input.slice(cursor)
    const newVal = before + after
    setInput(newVal)
    setMention(null)
    setTimeout(() => {
      inputRef.current?.focus()
      const pos = before.length
      inputRef.current?.setSelectionRange(pos, pos)
    }, 0)
  }

  const fireMentionNotifications = (content) => {
    if (!mentionContext || members.length === 0) return
    const matches = [...content.matchAll(/@(\w+)/g)]
    if (!matches.length) return
    const mentionedUsernames = matches.map(m => m[1].toLowerCase())
    const mentionedIds = members
      .filter(m => mentionedUsernames.includes((m.username || '').toLowerCase()))
      .map(m => m.user_id)
      .filter(Boolean)
    if (!mentionedIds.length) return
    gatewayClient
      .post('/comments/mention', {
        mentioned_user_ids: mentionedIds,
        link_type: mentionContext.linkType,
        link_id: mentionContext.linkId,
        comment_preview: content.slice(0, 100),
      })
      .catch(() => {})
  }

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    onAdd && onAdd(trimmed)
    fireMentionNotifications(trimmed)
    setInput('')
    setMention(null)
  }

  const handleKeyDown = (e) => {
    if (mention && mentionOptions.length > 0 && e.key === 'Enter') {
      e.preventDefault()
      selectMention(mentionOptions[0])
      return
    }
    if (mention && e.key === 'Escape') {
      setMention(null)
      return
    }
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
    setInput(prev => (prev.trim() ? `${prev} ${gifContent}` : gifContent))
    setShowGif(false)
    setTimeout(() => inputRef.current?.focus(), 0)
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
          {/* @mention autocomplete dropdown — floats above the input row */}
          {mention && mentionOptions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                marginBottom: '6px',
                background: 'var(--s2)',
                border: '1px solid var(--s4)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 -8px 24px rgba(0,0,0,0.4)',
                zIndex: 20,
              }}
            >
              {mentionOptions.map((m, i) => (
                <div
                  key={m.user_id ?? i}
                  onMouseDown={(e) => { e.preventDefault(); selectMention(m) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: i < mentionOptions.length - 1 ? '1px solid var(--glass)' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Avatar user={m} size="sm" />
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--t1)' }}>
                      {m.full_name || m.username}
                    </div>
                    {m.username && (
                      <div style={{ fontSize: '10px', color: 'var(--t3)' }}>@{m.username}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

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
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment… type @ to mention"
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
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--glass)'
              // Delay so mouseDown on mention option fires before blur dismisses dropdown
              setTimeout(() => setMention(null), 150)
            }}
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
