import { createElement, isValidElement } from 'react'
import {
  AlertTriangle,
  BedDouble,
  CalendarDays,
  Check,
  Circle,
  ClipboardList,
  Clock,
  CreditCard,
  IndianRupee,
  Package,
  Pill,
  SearchX,
  TestTubes,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react'

const ICON_MAP = [
  { test: /patient|user|staff|doctor|people|users/i, Icon: Users },
  { test: /bed|occupancy|icu|capacity/i, Icon: BedDouble },
  { test: /appointment|opd|booked|visit|date/i, Icon: CalendarDays },
  { test: /revenue|collected|outstanding|bill|invoice|paid|fee|value|sales|gst/i, Icon: IndianRupee },
  { test: /lab|test|critical|result/i, Icon: TestTubes },
  { test: /emergency|risk|breach|alert|stockout|major|pending/i, Icon: AlertTriangle },
  { test: /completed|active|available|closed|license/i, Icon: Check },
  { test: /medicine|pharmacy|drug|rx|stack/i, Icon: Pill },
  { test: /inventory|asset|stock|fleet/i, Icon: Package },
  { test: /analytics|coverage|posture|score/i, Icon: TrendingUp },
  { test: /time|shift|remaining|response/i, Icon: Clock },
]

function fallbackIcon(icon, label = '') {
  if (isValidElement(icon)) return icon
  if (icon && typeof icon !== 'string') return createElement(icon, { size: 22 })
  const source = `${label} ${icon || ''}`
  if (/no-show|expired|cancel/i.test(source)) return <X size={22} />
  if (/stat|urgent|automation/i.test(source)) return <Zap size={22} />
  if (/bill|card|invoice/i.test(source)) return <CreditCard size={22} />
  if (/record|emr|report|incident/i.test(source)) return <ClipboardList size={22} />
  if (/patient|person/i.test(source)) return <User size={22} />
  const match = ICON_MAP.find(({ test }) => test.test(source))
  const Icon = match?.Icon || Circle
  return <Icon size={22} />
}

export default function StatCard({ icon, value, label, change, changeType = 'up', color = 'cyan', className = '' }) {
  return (
    <div className={`stat-card ${color} ${className}`}>
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/80 text-cyan shadow-sm">
        {fallbackIcon(icon, label)}
      </div>
      <div className="text-2xl font-bold text-white leading-none break-words">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
      {change && (
        <div className={`text-xs mt-1.5 ${changeType === 'up' ? 'text-brand-green' : changeType === 'down' ? 'text-brand-red' : 'text-slate-400'}`}>
          {change}
        </div>
      )}
    </div>
  )
}

export function Badge({ status, label, className = '' }) {
  const map = {
    AVAILABLE:'badge-green', OCCUPIED:'badge-red', CLEANING:'badge-amber', RESERVED:'badge-blue',
    ADMITTED:'badge-cyan', DISCHARGED:'badge-green', EXPIRED:'badge-gray',
    BOOKED:'badge-gray', CONFIRMED:'badge-blue', CHECKED_IN:'badge-amber', IN_CONSULTATION:'badge-purple',
    COMPLETED:'badge-green', NO_SHOW:'badge-red', CANCELLED:'badge-gray',
    ACTIVE:'badge-green', INACTIVE:'badge-gray', SUSPENDED:'badge-red',
    BASIC:'badge-gray', PROFESSIONAL:'badge-blue', ENTERPRISE:'badge-purple',
    PAID:'badge-green', PARTIAL_PAID:'badge-amber', PENDING:'badge-amber', OVERDUE:'badge-red',
    DRAFT:'badge-gray', GENERATED:'badge-blue',
    ORDERED:'badge-gray', COLLECTED:'badge-blue', IN_TRANSIT:'badge-blue', RECEIVED:'badge-cyan', PROCESSING:'badge-amber', RESULTED:'badge-cyan', VERIFIED:'badge-green', REPORTED:'badge-green', REJECTED:'badge-red',
    SCHEDULED:'badge-blue', IN_PROGRESS:'badge-amber', PERFORMED:'badge-cyan', REVIEWED:'badge-green',
    RED:'badge-red', ORANGE:'badge-red', YELLOW:'badge-amber', GREEN:'badge-green', BLUE:'badge-blue',
    OPEN:'badge-amber', UNDER_REVIEW:'badge-blue', CAPA_PENDING:'badge-red', CLOSED:'badge-green',
    TRANSFERRED:'badge-blue', DISPATCHED:'badge-amber', EN_ROUTE:'badge-blue', PICKED_UP:'badge-cyan', ARRIVED:'badge-purple',
    DISPENSED:'badge-green',
    ELECTIVE:'badge-blue', EMERGENCY:'badge-red', SEMI_ELECTIVE:'badge-amber',
    IN_USE:'badge-red', MAINTENANCE:'badge-amber',
  }
  return <span className={`badge ${map[status] || 'badge-gray'} ${className}`}>{label || status?.replace(/_/g, ' ')}</span>
}

export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-10 h-10 border-[3px]' }
  return (
    <div className={`${sizes[size]} border-pink-100 border-t-cyan rounded-full animate-spin ${className}`} />
  )
}

export function EmptyState({ icon, title = 'No data found', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/80 text-cyan shadow-sm">
        {fallbackIcon(icon, title || description || '') || <SearchX size={24} />}
      </div>
      <div className="text-sm font-medium text-white mb-1">{title}</div>
      {description && <div className="text-xs text-slate-400 mb-4 max-w-xs">{description}</div>}
      {action}
    </div>
  )
}

export function Pagination({ page, pages, total, limit, onPageChange }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between gap-3 pt-3 border-t border-default mt-2 flex-wrap">
      <span className="text-xs text-slate-400">Showing {((page-1)*limit)+1}-{Math.min(page*limit, total)} of {total}</span>
      <div className="flex gap-1">
        <button className="btn text-xs px-2 py-1" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          const p = page <= 3 ? i + 1 : page - 2 + i
          if (p < 1 || p > pages) return null
          return <button key={p} className={`btn text-xs px-2.5 py-1 ${p === page ? 'bg-cyan text-white border-cyan' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
        })}
        <button className="btn text-xs px-2 py-1" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </div>
  )
}
