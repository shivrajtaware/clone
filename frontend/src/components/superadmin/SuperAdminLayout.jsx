import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import useAuthStore from '../../context/authStore'
import clsx from 'clsx'
import { BarChart3, Building2, DoorOpen, FileText, Globe2, LockKeyhole, Settings, Shield } from 'lucide-react'

const SA_NAV = [
  { to: '/superadmin', icon: BarChart3, label: 'Dashboard', end: true },
  { to: '/superadmin/hospitals', icon: Building2, label: 'Hospitals', desc: 'Manage tenants' },
  { to: '/superadmin/invoices', icon: FileText, label: 'Invoices & Billing', desc: 'License revenue' },
  { to: '/superadmin/analytics', icon: Globe2, label: 'Global Analytics', desc: 'Platform metrics' },
  { to: '/superadmin/settings', icon: Settings, label: 'Settings', desc: 'Security & broadcast' },
]


export default function SuperAdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <div className="flex h-screen overflow-hidden glass-shell">
      <aside
        className="w-[240px] border-r border-default flex flex-col flex-shrink-0"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,236,245,0.66))',
          backdropFilter: 'blur(30px) saturate(1.35)',
          boxShadow: '12px 0 36px rgba(132,42,84,0.12), inset -1px 0 0 rgba(255,255,255,0.7)'
        }}
      >
        <div className="h-[62px] flex items-center gap-2.5 px-4 border-b border-default">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-300 via-cyan to-cyan-dark flex items-center justify-center shadow-glow-cyan text-white">
            <Shield size={19} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">Dr.AiSolnex</div>
            <div className="text-[10px] text-cyan truncate">Super Admin Panel</div>
          </div>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          <div className="nav-section-label">Management</div>
          {SA_NAV.map(({ to, icon: Icon, label, end, desc }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => clsx('nav-item', isActive && 'active')}>
              <Icon size={17} strokeWidth={2.1} />
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate leading-tight">{label}</div>
                {desc && <div className="text-[9px] text-slate-500 truncate leading-tight mt-px">{desc}</div>}
              </div>
            </NavLink>
          ))}

        </nav>
        <div className="border-t border-default p-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="avatar-sm text-xs">{user?.first_name?.[0]}{user?.last_name?.[0]}</div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-white truncate">{user?.first_name} {user?.last_name}</div>
              <div className="text-[10px] text-cyan">Super Admin</div>
            </div>
          </div>
          <button className="btn w-full text-xs py-1.5 text-brand-red justify-center" onClick={handleLogout}>
            <DoorOpen size={15} /> Logout
          </button>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header
          className="h-[62px] border-b border-default flex items-center px-5 gap-3 flex-shrink-0"
          style={{
            background: 'linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,239,246,0.7))',
            backdropFilter: 'blur(28px) saturate(1.32)',
            boxShadow: '0 10px 34px rgba(132,42,84,0.1), inset 0 -1px 0 rgba(255,255,255,0.72)'
          }}
        >
          <div className="flex-1 text-sm font-semibold text-white truncate">Dr.AiSolnex - Super Admin Control Panel</div>
          <span className="badge badge-purple"><LockKeyhole size={13} /> Super Admin</span>
          <span className="text-xs text-slate-400">v1.0.0</span>
        </header>
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
