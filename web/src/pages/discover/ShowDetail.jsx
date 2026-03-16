import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import DetailPage from '../../components/detail/DetailPage'
import { enrichApi } from '../../api/enrich'

export default function ShowDetail() {
  const { tmdbId } = useParams()
  const [show, setShow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [inLibrary, setInLibrary] = useState(false)

  useEffect(() => {
    enrichApi.getShow(tmdbId)
      .then(setShow)
      .catch(() => {})
      .finally(() => setLoading(false))

    enrichApi.getSonarrLibrary()
      .then(d => setInLibrary((d?.tmdb_ids || []).includes(Number(tmdbId))))
      .catch(() => {})
  }, [tmdbId])

  return <DetailPage type="show" itemId={tmdbId} data={show} extra={{ inLibrary }} loading={loading} />
}
