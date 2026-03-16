import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import DetailPage from '../../components/detail/DetailPage'
import { enrichApi } from '../../api/enrich'

export default function HikeDetail() {
  const { placeId } = useParams()
  const [hike, setHike] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    enrichApi.getHike(placeId)
      .then(setHike)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [placeId])

  return <DetailPage type="hike" itemId={placeId} data={hike} loading={loading} />
}
