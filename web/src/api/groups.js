import { groupsClient } from './client'

export const groupsApi = {
  create: (data) =>
    groupsClient.post('/groups', data).then(r => r.data),

  getById: (id) =>
    groupsClient.get(`/groups/${id}`).then(r => r.data),

  getUserGroups: (userId) =>
    groupsClient.get(`/users/${userId}/groups`).then(r => r.data),

  // Record that the current user opened this group (powers most-visited ordering).
  recordVisit: (groupId) =>
    groupsClient.post(`/groups/${groupId}/visit`).then(r => r.data).catch(() => null),

  update: (id, data) =>
    groupsClient.patch(`/groups/${id}`, data).then(r => r.data),

  delete: (id) =>
    groupsClient.delete(`/groups/${id}`).then(r => r.data),

  getMembers: (groupId) =>
    groupsClient.get(`/groups/${groupId}/members`).then(r => r.data),

  addMember: (groupId, userId) =>
    groupsClient.post(`/groups/${groupId}/members`, { user_id: userId }).then(r => r.data),

  updateMemberRole: (groupId, userId, role) =>
    groupsClient.patch(`/groups/${groupId}/members/${userId}`, { role }).then(r => r.data),

  removeMember: (groupId, userId) =>
    groupsClient.delete(`/groups/${groupId}/members/${userId}`).then(r => r.data),

  getRotation: (groupId) =>
    groupsClient.get(`/groups/${groupId}/rotation`).then(r => r.data),

  advanceRotation: (groupId) =>
    groupsClient.post(`/groups/${groupId}/rotation/advance`).then(r => r.data),

  completeTurn: (groupId, eventId = null) =>
    groupsClient.post(`/groups/${groupId}/rotation/complete-turn`, eventId ? { event_id: eventId } : {}).then(r => r.data),

  resetRotation: (groupId) =>
    groupsClient.post(`/groups/${groupId}/rotation/reset`).then(r => r.data),

  skipRotation: (groupId, reason) =>
    groupsClient.post(`/groups/${groupId}/rotation/skip`, { reason }).then(r => r.data),

  reorderRotation: (groupId, userIds) =>
    groupsClient.patch(`/groups/${groupId}/rotation/reorder`, { user_ids: userIds }).then(r => r.data),

  setRotation: (groupId, userId) =>
    groupsClient.post(`/groups/${groupId}/rotation/set`, { user_id: userId }).then(r => r.data),


  uploadBanner: (groupId, file, { applyBanner = true } = {}) => {
    const formData = new FormData()
    formData.append('file', file)
    return groupsClient.post(`/groups/${groupId}/banner/upload`, formData, {
      params: { apply_banner: applyBanner },
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  getComments: (groupId) =>
    groupsClient.get(`/groups/${groupId}/comments`).then(r => r.data),

  addComment: (groupId, userId, content) =>
    groupsClient.post(`/groups/${groupId}/comments`, { user_id: userId, content }).then(r => r.data),

  deleteComment: (groupId, commentId) =>
    groupsClient.delete(`/groups/${groupId}/comments/${commentId}`).then(r => r.data),

  // Poll methods
  createPoll: (groupId, userId, data) =>
    groupsClient.post(`/groups/${groupId}/polls`, data, { params: { user_id: userId } }).then(r => r.data),

  getGroupPolls: (groupId, userId) =>
    groupsClient.get(`/groups/${groupId}/polls`, { params: { user_id: userId } }).then(r => r.data),

  getPoll: (pollId, userId) =>
    groupsClient.get(`/polls/${pollId}`, { params: { user_id: userId } }).then(r => r.data),

  respondToPoll: (pollId, userId, responseOrResponses) => {
    const isMulti = Array.isArray(responseOrResponses)
    const body = isMulti
      ? { user_id: userId, responses: responseOrResponses }
      : { user_id: userId, response: responseOrResponses }
    return groupsClient.post(`/polls/${pollId}/respond`, body).then(r => r.data)
  },

  closePoll: (pollId, userId) =>
    groupsClient.put(`/polls/${pollId}/close`, {}, { params: { user_id: userId } }).then(r => r.data),

  convertPoll: (pollId, userId, data) =>
    groupsClient.post(`/polls/${pollId}/convert`, { user_id: userId, ...data }).then(r => r.data),

  getPendingPolls: (userId) =>
    groupsClient.get(`/users/${userId}/polls/pending`).then(r => r.data),

  getMyActivePolls: (userId) =>
    groupsClient.get(`/users/${userId}/polls/created`).then(r => r.data),

  editPoll: (pollId, data) =>
    groupsClient.patch(`/polls/${pollId}`, data).then(r => r.data),

  addPollOption: (pollId, userId, label, emoji = '⭐') =>
    groupsClient.post(`/polls/${pollId}/options`, { user_id: userId, label, emoji }).then(r => r.data),

  notifyPoll: (pollId) =>
    groupsClient.post(`/polls/${pollId}/notify`).then(r => r.data),

  // Invite codes
  generateInviteCode: (groupId, data) =>
    groupsClient.post(`/groups/${groupId}/invite-codes`, data).then(r => r.data),

  getActiveInviteCode: (groupId) =>
    groupsClient.get(`/groups/${groupId}/invite-codes/active`).then(r => r.data),

  previewInviteCode: (code) =>
    groupsClient.get(`/invite-codes/${code}`).then(r => r.data),

  joinViaCode: (code) =>
    groupsClient.post(`/invite-codes/${code}/join`).then(r => r.data),

  // Join requests
  getJoinRequests: (groupId) =>
    groupsClient.get(`/groups/${groupId}/join-requests`).then(r => r.data),

  getJoinRequestsCount: (groupId) =>
    groupsClient.get(`/groups/${groupId}/join-requests/count`).then(r => r.data),

  reviewJoinRequest: (requestId, action) =>
    groupsClient.patch(`/join-requests/${requestId}`, { action }).then(r => r.data),
}
