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
import RateEventModal from '../../components/events/RateEventModal'
import AnimatedBackground from '../../components/ui/AnimatedBackground'
import BillSplitModal from '../../components/modals/BillSplitModal'
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
  const [showRateModal, setShowRateModal] = useState(false)
  const [showBillSplit, setShowBillSplit] = useState(false)

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
  const hostName = attendees.find(a => String(a.user_id) === String(event.host_user_id))?.full_name || null
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
    ...((event.status === 'completed' || (event.scheduled_date && new Date(event.scheduled_date) < new Date())) ? [{ label: '⭐ Rate', onClick: () => setShowRateModal(true) }] : []),
    { label: '💳 Split', onClick: () => setShowBillSplit(true) },
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

      {/* Floating stats */}
      <div className="cp-floating-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {stats.map(stat => (
          <div key={stat.label} className="cp-stat-tile">
            <div className="cp-stat-tile-value">{stat.value}</div>
            <div className="cp-stat-tile-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div style={{ padding: '0 24px 24px', position: 'relative' }}>
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
              scheduledDate={event.scheduled_date}
              currentUserId={user?.id}
              eventId={id}
              onAddRating={() => setShowRateModal(true)}
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
              hostName={hostName}
            />
          </div>
        </div>

      </div>

      <BillSplitModal
        isOpen={showBillSplit}
        onClose={() => setShowBillSplit(false)}
        event={event}
        attendees={attendees}
        currentUser={user}
      />
      <EditEventModal
        isOpen={showEditEvent}
        onClose={() => setShowEditEvent(false)}
        event={event}
        onSaved={() => { setShowEditEvent(false); fetchAll() }}
        onCancel={handleCancelEvent}
      />
      <RateEventModal
        isOpen={showRateModal}
        onClose={() => setShowRateModal(false)}
        event={event}
        attendees={attendees}
        currentUser={user}
        onSubmitted={fetchAll}
      />
    </AppShell>
  )
}
