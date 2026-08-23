import { NavLink } from 'react-router-dom'
import useAuthStore from '../../context/authStore'
import { hasModuleAccess } from '../../utils/helpers'
import clsx from 'clsx'
import {
  Ambulance,
  BedDouble,
  BellDot,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  HeartPulse,
  Building2,
  LayoutDashboard,
  MessageSquare,
  Microscope,
  Package,
  Pill,
  RadioTower,
  Settings,
  ShieldCheck,
  Stethoscope,
  TestTubes,
  TrendingUp,
  Users,
  Utensils,
  Video,
} from 'lucide-react'

const NAV = [
  { section: 'Overview', items: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', module: 'DASHBOARD', end: true },
    { to: '/analytics', icon: TrendingUp, label: 'Analytics', module: 'ANALYTICS' },
  ] },
  { section: 'Clinical', items: [
    { to: '/patients', icon: Users, label: 'Patients', module: 'PATIENTS' },
    { to: '/appointments', icon: CalendarDays, label: 'Appointments', module: 'APPOINTMENTS' },
    { to: '/telemedicine', icon: Video, label: 'Telemedicine', module: 'APPOINTMENTS' },
    { to: '/medicine-stacks', icon: Pill, label: 'Medicine Stacks', module: 'MEDICINE_STACKS' },
    { to: '/emr', icon: ClipboardList, label: 'EMR / Records', module: 'EMR' },
    { to: '/emergency', icon: BellDot, label: 'Emergency', module: 'EMERGENCY', alert: true },
  ] },
  { section: 'Wards', items: [
    { to: '/beds', icon: BedDouble, label: 'Bed Management', module: 'BEDS' },
    { to: '/icu', icon: HeartPulse, label: 'ICU Dashboard', module: 'ICU' },
    { to: '/ot', icon: Microscope, label: 'Operation Theatre', module: 'OT' },
  ] },
  { section: 'Diagnostics', items: [
    { to: '/radiology', icon: RadioTower, label: 'Radiology', module: 'RADIOLOGY' },
  ] },
  { section: 'Operations', items: [
    { to: '/pharmacy', icon: Pill, label: 'Pharmacy', module: 'PHARMACY' },
    { to: '/billing', icon: CreditCard, label: 'Billing', module: 'BILLING' },
    { to: '/billing-config', icon: Settings, label: 'Billing Config', module: 'BILLING_CONFIG' },
    { to: '/inventory', icon: Package, label: 'Inventory & Assets', module: 'INVENTORY' },
  ] },
  { section: 'Staff & Admin', items: [
    { to: '/staff', icon: Stethoscope, label: 'Staff & Doctors', module: 'STAFF' },
    { to: '/ambulance', icon: Ambulance, label: 'Ambulance', module: 'AMBULANCE' },
    { to: '/dietary', icon: Utensils, label: 'Dietary', module: 'DIETARY' },
    { to: '/mortuary', icon: Building2, label: 'Mortuary', module: 'MORTUARY' },
    { to: '/compliance', icon: ShieldCheck, label: 'Compliance', module: 'COMPLIANCE' },
    { to: '/communication', icon: MessageSquare, label: 'Communication', module: 'COMMUNICATION' },
    { to: '/settings', icon: Settings, label: 'Settings', module: 'SETTINGS' },
  ] },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { user } = useAuthStore()

  return (
    <aside
      className={clsx(
        'flex flex-col h-full border-r border-default overflow-hidden',
        collapsed ? 'w-[64px]' : 'w-[260px]'
      )}
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.88), rgba(255,236,245,0.66))',
        backdropFilter: 'blur(30px) saturate(1.35)',
        boxShadow: '12px 0 36px rgba(132,42,84,0.12), inset -1px 0 0 rgba(255,255,255,0.7)'
      }}
    >
      <div className="flex items-center gap-2.5 h-[62px] px-4 border-b border-default flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-300 via-cyan to-cyan-dark flex items-center justify-center flex-shrink-0 shadow-glow-cyan text-white">
          <img src="/brand-mark.png" alt="Dr.AiSolnex" className="w-8 h-8 object-contain" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-sm font-bold text-white leading-tight">Dr.AiSolnex HMS</div>
            <div className="text-[10px] text-slate-500 leading-tight truncate">{user?.hospital?.name || 'Hospital'}</div>
          </div>
        )}
      </div>

      <nav className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden py-2 pr-1">
        {NAV.map(({ section, items }) => {
          const visibleItems = items.filter(item => hasModuleAccess(user, item.module))
          if (!visibleItems.length) return null
          return (
          <div key={section} className="mb-1">
            {!collapsed && <div className="nav-section-label">{section}</div>}
            {visibleItems.map(({ to, icon: Icon, label, end, alert }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => clsx('nav-item', isActive && 'active', collapsed && 'justify-center px-0 mx-0 rounded-none')}
                title={collapsed ? label : undefined}
              >
                <Icon className="flex-shrink-0" size={collapsed ? 20 : 17} strokeWidth={2.1} />
                {!collapsed && <span className="flex-1 text-sm truncate">{label}</span>}
                {!collapsed && alert && <span className="w-2 h-2 bg-brand-red rounded-full animate-pulse-slow flex-shrink-0" />}
              </NavLink>
            ))}
          </div>
        )})}
      </nav>

      <div className="border-t border-default p-3 flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5 mb-2.5 px-1">
            <div className={clsx('avatar-sm flex-shrink-0', !user && 'bg-white')}>
              {user ? `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}` : '?'}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">{user ? `${user.first_name} ${user.last_name}` : 'Loading...'}</div>
              <div className="text-[10px] text-slate-500 truncate">{user?.role?.replace(/_/g, ' ')}</div>
            </div>
          </div>
        )}
        <button onClick={onToggle} className="btn w-full text-xs py-1.5 justify-center">
          {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /> Collapse</>}
        </button>
      </div>
    </aside>
  )
}
