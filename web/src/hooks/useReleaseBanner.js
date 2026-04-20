import { useState, useEffect } from 'react'
import { gatewayClient } from '../api/client'

const STORAGE_KEY = 'lastSeenReleaseVersion'

export function useReleaseBanner() {
  const [release, setRelease] = useState(null)
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    gatewayClient.get('/releases/latest')
      .then(r => {
        const data = r.data
        if (!data?.version) return
        const seen = localStorage.getItem(STORAGE_KEY)
        if (seen !== data.version) {
          setRelease(data)
          setVisible(true)
        }
      })
      .catch(() => {})
  }, [])

  const dismiss = () => {
    if (release?.version) localStorage.setItem(STORAGE_KEY, release.version)
    setVisible(false)
    setExpanded(false)
  }

  return { release, visible, expanded, setExpanded, dismiss }
}
