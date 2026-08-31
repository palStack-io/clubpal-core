import { gatewayClient } from './client'

export const adminApi = {
  getIntegrations: () => gatewayClient.get('/admin/integrations').then(r => r.data),
  updateIntegrations: (data) => gatewayClient.put('/admin/integrations', data).then(r => r.data),
}
