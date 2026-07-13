// src/components/common/AppLayout.jsx
import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar  from './Topbar'
import useAuthStore from '../../context/authStore'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { fetchMe, logout } = useAuthStore()

  useEffect(() => {
    fetchMe().catch(() => {
      logout()
      navigate('/login')
    })
  }, [fetchMe, logout, navigate])

  useEffect(() => { setMobileSidebarOpen(false) }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden glass-shell">
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar collapsed={!sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
      </div>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setMobileSidebarOpen(true)} sidebarOpen={sidebarOpen} onSidebarToggle={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
