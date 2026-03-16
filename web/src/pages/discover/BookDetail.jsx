import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import DetailPage from '../../components/detail/DetailPage'
import { enrichApi } from '../../api/enrich'

export default function BookDetail() {
  const { volumeId } = useParams()
  const [book, setBook] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    enrichApi.getBook(volumeId)
      .then(setBook)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [volumeId])

  return <DetailPage type="book" itemId={volumeId} data={book} loading={loading} />
}
