import { activitiesClient } from './client'

export const activitiesApi = {
  create: (data) =>
    activitiesClient.post('/activities', data).then(r => r.data),

  getAll: (category) =>
    activitiesClient.get('/activities', { params: category ? { category } : {} }).then(r => r.data),

  getById: (id) =>
    activitiesClient.get(`/activities/${id}`).then(r => r.data),

  search: (query) =>
    activitiesClient.get('/activities/search', { params: { q: query } }).then(r => r.data),

  update: (id, data) =>
    activitiesClient.patch(`/activities/${id}`, data).then(r => r.data),

  delete: (id) =>
    activitiesClient.delete(`/activities/${id}`).then(r => r.data),

  getCategories: () =>
    activitiesClient.get('/categories').then(r => r.data),

  getPopular: () =>
    activitiesClient.get('/popular').then(r => r.data),
}
