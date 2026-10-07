import React, { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../api/auth'

const AuthContext = createContext(null)

// FastAPI's `detail` field isn't always a string — it can be an object (e.g. our
// LINK_REQUIRED payload) or a list (422 validation errors). Calling .toLowerCase()
// or rendering a non-string detail directly crashes the page, so every catch block
// funnels through here instead of reading err.response?.data?.detail raw.
function extractErrorMessage(err, fallback) {
  const detail = err?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map(d => d?.msg || (typeof d === 'string' ? d : null)).filter(Boolean).join('; ') || fallback
  }
  if (typeof detail === 'object') return detail.message || fallback
  return fallback
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/invite']
    const onPublic = publicPaths.some(p => window.location.pathname.startsWith(p))
    if (onPublic) { setLoading(false); return }

    authApi.me().then(freshUser => {
      localStorage.setItem('user', JSON.stringify(freshUser))
      setUser(freshUser)
    }).catch(() => {
      localStorage.removeItem('user')
    }).finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    try {
      const data = await authApi.login(username, password)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return { success: true }
    } catch (err) {
      return { success: false, error: extractErrorMessage(err, 'That didn\'t work. Check your details and try again.') }
    }
  }

  const register = async (username, email, password, fullName) => {
    try {
      const data = await authApi.register(username, email, password, fullName)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return { success: true }
    } catch (err) {
      return { success: false, error: extractErrorMessage(err, 'We couldn\'t create your account. Give it another go.') }
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {}
    localStorage.removeItem('user')
    setUser(null)
  }

  const updateUser = (userData) => {
    const updated = { ...user, ...userData }
    setUser(updated)
    localStorage.setItem('user', JSON.stringify(updated))
  }

  const loginWithGoogle = async (credential) => {
    try {
      const data = await authApi.oidcLogin(credential, 'google')
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return { success: true }
    } catch (err) {
      const detail = err?.response?.data?.detail
      if (detail && typeof detail === 'object' && detail.code === 'LINK_REQUIRED') {
        return {
          success: false,
          linkRequired: true,
          linkToken: detail.link_token,
          email: detail.email,
          provider: detail.provider,
          message: detail.message,
        }
      }
      return { success: false, error: extractErrorMessage(err, 'Google sign-in didn\'t work. Give it another go.') }
    }
  }

  const confirmLink = async (linkToken) => {
    try {
      const data = await authApi.confirmOidcLink(linkToken)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return { success: true }
    } catch (err) {
      return { success: false, error: extractErrorMessage(err, 'We couldn\'t link that account. Give it another go.') }
    }
  }

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, login, register, logout, updateUser, loginWithGoogle, confirmLink }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
