import { eventsClient } from './client'

export const eventsApi = {
  create: (data) =>
    eventsClient.post('/events', data).then(r => r.data),

  getById: (id) =>
    eventsClient.get(`/events/${id}`).then(r => r.data),

  getGroupEvents: (groupId, status) =>
    eventsClient.get(`/groups/${groupId}/events`, { params: status ? { status } : {} }).then(r => r.data),

  getUserEvents: (userId) =>
    eventsClient.get(`/users/${userId}/events`).then(r => r.data),

  getUserHosting: (userId) =>
    eventsClient.get(`/users/${userId}/hosting`).then(r => r.data),

  update: (id, data) =>
    eventsClient.patch(`/events/${id}`, data).then(r => r.data),

  delete: (id) =>
    eventsClient.delete(`/events/${id}`).then(r => r.data),

  getAttendees: (eventId) =>
    eventsClient.get(`/events/${eventId}/attendees`).then(r => r.data),

  addAttendee: (eventId, userId) =>
    eventsClient.post(`/events/${eventId}/attendees`, { user_id: userId }).then(r => r.data),

  rsvp: (eventId, userId, status) =>
    eventsClient.post(`/events/${eventId}/rsvp`, { user_id: userId, status }).then(r => r.data),

  updateRsvp: (eventId, userId, status) =>
    eventsClient.patch(`/events/${eventId}/attendees/${userId}`, { status }).then(r => r.data),

  cancelRsvp: (eventId, userId) =>
    eventsClient.delete(`/events/${eventId}/attendees/${userId}`).then(r => r.data),

  getComments: (eventId) =>
    eventsClient.get(`/events/${eventId}/comments`).then(r => r.data),

  addComment: (eventId, userId, content) =>
    eventsClient.post(`/events/${eventId}/comments`, { user_id: userId, content }).then(r => r.data),

  deleteComment: (eventId, commentId) =>
    eventsClient.delete(`/events/${eventId}/comments/${commentId}`).then(r => r.data),

  getHistory: (eventId) =>
    eventsClient.get(`/events/${eventId}/history`).then(r => r.data),

  getCoverUploadUrl: (eventId, filename, contentType) =>
    eventsClient.post(`/events/${eventId}/cover/upload-url`, { filename, content_type: contentType }).then(r => r.data),

  uploadCover: (eventId, file, { applyCover = true } = {}) => {
    const formData = new FormData()
    formData.append('file', file)
    return eventsClient.post(`/events/${eventId}/cover/upload`, formData, {
      params: { apply_cover: applyCover },
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  getPhotoUploadUrl: (eventId, filename, contentType) =>
    eventsClient.post(`/events/${eventId}/photos/upload-url`, { filename, content_type: contentType }).then(r => r.data),

  uploadPhoto: (eventId, file, caption = null) => {
    const formData = new FormData()
    formData.append('file', file)
    return eventsClient.post(`/events/${eventId}/photos/upload`, formData, {
      params: caption ? { caption } : {},
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  confirmPhoto: (eventId, data) =>
    eventsClient.post(`/events/${eventId}/photos/confirm`, data).then(r => r.data),

  getPhotos: (eventId) =>
    eventsClient.get(`/events/${eventId}/photos`).then(r => r.data),

  deletePhoto: (eventId, photoId) =>
    eventsClient.delete(`/events/${eventId}/photos/${photoId}`).then(r => r.data),

  getGroupRecurringSchedules: (groupId) =>
    eventsClient.get(`/groups/${groupId}/recurring-schedules`).then(r => r.data),

  sendRsvpReminder: (eventId) =>
    eventsClient.post(`/events/${eventId}/rsvp-reminder`).then(r => r.data),

  endEvent: (eventId) =>
    eventsClient.post(`/events/${eventId}/end`).then(r => r.data),

  getEventBringList: (eventId) =>
    eventsClient.get(`/events/${eventId}/bring`).then(r => r.data),

  updateMyEventBring: (eventId, data) =>
    eventsClient.patch(`/events/${eventId}/bring/me`, data).then(r => r.data),

  claimEventBringItem: (eventId, itemId, data) =>
    eventsClient.put(`/events/${eventId}/bring/items/${itemId}/claim`, data).then(r => r.data),

  addEventBringItem: (eventId, data) =>
    eventsClient.post(`/events/${eventId}/bring/items`, data).then(r => r.data),

  editEventBringItem: (eventId, itemId, data) =>
    eventsClient.patch(`/events/${eventId}/bring/items/${itemId}`, data).then(r => r.data),

  deleteEventBringItem: (eventId, itemId) =>
    eventsClient.delete(`/events/${eventId}/bring/items/${itemId}`).then(r => r.data),

  getPendingPartyInvites: (groupId) =>
    eventsClient.get('/party-invites/pending-for-group', { params: { group_id: groupId } }).then(r => r.data),

  getMyPendingPartyInvites: () =>
    eventsClient.get('/party-invites/pending-for-user').then(r => r.data),

  createPartyInvite: (data) =>
    eventsClient.post('/party-invites', data).then(r => r.data),

  inviteUsersToParty: (token, data) =>
    eventsClient.post(`/party-invites/${token}/invite-users`, data).then(r => r.data),

  getPartyInviteByEvent: (eventId) =>
    eventsClient.get(`/party-invites/by-event/${eventId}`).then(r => r.data),

  getMemberInvites: (token) =>
    eventsClient.get(`/party-invites/${token}/member-invites`).then(r => r.data),

  getPartyInviteManage: (token) =>
    eventsClient.get(`/party-invites/${token}/manage`).then(r => r.data),

  updatePartyInvite: (token, data) =>
    eventsClient.patch(`/party-invites/${token}`, data).then(r => r.data),

  addPartyInviteItem: (token, data) =>
    eventsClient.post(`/party-invites/${token}/items`, data).then(r => r.data),

  editPartyInviteItem: (token, itemId, data) =>
    eventsClient.patch(`/party-invites/${token}/items/${itemId}`, data).then(r => r.data),

  deletePartyInviteItem: (token, itemId) =>
    eventsClient.delete(`/party-invites/${token}/items/${itemId}`).then(r => r.data),

  sharePartyInviteToGroup: (token, groupId) =>
    eventsClient.post(`/party-invites/${token}/share-to-group`, { group_id: Number(groupId) }).then(r => r.data),

  getPartyInviteCoverUploadUrl: (token, filename, contentType) =>
    eventsClient.post(`/party-invites/${token}/cover/upload-url`, { filename, content_type: contentType }).then(r => r.data),

  uploadPartyInviteCover: (token, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return eventsClient.post(`/party-invites/${token}/cover/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
}
