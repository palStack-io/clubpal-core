import axios from 'axios'

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || '/api/gateway'
const GROUPS_URL = import.meta.env.VITE_GROUPS_URL || '/api/groups'
const EVENTS_URL = import.meta.env.VITE_EVENTS_URL || '/api/events'
const RATINGS_URL = import.meta.env.VITE_RATINGS_URL || '/api/ratings'
const ACTIVITIES_URL = import.meta.env.VITE_ACTIVITIES_URL || '/api/activities'
const ENRICH_URL = import.meta.env.VITE_ENRICH_URL || '/api/enrich'

function createClient(baseURL, { injectUserId = false } = {}) {
  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
    timeout: 30000,
  })

  client.interceptors.request.use((config) => {
    // Groups-service and events-service require user_id as a query param
    if (injectUserId) {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        if (user.id) config.params = { user_id: user.id, ...config.params }
      } catch {}
    }

    return config
  })

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('user')
        const pub = ['/login', '/register', '/forgot-password', '/reset-password', '/invite']
        const onPublic = pub.some(p => window.location.pathname.startsWith(p))
        if (!onPublic) {
          const next = window.location.pathname + window.location.search
          window.location.href = `/login?next=${encodeURIComponent(next)}`
        }
      }
      return Promise.reject(error)
    }
  )

  return client
}

export const gatewayClient = createClient(GATEWAY_URL)
export const groupsClient  = createClient(GROUPS_URL,  { injectUserId: true })
export const eventsClient  = createClient(EVENTS_URL,  { injectUserId: true })
export const ratingsClient = createClient(RATINGS_URL)
export const activitiesClient = createClient(ACTIVITIES_URL)
export const enrichClient     = createClient(ENRICH_URL)
