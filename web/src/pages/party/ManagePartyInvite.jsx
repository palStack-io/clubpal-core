import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { eventsClient } from '../../api/client'

// Party invite management has moved inline to the event detail page.
// This route resolves the event ID from the token and redirects there.
export default function ManagePartyInvite() {
  const { token }  = useParams()
  const navigate   = useNavigate()

  useEffect(() => {
    eventsClient.get(`/party-invites/${token}/manage`)
      .then(r => navigate(`/events/${r.data.event_id}`, { replace: true }))
      .catch(err => {
        // Non-hosts get 403 — send them to the public RSVP page
        if (err?.response?.status === 403) {
          navigate(`/p/${token}`, { replace: true })
        } else {
          navigate(-1)
        }
      })
  }, [token])

  return null
}
