import React, { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('session_token')
    if (!token) {
      setLoading(false)
      return
    }
    // Always verify the token and fetch fresh user data on startup so we
    // pick up any server-side changes (e.g. password_changed flag, avatar, etc.)
    authApi.me().then(freshUser => {
      localStorage.setItem('user', JSON.stringify(freshUser))
      setUser(freshUser)
    }).catch(() => {
      // Session expired or invalid — clear it
      localStorage.removeItem('session_token')
      localStorage.removeItem('user')
    }).finally(() => setLoading(false))
  }, [])

  const login = async (username, password) => {
    try {
      const data = await authApi.login(username, password)
      localStorage.setItem('session_token', data.session_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.detail || 'Login failed' }
    }
  }

  const register = async (username, email, password, fullName) => {
    try {
      const data = await authApi.register(username, email, password, fullName)
      localStorage.setItem('session_token', data.session_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.detail || 'Registration failed' }
    }
  }

  const logout = async () => {
    try {
      const token = localStorage.getItem('session_token')
      if (token) await authApi.logout(token)
    } catch {}
    localStorage.removeItem('session_token')
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
      localStorage.setItem('session_token', data.session_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.detail || 'Google sign-in failed' }
    }
  }

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, login, register, logout, updateUser, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
