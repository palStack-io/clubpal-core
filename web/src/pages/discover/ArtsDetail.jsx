import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import DetailPage from '../../components/detail/DetailPage'
import { enrichApi } from '../../api/enrich'

export default function ArtsDetail() {
  const { placeId } = useParams()
  const [venue, setVenue] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    enrichApi.getArts(placeId)
      .then(setVenue)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [placeId])

  return <DetailPage type="arts" itemId={placeId} data={venue} loading={loading} />
}
