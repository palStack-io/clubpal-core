import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppShell from '../../components/shell/AppShell'
import EventHeroCard from '../../components/events/EventHeroCard'
import RatingCard from '../../components/events/RatingCard'
import AttendanceCard from '../../components/events/AttendanceCard'
import PhotoGalleryCard from '../../components/events/PhotoGalleryCard'
import CommentsCard from '../../components/events/CommentsCard'
import EventMetaCard from '../../components/events/EventMetaCard'
import EditEventModal from '../../components/modals/EditEventModal'
import AnimatedBackground from '../../components/ui/AnimatedBackground'
import { eventsApi } from '../../api/events'
import { ratingsClient, gatewayClient } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'

async function enrichWithProfiles(items, uidField) {
  if (!items?.length) return items || []
  const fn = typeof uidField === 'function' ? uidField : (item => item[uidField])
  const uids = [...new Set(items.map(fn).filter(Boolean))]
  if (!uids.length) return items
  const profiles = await Promise.all(
    uids.map(uid => gatewayClient.get(`/users/${uid}/profile`).then(r => r.data).catch(() => ({ id: uid })))
  )
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
  return items.map(item => {
    const { id: _pid, ...profileFields } = profileMap[fn(item)] || {}
    return { ...item, ...profileFields }
  })
}

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [event, setEvent] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [ratings, setRatings] = useState([])
  const [photos, setPhotos] = useState([])
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [showEditEvent, setShowEditEvent] = useState(false)

  const fetchAll = async () => {
    try {
      const [ev, att, rat, ph, cmt] = await Promise.all([
        eventsApi.getById(id),
        eventsApi.getAttendees(id),
        ratingsClient.get(`/events/${id}/ratings`).then((r) => r.data).catch(() => []),
        eventsApi.getPhotos(id).catch(() => []),
        eventsApi.getComments(id).catch(() => []),
      ])
      setEvent(ev)
      setPhotos(Array.isArray(ph) ? ph : ph?.photos || [])

      const rawAttendees = Array.isArray(att) ? att : att?.attendees || []
      setAttendees(await enrichWithProfiles(rawAttendees, 'user_id'))

      const rawComments = Array.isArray(cmt) ? cmt : cmt?.comments || []
      setComments(await enrichWithProfiles(rawComments, 'user_id'))

      const rawRatings = Array.isArray(rat) ? rat : rat?.ratings || []
      const enrichedRatings = await enrichWithProfiles(rawRatings, r => r.reviewer_id || r.rater_id || r.user_id)
      setRatings(enrichedRatings.map(r => ({
        ...r,
        reviewer_name: r.reviewer_name || r.full_name,
        reviewer_avatar: r.reviewer_avatar || r.avatar_url,
      })))
    } catch {
      // silently ignore top-level failures; individual catches already handle per-resource errors
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [id])

  const handleRsvp = async (status) => {
    if (status === 'rate') {
      navigate(`/events/${id}/rate`)
      return
    }
    setRsvpLoading(true)
    try {
      await eventsApi.rsvp(id, user.id, status)
      fetchAll()
    } catch {
      // ignore
    } finally {
      setRsvpLoading(false)
    }
  }

  const handlePhotoUpload = async (files) => {
    for (const file of files) {
      try {
        const { upload_url, public_url, object_name } = await eventsApi.getPhotoUploadUrl(
          id,
          file.name,
          file.type
        )
        const res = await fetch(upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
        await eventsApi.confirmPhoto(id, { object_key: object_name, public_url })
      } catch {
        // continue uploading remaining files
      }
    }
    fetchAll()
  }

  const handlePhotoDelete = async (photoId) => {
    try {
      await eventsApi.deletePhoto(id, photoId)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    } catch {
      // ignore
    }
  }

  const handleAddComment = async (content) => {
    try {
      await eventsApi.addComment(id, user?.id, content)
      fetchAll()
    } catch {
      // ignore
    }
  }

  const handleDeleteComment = async (commentId) => {
    try {
      await eventsApi.deleteComment(id, commentId)
      fetchAll()
    } catch {
      // ignore
    }
  }

  const handleCancelEvent = async (eventId) => {
    try {
      await eventsApi.delete(eventId)
      navigate('/events')
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <AppShell activeRoute="/events">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)', fontSize: '14px' }}>
          Loading event…
        </div>
      </AppShell>
    )
  }

  if (!event) {
    return (
      <AppShell activeRoute="/events">
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)', fontSize: '14px' }}>
          Event not found.
        </div>
      </AppShell>
    )
  }

  const isHost = user?.id != null && event.host_user_id != null && String(user.id) === String(event.host_user_id)
  const isScheduled = event.status === 'scheduled' || event.status === 'in_progress'
  const myAttendee = attendees.find(a => String(a.user_id) === String(user?.id))

  let statusLabel = 'Scheduled'
  if (event.status === 'completed')    statusLabel = 'Completed'
  else if (event.status === 'cancelled')   statusLabel = 'Cancelled'
  else if (event.status === 'in_progress') statusLabel = 'In Progress'

  const avgRating = event.avg_rating ? Number(event.avg_rating).toFixed(1) : '—'

  const stats = [
    { label: 'Attendees',   value: attendees.length || event.attendee_count || 0 },
    { label: 'Avg Rating ★', value: avgRating },
    { label: 'Status',      value: statusLabel },
  ]

  const heroActions = [
    ...(event.status === 'scheduled' && isHost ? [{ label: '✏️ Edit', onClick: () => setShowEditEvent(true) }] : []),
    ...(event.status === 'completed' ? [{ label: '⭐ Rate', onClick: () => handleRsvp('rate') }] : []),
    ...(isScheduled && myAttendee?.status !== 'going' ? [{ label: '✓ RSVP', onClick: () => handleRsvp('going'), loading: rsvpLoading }] : []),
  ]

  return (
    <AppShell activeRoute="/events">
      {/* Full-width hero banner with controls embedded */}
      <EventHeroCard
        event={event}
        attendees={attendees}
        onBack={() => navigate(-1)}
        actions={heroActions}
      />

      {/* Floating stats — translateY to overlap hero bottom */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          padding: '0 20px',
          transform: 'translateY(-28px)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {stats.map(stat => (
          <div
            key={stat.label}
            style={{
              background: 'var(--s2)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '14px',
              padding: '14px 10px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--t1)', letterSpacing: '-1px', lineHeight: 1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '5px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ padding: '0 24px 24px', marginTop: '-8px', position: 'relative' }}>
        {event.bg_scope === 'full' && event.bg_type && event.bg_type !== 'default' && (
          <AnimatedBackground bgType={event.bg_type} bgValue={event.bg_value} style={{ borderRadius: 0 }} />
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.7fr 1fr',
            gap: '14px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <RatingCard
              ratings={ratings}
              eventStatus={event.status}
              currentUserId={user?.id}
              eventId={id}
              onAddRating={() => navigate(`/events/${id}/rate`)}
            />
            <PhotoGalleryCard
              photos={photos}
              currentUserId={user?.id}
              onUpload={handlePhotoUpload}
              onDelete={handlePhotoDelete}
            />
            <CommentsCard
              eventId={id}
              comments={comments}
              currentUser={user}
              onAdd={handleAddComment}
              onDelete={handleDeleteComment}
            />
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <AttendanceCard
              attendees={attendees}
              currentUser={user}
              eventId={id}
              eventStatus={event.status}
              onRsvpChange={handleRsvp}
              rsvpDeadline={event.rsvp_deadline}
              maxAttendees={event.max_attendees}
            />
            <EventMetaCard
              event={event}
              groupName={event.group_name || ''}
            />
          </div>
        </div>
      </div>

      <EditEventModal
        isOpen={showEditEvent}
        onClose={() => setShowEditEvent(false)}
        event={event}
        onSaved={() => { setShowEditEvent(false); fetchAll() }}
        onCancel={handleCancelEvent}
      />
    </AppShell>
  )
}
