import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import OnboardingWizard from './components/onboarding/OnboardingWizard'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import AcceptInvite from './pages/auth/AcceptInvite'
import JoinGroup from './pages/groups/JoinGroup'
import VerifyEmail from './pages/auth/VerifyEmail'

import Dashboard from './pages/Dashboard'
import GroupsList from './pages/groups/GroupsList'
import GroupDetail from './pages/groups/GroupDetail'
import CreateGroup from './pages/groups/CreateGroup'
import EditGroup from './pages/groups/EditGroup'
import ManageMembers from './pages/groups/ManageMembers'
import EventDetail from './pages/events/EventDetail'
import EventsList from './pages/events/EventsList'
import CreateEvent from './pages/events/CreateEvent'
import RateEvent from './pages/events/RateEvent'
import Stats from './pages/Stats'
import Leaderboard from './pages/leaderboard/Leaderboard'
import ActivityPicker from './pages/activities/ActivityPicker'
import Profile from './pages/profile/Profile'
import Settings from './pages/profile/Settings'
import NotFound from './pages/NotFound'
import AdminPage from './pages/admin/AdminPage'

import DiscoverRestaurants from './pages/discover/DiscoverRestaurants'
import RestaurantDetail from './pages/discover/RestaurantDetail'
import DiscoverMovies from './pages/discover/DiscoverMovies'
import MovieDetail from './pages/discover/MovieDetail'
import DiscoverBooks from './pages/discover/DiscoverBooks'
import BookDetail from './pages/discover/BookDetail'
import DiscoverHikes from './pages/discover/DiscoverHikes'
import HikeDetail from './pages/discover/HikeDetail'
import DiscoverGames from './pages/discover/DiscoverGames'
import GameDetail from './pages/discover/GameDetail'
import DiscoverArts from './pages/discover/DiscoverArts'
import ArtsDetail from './pages/discover/ArtsDetail'
import DiscoverShows from './pages/discover/DiscoverShows'
import ShowDetail from './pages/discover/ShowDetail'

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <Spinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth()
  if (loading) return <Spinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.is_admin) return <Navigate to="/dashboard" replace />
  return children
}

function GuestRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <Spinner />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return children
}

function OnboardingGate({ children }) {
  const { user, isAuthenticated, loading } = useAuth()
  // Don't block initial render — ProtectedRoute handles loading/auth
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
      <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />

      {/* Discovery */}
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
    </OnboardingGate>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
