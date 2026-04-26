import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { MobileNavProvider } from './contexts/MobileNavContext'
import { ToastProvider } from './components/ui/Toast'
import OnboardingWizard from './components/onboarding/OnboardingWizard'

// Eager-loaded (small, always needed)
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

// Lazy-loaded pages
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const AcceptInvite = lazy(() => import('./pages/auth/AcceptInvite'))
const JoinGroup = lazy(() => import('./pages/groups/JoinGroup'))
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'))

const Dashboard = lazy(() => import('./pages/Dashboard'))
const GroupsList = lazy(() => import('./pages/groups/GroupsList'))
const GroupDetail = lazy(() => import('./pages/groups/GroupDetail'))
const CreateGroup = lazy(() => import('./pages/groups/CreateGroup'))
const EditGroup = lazy(() => import('./pages/groups/EditGroup'))
const ManageMembers = lazy(() => import('./pages/groups/ManageMembers'))
const EventDetail = lazy(() => import('./pages/events/EventDetail'))
const EventsList = lazy(() => import('./pages/events/EventsList'))
const CreateEvent = lazy(() => import('./pages/events/CreateEvent'))
const RateEvent = lazy(() => import('./pages/events/RateEvent'))
const Stats = lazy(() => import('./pages/Stats'))
const Leaderboard = lazy(() => import('./pages/leaderboard/Leaderboard'))
const ActivityPicker = lazy(() => import('./pages/activities/ActivityPicker'))
const Profile = lazy(() => import('./pages/profile/Profile'))
const Settings = lazy(() => import('./pages/profile/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))
const PayConfirm = lazy(() => import('./pages/PayConfirm'))
const ClaimItems = lazy(() => import('./pages/ClaimItems'))

// Unified discover page
const DiscoverExplore = lazy(() => import('./pages/discover/DiscoverExplore'))

// Discover pages (7 types + details)
const DiscoverRestaurants = lazy(() => import('./pages/discover/DiscoverRestaurants'))
const RestaurantDetail = lazy(() => import('./pages/discover/RestaurantDetail'))
const DiscoverMovies = lazy(() => import('./pages/discover/DiscoverMovies'))
const MovieDetail = lazy(() => import('./pages/discover/MovieDetail'))
const DiscoverBooks = lazy(() => import('./pages/discover/DiscoverBooks'))
const BookDetail = lazy(() => import('./pages/discover/BookDetail'))
const DiscoverHikes = lazy(() => import('./pages/discover/DiscoverHikes'))
const HikeDetail = lazy(() => import('./pages/discover/HikeDetail'))
const DiscoverGames = lazy(() => import('./pages/discover/DiscoverGames'))
const GameDetail = lazy(() => import('./pages/discover/GameDetail'))
const DiscoverArts = lazy(() => import('./pages/discover/DiscoverArts'))
const ArtsDetail = lazy(() => import('./pages/discover/ArtsDetail'))
const DiscoverShows = lazy(() => import('./pages/discover/DiscoverShows'))
const ShowDetail = lazy(() => import('./pages/discover/ShowDetail'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="cp-page-loader">
        <div className="cp-page-loader-dot" />
        <div className="cp-page-loader-dot" style={{ animationDelay: '0.15s' }} />
        <div className="cp-page-loader-dot" style={{ animationDelay: '0.3s' }} />
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <PageLoader />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return children
}

function OnboardingGate({ children }) {
  const { user, isAuthenticated, loading } = useAuth()
  if (!loading && isAuthenticated && user && !user.onboarding_complete) {
    return (
      <>
        {children}
        <OnboardingWizard />
      </>
    )
  }
  return children
}

function AppRoutes() {
  return (
    <OnboardingGate>
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Guest only */}
      <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/join/:code" element={<JoinGroup />} />
      <Route path="/verify-email/:token" element={<VerifyEmail />} />
      <Route path="/pay/:token" element={<PayConfirm />} />
      <Route path="/claim/:token" element={<ClaimItems />} />

      {/* Protected */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute><GroupsList /></ProtectedRoute>} />
      <Route path="/groups/new" element={<ProtectedRoute><CreateGroup /></ProtectedRoute>} />
      <Route path="/groups/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
      <Route path="/groups/:id/edit" element={<ProtectedRoute><EditGroup /></ProtectedRoute>} />
      <Route path="/groups/:id/members" element={<ProtectedRoute><ManageMembers /></ProtectedRoute>} />
      <Route path="/events" element={<ProtectedRoute><EventsList /></ProtectedRoute>} />
      <Route path="/events/new" element={<ProtectedRoute><CreateEvent /></ProtectedRoute>} />
      <Route path="/events/:id" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
      <Route path="/events/:id/rate" element={<ProtectedRoute><RateEvent /></ProtectedRoute>} />
      <Route path="/stats" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      <Route path="/activities" element={<ProtectedRoute><ActivityPicker /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      {/* Discovery */}
      <Route path="/discover" element={<ProtectedRoute><DiscoverExplore /></ProtectedRoute>} />
      <Route path="/discover/restaurants" element={<ProtectedRoute><DiscoverRestaurants /></ProtectedRoute>} />
      <Route path="/discover/restaurants/:placeId" element={<ProtectedRoute><RestaurantDetail /></ProtectedRoute>} />
      <Route path="/discover/movies" element={<ProtectedRoute><DiscoverMovies /></ProtectedRoute>} />
      <Route path="/discover/movies/:tmdbId" element={<ProtectedRoute><MovieDetail /></ProtectedRoute>} />
      <Route path="/discover/books" element={<ProtectedRoute><DiscoverBooks /></ProtectedRoute>} />
      <Route path="/discover/books/:volumeId" element={<ProtectedRoute><BookDetail /></ProtectedRoute>} />
      <Route path="/discover/hikes" element={<ProtectedRoute><DiscoverHikes /></ProtectedRoute>} />
      <Route path="/discover/hikes/:placeId" element={<ProtectedRoute><HikeDetail /></ProtectedRoute>} />
      <Route path="/discover/games" element={<ProtectedRoute><DiscoverGames /></ProtectedRoute>} />
      <Route path="/discover/games/:igdbId" element={<ProtectedRoute><GameDetail /></ProtectedRoute>} />
      <Route path="/discover/arts" element={<ProtectedRoute><DiscoverArts /></ProtectedRoute>} />
      <Route path="/discover/arts/:placeId" element={<ProtectedRoute><ArtsDetail /></ProtectedRoute>} />
      <Route path="/discover/shows" element={<ProtectedRoute><DiscoverShows /></ProtectedRoute>} />
      <Route path="/discover/shows/:tmdbId" element={<ProtectedRoute><ShowDetail /></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
    </OnboardingGate>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <MobileNavProvider>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </MobileNavProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
