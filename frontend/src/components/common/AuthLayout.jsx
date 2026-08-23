// src/components/common/AuthLayout.jsx
import { Outlet } from 'react-router-dom'
export default function AuthLayout() {
  return (
    <div className="min-h-screen overflow-y-auto glass-shell flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_24px_70px_rgba(102,25,62,0.18)]">
        <Outlet />
      </div>
    </div>
  )
}
