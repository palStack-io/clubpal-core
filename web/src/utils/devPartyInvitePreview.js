const PREVIEW_KEY = 'clubpal_party_invite_preview'

export function isDevPartyInvitePreviewEnabled() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false

  const params = new URLSearchParams(window.location.search)
  const value = params.get('partyInvitePreview')
  if (value === '1' || value === 'true') localStorage.setItem(PREVIEW_KEY, '1')
  if (value === '0' || value === 'false') localStorage.removeItem(PREVIEW_KEY)

  return localStorage.getItem(PREVIEW_KEY) === '1'
}

export function getDevPartyInvitePreviewGroup(user, id = 'preview') {
  return {
    id,
    name: 'Sunset Supper Club',
    description: 'A polished preview club for checking party invite personalization.',
    activity_type: 'dining',
    activity_emoji: '🍽️',
    member_count: 4,
    rotation_type: 'round_robin',
    created_at: new Date(Date.now() - 420 * 24 * 60 * 60 * 1000).toISOString(),
    banner_url: null,
    bg_type: 'default',
    bg_value: null,
  }
}

export function getDevPartyInvitePreviewMembers(user) {
  const currentUser = {
    user_id: user?.id || 1,
    full_name: user?.full_name || 'You',
    username: user?.username || 'you',
    avatar_url: user?.avatar_url || null,
    role: 'owner',
    rotation_order: 0,
  }

  return [
    currentUser,
    { user_id: 102, full_name: 'Maya Chen', username: 'maya', avatar_url: null, role: 'member', rotation_order: 1 },
    { user_id: 103, full_name: 'Andre Miles', username: 'andre', avatar_url: null, role: 'member', rotation_order: 2 },
    { user_id: 104, full_name: 'Sam Rivera', username: 'sam', avatar_url: null, role: 'member', rotation_order: 3 },
  ]
}

export function getDevPartyInvitePreviewRotation(user) {
  return {
    user_id: user?.id || 1,
    current_user_id: user?.id || 1,
    turn_index: 0,
    members: getDevPartyInvitePreviewMembers(user),
  }
}

export function getDevPartyInvitePreview(user, group) {
  const startsAt = new Date()
  startsAt.setDate(startsAt.getDate() + 10)
  startsAt.setHours(19, 30, 0, 0)

  return {
    __preview: true,
    token: 'preview-party-invite',
    event_id: -9001,
    title: 'Rooftop Tapas Night',
    scheduled_date: startsAt.toISOString(),
    location: 'The Avery Rooftop',
    max_attendees: 12,
    activity_type: group?.activity_type || 'dining',
    accent_color: '#f97316',
    style: 'frosted',
    bg_animation: 'sparkles',
    cover_image_url: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1400&q=80',
    cover_image_position: '50% 45%',
    host_user_id: user?.id || 1,
    going_count: 5,
    host: {
      id: user?.id || 1,
      full_name: user?.full_name || 'Alex Morgan',
      username: user?.username || 'alex',
      avatar_url: user?.avatar_url || null,
    },
  }
}

export function getDevPartyInvitePreviewEvents() {
  const startsAt = new Date()
  startsAt.setDate(startsAt.getDate() + 10)
  startsAt.setHours(19, 30, 0, 0)

  return [{
    id: -9001,
    title: 'Rooftop Tapas Night',
    scheduled_date: startsAt.toISOString(),
    location: 'The Avery Rooftop',
    status: 'scheduled',
    activity_type: 'dining',
  }]
}
