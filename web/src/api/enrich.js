import { enrichClient } from './client'

export const enrichApi = {
  // ===== Places / Restaurants / Hikes / Arts =====
  searchPlaces: (params) =>
    enrichClient.get('/places/search', { params }).then(r => r.data),

  nearbyPlaces: (lat, lng, type = 'restaurant', radius = 2000) =>
    enrichClient.get('/places/nearby', { params: { lat, lng, type, radius } }).then(r => r.data),

  getPlace: (placeId) =>
    enrichClient.get(`/places/${placeId}`).then(r => r.data),

  getPlacePhotos: (placeId) =>
    enrichClient.get(`/places/${placeId}/photos`).then(r => r.data),

  // ===== Books =====
  searchBooks: (params) =>
    enrichClient.get('/books/search', { params }).then(r => r.data),

  getBook: (volumeId) =>
    enrichClient.get(`/books/${volumeId}`).then(r => r.data),

  getBookByIsbn: (isbn) =>
    enrichClient.get(`/books/isbn/${isbn}`).then(r => r.data),

  // ===== Movies =====
  searchMovies: (query, year) =>
    enrichClient.get('/movies/search', { params: { query, ...(year ? { year } : {}) } }).then(r => r.data),

  getMovie: (tmdbId) =>
    enrichClient.get(`/movies/${tmdbId}`).then(r => r.data),

  moviesNowPlaying: () =>
    enrichClient.get('/movies/now-playing').then(r => r.data),

  moviesPopular: () =>
    enrichClient.get('/movies/popular').then(r => r.data),

  moviesUpcoming: () =>
    enrichClient.get('/movies/upcoming').then(r => r.data),

  // ===== TV Shows =====
  searchShows: (query, year) =>
    enrichClient.get('/shows/search', { params: { query, ...(year ? { year } : {}) } }).then(r => r.data),

  getShow: (tmdbId) =>
    enrichClient.get(`/shows/${tmdbId}`).then(r => r.data),

  showsPopular: () =>
    enrichClient.get('/shows/popular').then(r => r.data),

  showsTopRated: () =>
    enrichClient.get('/shows/top-rated').then(r => r.data),

  showsAiringToday: () =>
    enrichClient.get('/shows/airing-today').then(r => r.data),

  // ===== Self-hosted Library =====
  getConfig: () =>
    enrichClient.get('/config').then(r => r.data),

  moviesLibrary: () =>
    enrichClient.get('/movies/library').then(r => r.data),

  showsLibrary: () =>
    enrichClient.get('/shows/library').then(r => r.data),

  getRadarrLibrary: () =>
    enrichClient.get('/library/radarr').then(r => r.data),

  getSonarrLibrary: () =>
    enrichClient.get('/library/sonarr').then(r => r.data),

  // ===== Hikes =====
  searchHikes: (params) =>
    enrichClient.get('/hikes/search', { params }).then(r => r.data),

  nearbyHikes: (lat, lng, radius = 10000) =>
    enrichClient.get('/hikes/nearby', { params: { lat, lng, radius } }).then(r => r.data),

  getHike: (placeId) =>
    enrichClient.get(`/hikes/${placeId}`).then(r => r.data),

  // ===== Games =====
  searchGames: (params) =>
    enrichClient.get('/games/search', { params }).then(r => r.data),

  getGame: (igdbId) =>
    enrichClient.get(`/games/${igdbId}`).then(r => r.data),

  popularGames: () =>
    enrichClient.get('/games/popular').then(r => r.data),

  // ===== Arts =====
  searchArts: (params) =>
    enrichClient.get('/arts/search', { params }).then(r => r.data),

  getArts: (placeId) =>
    enrichClient.get(`/arts/${placeId}`).then(r => r.data),

  // ===== Geocode =====
  geocode: (address) =>
    enrichClient.get('/geocode', { params: { address } }).then(r => r.data),

  // ===== Personalized Discover Feed =====
  getUserDiscover: (userId, activityType) =>
    enrichClient.get(`/users/${userId}/discover/${activityType}`).then(r => r.data),
}
