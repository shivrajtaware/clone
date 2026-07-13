// src/context/authStore.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../utils/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (email, password) => {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false })

        const { data } = await api.post('/auth/login', {
          email: email.trim().toLowerCase(),
          password,
        })
        if (!data?.success) throw new Error(data?.message || 'Login failed. Check credentials.')
        const payload = data?.data || data
        const { user, token, refreshToken } = payload || {}
        if (!user || !token || !refreshToken) throw new Error(data?.message || 'Login response is invalid')
        localStorage.setItem('token', token)
        localStorage.setItem('refreshToken', refreshToken)
        set({ user, token, refreshToken, isAuthenticated: true })
        return user
      },

      logout: async () => {
        try { await api.post('/auth/logout') } catch {}
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false })
      },

      // ✓ SYNC REFRESH TOKEN WITH STORE
      updateTokens: (token, refreshToken) => {
        localStorage.setItem('token', token)
        localStorage.setItem('refreshToken', refreshToken)
        set({ token, refreshToken, isAuthenticated: true })
      },

      fetchMe: async () => {
        const token = localStorage.getItem('token')
        if (!token) {
          set({ user: null, isAuthenticated: false })
          throw new Error('No token')
        }
        try {
          const { data } = await api.get('/auth/me')
          set({ user: data.data, token, refreshToken: localStorage.getItem('refreshToken'), isAuthenticated: true })
          return data.data
        } catch (err) {
          // The response interceptor clears the session when the refresh token
          // is invalid. A temporary LAN/server outage should not log users out.
          if (err.response?.status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('refreshToken')
            set({ user: null, token: null, refreshToken: null, isAuthenticated: false })
          }
          throw err
        }
      },

      updateUser: (updates) => set(state => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'medicore-auth',
      partialize: (state) => ({ user: state.user, token: state.token, refreshToken: state.refreshToken, isAuthenticated: state.isAuthenticated }),
    }
  )
)

if (typeof window !== 'undefined') {
  window.addEventListener('medicore:tokens-refreshed', (event) => {
    const { token, refreshToken } = event.detail || {}
    if (token && refreshToken) useAuthStore.getState().updateTokens(token, refreshToken)
  })
}

export default useAuthStore
