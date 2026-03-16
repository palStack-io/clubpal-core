import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import DetailPage from '../../components/detail/DetailPage'
import { enrichApi } from '../../api/enrich'

export default function GameDetail() {
  const { igdbId } = useParams()
  const [game, setGame] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    enrichApi.getGame(igdbId)
      .then(setGame)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [igdbId])

  return <DetailPage type="game" itemId={igdbId} data={game} loading={loading} />
}
