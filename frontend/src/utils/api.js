// src/utils/api.js
import axios from 'axios'
import { getServerOrigin } from './runtimeConfig'

// Prefer the runtime server URL injected by the desktop client. In a browser
// deployment, /api keeps requests on the same host as the UI, which is
// important when the backend hostname is only resolvable inside Docker/LAN.
const resolveApiUrl = () => {
  const serverOrigin = getServerOrigin()
  if (serverOrigin) return `${serverOrigin}/api`
  return import.meta.env.VITE_API_URL || '/api'
}

const resolveRefreshUrl = () => {
  const baseURL = resolveApiUrl()
  return baseURL.endsWith('/api') ? `${baseURL}/auth/refresh` : `${baseURL}/api/auth/refresh`
}

const api = axios.create({
  baseURL: resolveApiUrl(),
  timeout: 30000, // 30 second timeout
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Several requests can observe an expired access token at once. Share one
// refresh operation so refresh-token rotation cannot sign the user out.
let refreshPromise = null

const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem('refreshToken')
      if (!refreshToken) {
        const error = new Error('No refresh token')
        error.sessionInvalid = true
        throw error
      }

      const { data } = await axios.post(resolveRefreshUrl(), { refreshToken }, { timeout: 15000 })
      const { token, refreshToken: nextRefreshToken } = data?.data || {}
      if (!data?.success || !token || !nextRefreshToken) {
        throw new Error(data?.message || 'Invalid refresh response')
      }

      localStorage.setItem('token', token)
      localStorage.setItem('refreshToken', nextRefreshToken)
      window.dispatchEvent(new CustomEvent('medicore:tokens-refreshed', {
        detail: { token, refreshToken: nextRefreshToken },
      }))
      return { token, refreshToken: nextRefreshToken }
    })().finally(() => {
      refreshPromise = null
    })
  }

  return refreshPromise
}

const clearSessionAndGoToLogin = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  window.location.assign('/login')
}

// Request interceptor — attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}, (error) => {
  return Promise.reject(error)
})

// Response interceptor — handle 401 refresh
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    
    // Handle timeout
    if (err.code === 'ECONNABORTED') {
      return Promise.reject({
        ...err,
        message: 'Request timeout. Please check your connection and try again.',
      })
    }

    // Handle refresh token
    const isAuthRequest = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh')
    if (err.response?.status === 401 && !original._retry && !isAuthRequest) {
      original._retry = true
      try {
        const { token: newToken } = await refreshAccessToken()
        
        // ✓ SYNC ZUSTAND STORE (CRITICAL FIX)
        
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshErr) {
        if (refreshErr.sessionInvalid || refreshErr.response?.status === 400 || refreshErr.response?.status === 401) {
          clearSessionAndGoToLogin()
        }
        return Promise.reject(refreshErr)
      }
    }

    // Add helpful error messages
    if (!err.response) {
      return Promise.reject({
        ...err,
        message: err.message === 'Network Error' ? 'Network error. Please check your connection.' : err.message,
      })
    }

    return Promise.reject(err)
  }
)

export default api
