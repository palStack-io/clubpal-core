/**
 * Normalize MinIO/storage URLs so they always load correctly in the browser.
 *
 * The backend may store URLs in several forms:
 *   - Relative:       /storage/bucket/file.jpg          → pass through (nginx proxies)
 *   - Internal host:  http://minio:9000/storage/...     → extract /storage/... path
 *   - External host:  http://192.168.x.x:9000/storage/  → extract /storage/... path
 *   - Already public: https://clubapp.palstack.io/...   → pass through
 *   - External CDN:   https://media.giphy.com/...       → pass through unchanged
 */
export function resolveMediaUrl(url) {
  if (!url) return url
  if (url.startsWith('/')) return url
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const idx = url.indexOf('/storage/')
    if (idx !== -1) return url.slice(idx)
  }
  return url
}
