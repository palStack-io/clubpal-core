import { ratingsClient } from './client'

export const ratingsApi = {
  create: (data) =>
    ratingsClient.post('/ratings', data).then(r => r.data),

  getById: (id) =>
    ratingsClient.get(`/ratings/${id}`).then(r => r.data),

  update: (id, data) =>
    ratingsClient.patch(`/ratings/${id}`, data).then(r => r.data),

  delete: (id) =>
    ratingsClient.delete(`/ratings/${id}`).then(r => r.data),

  getEventRatings: (eventId) =>
    ratingsClient.get(`/events/${eventId}/ratings`).then(r => r.data),

  getUserRatings: (userId) =>
    ratingsClient.get(`/users/${userId}/ratings`).then(r => r.data),

  getUserGiven: (userId) =>
    ratingsClient.get(`/users/${userId}/ratings/given`).then(r => r.data),

  getUserStats: (userId) =>
    ratingsClient.get(`/users/${userId}/stats`).then(r => r.data),

  getEventStats: (eventId) =>
    ratingsClient.get(`/events/${eventId}/stats`).then(r => r.data),

  getLeaderboard: (groupId, queryParams = '') =>
    ratingsClient.get(`/groups/${groupId}/leaderboard${queryParams}`).then(r => r.data),
}
