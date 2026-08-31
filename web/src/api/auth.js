import { gatewayClient } from './client'

export const authApi = {
  login: (username, password) =>
    gatewayClient.post('/auth/login', { username, password }).then(r => r.data),

  register: (username, email, password, fullName) =>
    gatewayClient.post('/auth/register', { username, email, password, full_name: fullName }).then(r => r.data),

  logout: (token) =>
    gatewayClient.post('/auth/logout', { token }).then(r => r.data),

  me: () =>
    gatewayClient.get('/users/me').then(r => r.data),

  updateProfile: (data) =>
    gatewayClient.patch('/users/me', data).then(r => r.data),


  uploadAvatar: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return gatewayClient.post('/users/me/avatar/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  forgotPassword: (email) =>
    gatewayClient.post('/auth/forgot-password', { email }).then(r => r.data),

  resetPassword: (token, newPassword) =>
    gatewayClient.post('/auth/reset-password', { token, new_password: newPassword }).then(r => r.data),

  verifyEmail: (token) =>
    gatewayClient.post('/auth/verify-email', { token }).then(r => r.data),

  getInvite: (token) =>
    gatewayClient.get(`/auth/invite/${token}`).then(r => r.data),

  sendInvite: (email, groupId, groupName) =>
    gatewayClient.post('/invites/send', { email, group_id: groupId, group_name: groupName }).then(r => r.data),

  validateInvite: (token) =>
    gatewayClient.post('/invites/validate', { token }).then(r => r.data),

  acceptInvite: (token, username, password) =>
    gatewayClient.post('/invites/accept', { token, username, password }).then(r => r.data),

  joinInvite: (token) =>
    gatewayClient.post('/auth/invite/join', { token }).then(r => r.data),

  getSessions: () =>
    gatewayClient.get('/users/me/sessions').then(r => r.data),

  revokeSession: (token) =>
    gatewayClient.delete(`/users/me/sessions/${token}`).then(r => r.data),

  getPreferences: () =>
    gatewayClient.get('/users/me/preferences').then(r => r.data),

  updatePreferences: (data) =>
    gatewayClient.put('/users/me/preferences', data).then(r => r.data),

  refreshPreferences: () =>
    gatewayClient.post('/users/me/preferences/refresh').then(r => r.data),

  oidcLogin: (idToken, provider = 'google') =>
    gatewayClient.post('/auth/oidc', { provider, id_token: idToken }).then(r => r.data),

  confirmOidcLink: (linkToken) =>
    gatewayClient.post('/auth/oidc/confirm-link', { link_token: linkToken }).then(r => r.data),

  linkOidc: (idToken, provider = 'google') =>
    gatewayClient.post('/auth/link', { provider, id_token: idToken }).then(r => r.data),

  unlinkOidc: (provider) =>
    gatewayClient.delete(`/auth/link/${provider}`).then(r => r.data),

  // Admin
  adminListUsers: (limit = 200, offset = 0) =>
    gatewayClient.get('/users', { params: { limit, offset } }).then(r => r.data),

  adminDeleteUser: (userId) =>
    gatewayClient.delete(`/users/${userId}`).then(r => r.data),
}
