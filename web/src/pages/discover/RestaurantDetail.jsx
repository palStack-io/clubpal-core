import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import DetailPage from '../../components/detail/DetailPage'
import { enrichApi } from '../../api/enrich'

export default function RestaurantDetail() {
  const { placeId } = useParams()
  const [place, setPlace] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    enrichApi.getPlace(placeId)
      .then(setPlace)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [placeId])

  return <DetailPage type="dining" itemId={placeId} data={place} loading={loading} />
}
