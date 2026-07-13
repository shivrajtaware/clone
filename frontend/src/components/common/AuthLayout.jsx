// src/components/common/AuthLayout.jsx
import { Outlet } from 'react-router-dom'
export default function AuthLayout() {
  return (
    <div className="min-h-screen glass-shell flex items-center justify-center p-4">
      <Outlet />
    </div>
  )
}
