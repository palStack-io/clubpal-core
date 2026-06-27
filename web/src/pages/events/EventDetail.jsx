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
import AddEventAttendeesModal from '../../components/modals/AddEventAttendeesModal'
import RateEventModal from '../../components/events/RateEventModal'
import AnimatedBackground from '../../components/ui/AnimatedBackground'
import BillSplitModal from '../../components/modals/BillSplitModal'
import BillSplitStatusCard from '../../components/events/BillSplitStatusCard'
import PartyInviteAdminCard from '../../components/events/PartyInviteAdminCard'
import EditPublicInviteModal from '../../components/party/EditPublicInviteModal'
import { eventsApi } from '../../api/events'
import { ratingsClient, gatewayClient, eventsClient } from '../../api/client'
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
  const [partyInvite, setPartyInvite] = useState(null)
  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [showEditEvent, setShowEditEvent] = useState(false)
  const [showEditInvite, setShowEditInvite] = useState(false)
  const [showRateModal, setShowRateModal] = useState(false)
  const [showBillSplit, setShowBillSplit] = useState(false)
  const [showAddAttendees, setShowAddAttendees] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [remindToast, setRemindToast] = useState(null)

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
      const enrichedAttendees = await enrichWithProfiles(rawAttendees, 'user_id')
      setAttendees(enrichedAttendees.filter(a => a.full_name || a.username || a.avatar_url))

      const rawComments = Array.isArray(cmt) ? cmt : cmt?.comments || []
      setComments(await enrichWithProfiles(rawComments, 'user_id'))

      const rawRatings = Array.isArray(rat) ? rat : rat?.ratings || []
      const enrichedRatings = await enrichWithProfiles(rawRatings, r => r.rater_user_id || r.reviewer_id || r.rater_id || r.user_id)
      setRatings(enrichedRatings.map(r => ({
        ...r,
        reviewer_name: r.full_name || r.reviewer_name || r.rater_name,
        reviewer_avatar: r.avatar_url || r.reviewer_avatar || r.rater_avatar,
      })))
    } catch {
      // silently ignore top-level failures; individual catches already handle per-resource errors
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    gatewayClient.get('/users/me/saved', { params: { item_type: 'event' } })
      .then(r => setIsBookmarked((r.data || []).some(s => String(s.item_id) === String(id))))
      .catch(() => setIsBookmarked(false))
    eventsClient.get(`/party-invites/by-event/${id}`)
      .then(r => setPartyInvite({ token: r.data.token, bg_animation: r.data.bg_animation, accent_color: r.data.accent_color, style: r.data.style }))
      .catch(() => {})
  }, [id])

  const toggleBookmark = async () => {
    const next = !isBookmarked
    setIsBookmarked(next)
    try {
      if (next) {
        await gatewayClient.post('/users/me/saved', {
          item_type: 'event',
          item_id: String(id),
          item_name: event?.title || `Event ${id}`,
          item_meta: { subtitle: event?.location || null, photo: event?.cover_image_url || null },
        })
      } else {
        await gatewayClient.delete(`/users/me/saved/event/${id}`)
      }
    } catch {
      setIsBookmarked(!next) // revert on failure
    }
  }

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
  const isCreator = user?.id != null && String(user.id) === String(event.created_by ?? event.host_user_id)

  const handleRsvpReminder = async () => {
    try {
      const res = await eventsApi.sendRsvpReminder(id)
      const count = res?.nudged ?? 0
      setRemindToast(count > 0 ? `Reminder sent to ${count} member${count !== 1 ? 's' : ''}.` : 'Everyone has already RSVPed.')
    } catch {
      setRemindToast('Could not send reminder. Try again.')
    }
    setTimeout(() => setRemindToast(null), 4000)
  }

  const handleEndEvent = async () => {
    try {
      const updated = await eventsApi.endEvent(id)
      setEvent(updated)
    } catch {
      setRemindToast('Could not end event. Try again.')
      setTimeout(() => setRemindToast(null), 4000)
    }
    setShowEndConfirm(false)
  }
  const hostName = attendees.find(a => String(a.user_id) === String(event.host_user_id))?.full_name || null
  const isScheduled = event.status === 'scheduled' || event.status === 'in_progress'
  const myAttendee = attendees.find(a => String(a.user_id) === String(user?.id))

  let statusLabel = 'Scheduled'
  if (event.status === 'completed')    statusLabel = 'Completed'
  else if (event.status === 'cancelled')   statusLabel = 'Cancelled'
  else if (event.status === 'in_progress') statusLabel = 'In Progress'

  const scoredRatings = ratings.filter(r => (r.score || 0) > 0)
  const avgRating = scoredRatings.length > 0
    ? (scoredRatings.reduce((s, r) => s + r.score, 0) / scoredRatings.length).toFixed(1)
    : '—'

  const stats = [
    { label: 'Attendees',   value: attendees.length || event.attendee_count || 0 },
    { label: 'Avg Rating ★', value: avgRating },
    { label: 'Status',      value: statusLabel },
  ]

  const heroActions = [
    ...(event.status === 'scheduled' && isHost ? [{ label: '✏️ Edit', onClick: () => setShowEditEvent(true) }] : []),
    ...(partyInvite?.token && (isHost || isCreator) ? [{ label: '✨ Edit Public Invite', onClick: () => setShowEditInvite(true) }] : []),
    ...((isHost || isCreator) && !partyInvite ? [{ label: '✨ Create Invite', onClick: () => navigate('/events/new/invite') }] : []),
    ...(isScheduled && (isHost || isCreator) ? [{ label: '➕ Add Attendees', onClick: () => setShowAddAttendees(true) }] : []),
    ...(isScheduled && (isHost || isCreator) ? [{ label: '🏁 End Event', onClick: () => setShowEndConfirm(true) }] : []),
    ...(isScheduled && isCreator && !!event.rsvp_deadline ? [{ label: '📣 Send Reminder', onClick: handleRsvpReminder }] : []),
    ...(event.ratings_enabled !== false && (event.status === 'completed' || event.status === 'in_progress' || (event.scheduled_date && new Date(event.scheduled_date) < new Date())) ? [{ label: '⭐ Rate', onClick: () => setShowRateModal(true) }] : []),
    ...(event.bill_split_enabled ? [{ label: '💳 Split Bill', onClick: () => setShowBillSplit(true) }] : []),
    ...(isScheduled && myAttendee?.status !== 'going' ? [{ label: '✓ RSVP Going', onClick: () => handleRsvp('going'), loading: rsvpLoading }] : []),
    { label: isBookmarked ? '🔖 Bookmarked' : '🔖 Bookmark', onClick: toggleBookmark },
  ]

  return (
    <AppShell activeRoute="/events">
      {/* Full-width hero banner with controls embedded */}
      <EventHeroCard
        event={event}
        attendees={attendees}
        onBack={() => navigate(-1)}
        actions={heroActions}
        partyInvite={partyInvite}
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
            {event.ratings_enabled !== false && (
              <RatingCard
                ratings={ratings}
                eventStatus={event.status}
                scheduledDate={event.scheduled_date}
                currentUserId={user?.id}
                eventId={id}
                onAddRating={() => setShowRateModal(true)}
              />
            )}
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
              members={attendees}
              mentionContext={{ linkType: 'event', linkId: Number(id) }}
            />
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {(isHost || isCreator) && partyInvite?.token && (
              <PartyInviteAdminCard token={partyInvite.token} eventId={id} />
            )}
            {event.bill_split_enabled && (
              <BillSplitStatusCard
                event={event}
                currentUser={user}
                onOpenModal={() => setShowBillSplit(true)}
              />
            )}
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
        onSaved={(updatedFields) => { setShowEditEvent(false); if (updatedFields) setEvent(prev => ({ ...prev, ...updatedFields })); fetchAll() }}
        onCancel={handleCancelEvent}
      />
      <EditPublicInviteModal
        isOpen={showEditInvite}
        onClose={() => setShowEditInvite(false)}
        token={partyInvite?.token}
        event={event}
        onSaved={(updatedInvite) => { if (updatedInvite) setPartyInvite(prev => ({ ...prev, ...updatedInvite })); fetchAll() }}
      />
      <AddEventAttendeesModal
        isOpen={showAddAttendees}
        onClose={() => setShowAddAttendees(false)}
        eventId={id}
        groupId={event.group_id}
        attendeeIds={attendees.map((a) => a.user_id)}
        onAdded={fetchAll}
      />
      <RateEventModal
        isOpen={showRateModal && event.ratings_enabled !== false}
        onClose={() => setShowRateModal(false)}
        event={event}
        currentUser={user}
        onSubmitted={fetchAll}
        existingRating={ratings.find(r => String(r.rater_user_id || r.reviewer_id || r.rater_id) === String(user?.id))}
      />

      {/* End Event Confirm Modal */}
      {showEndConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'var(--s2)', border: '1px solid var(--glass)', borderRadius: '20px', padding: '28px', maxWidth: '380px', width: '100%' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', textAlign: 'center' }}>🏁</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--t1)', textAlign: 'center', marginBottom: '8px' }}>End this event?</div>
            <div style={{ fontSize: '13px', color: 'var(--t3)', textAlign: 'center', marginBottom: '24px', lineHeight: 1.5 }}>
              This will mark the event as completed. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowEndConfirm(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'var(--s3)', border: '1px solid var(--glass)', color: 'var(--t2)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleEndEvent}
                style={{ flex: 1, padding: '10px', borderRadius: '12px', background: 'var(--rose)', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Yes, End It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remind / action toast */}
      {remindToast && (
        <div style={{
          position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--s2)', border: '1px solid var(--glass)',
          borderRadius: '12px', padding: '12px 20px',
          fontSize: '13px', fontWeight: 600, color: 'var(--t1)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 1100,
          whiteSpace: 'nowrap',
        }}>
          {remindToast}
        </div>
      )}
    </AppShell>
  )
}
