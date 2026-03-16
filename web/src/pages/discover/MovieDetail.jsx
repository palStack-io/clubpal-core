import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import DetailPage from '../../components/detail/DetailPage'
import { enrichApi } from '../../api/enrich'

export default function MovieDetail() {
  const { tmdbId } = useParams()
  const [movie, setMovie] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    enrichApi.getMovie(tmdbId)
      .then(setMovie)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tmdbId])

  return <DetailPage type="movie" itemId={tmdbId} data={movie} loading={loading} />
}
