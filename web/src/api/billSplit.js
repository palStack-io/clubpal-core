import { billSplitClient, gatewayClient } from './client'

export const billSplitApi = {
  uploadReceipt: (file) => {
    const fd = new FormData()
    fd.append('receipt', file)
    return billSplitClient.post('/ocr', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  create: (payload) => billSplitClient.post('/', payload).then(r => r.data),
  getByEvent: (eventId) =>
    billSplitClient.get(`/event/${eventId}`).then(r => r.data).catch(e => {
      if (e.response?.status === 404) return null
      throw e
    }),
  markPaidManual: (splitId, userId) =>
    billSplitClient.patch(`/${splitId}/shares/${userId}/paid`).then(r => r.data),
  resendReminders: (splitId) =>
    billSplitClient.post(`/${splitId}/reminders`).then(r => r.data),
  getOCRStats: () => billSplitClient.get('/admin/ocr-stats').then(r => r.data),
  getIntegrations: () => gatewayClient.get('/admin/integrations').then(r => r.data),
  updateIntegrations: (data) => gatewayClient.put('/admin/integrations', data).then(r => r.data),
  startClaiming: (splitId) =>
    billSplitClient.post(`/${splitId}/start-claiming`).then(r => r.data),
  getClaimView: (token) =>
    billSplitClient.get(`/claim/${token}`).then(r => r.data),
  submitClaim: (token, claimedItems) =>
    billSplitClient.post(`/claim/${token}/submit`, { claimed_items: claimedItems }).then(r => r.data),
  getClaimingStatus: (splitId) =>
    billSplitClient.get(`/${splitId}/claiming-status`).then(r => r.data),
  finalizeClaims: (splitId) =>
    billSplitClient.post(`/${splitId}/finalize`).then(r => r.data),
}
