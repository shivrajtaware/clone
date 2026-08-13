export const getServerOrigin = () => {
  const runtime = typeof window !== 'undefined' ? window.__MEDICORE_SERVER_URL__ : ''
  const configured = runtime || import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_SOCKET_URL || ''
  return String(configured || '').trim().replace(/\/+$/, '')
}

export const getSocketUrl = () => getServerOrigin()
