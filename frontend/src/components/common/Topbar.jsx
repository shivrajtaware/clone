import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from '../../context/authStore'
import api from '../../utils/api'
import { fmt } from '../../utils/helpers'
import { Bell, DoorOpen, Menu, ScanLine, Search, Settings, X } from 'lucide-react'

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [showProfile, setShowProfile] = useState(false)
  const [showNotif, setShowNotif] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [scanOpen, setScanOpen] = useState(false)
  const [scanCode, setScanCode] = useState('')
  const [scanError, setScanError] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const scanInputRef = useRef(null)

  const { data: notifData } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => api.get('/communication/announcements').then(r => r.data.data),
    staleTime: 60000,
  })

  const handleSearch = async (q) => {
    setSearch(q)
    if (q.length < 2) { setSearchResults([]); return }
    try {
      const { data } = await api.get(`/patients/search?q=${q}`)
      setSearchResults(data.data)
    } catch { setSearchResults([]) }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const openScanner = () => {
    setScanOpen(true)
    setScanCode('')
    setScanError('')
    setTimeout(() => scanInputRef.current?.focus(), 50)
  }

  const handleScanSubmit = async (e) => {
    e.preventDefault()
    const code = scanCode.trim()
    if (!code) return

    setScanLoading(true)
    setScanError('')
    try {
      const { data } = await api.post('/barcode/scan', { code })
      navigate(`/patients/${data.data.patient.id}`)
      setScanOpen(false)
      setScanCode('')
    } catch (error) {
      setScanError(error.response?.data?.message || 'Patient not found for scanned barcode')
      setScanCode('')
      setTimeout(() => scanInputRef.current?.focus(), 50)
    } finally {
      setScanLoading(false)
    }
  }

  return (
    <header
      className="h-[62px] border-b border-default flex items-center px-4 gap-3 flex-shrink-0 z-30 relative"
      style={{
        background: 'linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,239,246,0.7))',
        backdropFilter: 'blur(28px) saturate(1.32)',
        boxShadow: '0 10px 34px rgba(132,42,84,0.1), inset 0 -1px 0 rgba(255,255,255,0.72)'
      }}
    >
      <button className="btn-ghost lg:hidden" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={18} />
      </button>

      <div className="relative flex-1 max-w-sm min-w-[160px]">
        <input
          className="input pl-9 text-sm w-full"
          placeholder="Search patients by name, UHID, phone..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          onBlur={() => setTimeout(() => setSearchResults([]), 200)}
        />
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 card-sm shadow-2xl z-50 overflow-hidden p-0">
            {searchResults.map(p => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-navy-600 cursor-pointer" onClick={() => { navigate(`/patients/${p.id}`); setSearch(''); setSearchResults([]) }}>
                <div className="avatar-sm text-xs">{p.first_name?.[0]}{p.last_name?.[0]}</div>
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{p.first_name} {p.last_name}</div>
                  <div className="text-xs text-slate-400 truncate">{p.uhid} - {p.phone}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn text-xs px-3 py-2" onClick={openScanner}>
        <ScanLine size={16} /> Scan
      </button>

      <div className="flex items-center gap-2 ml-auto">
        <div className="relative">
          <button className="btn-icon relative" onClick={() => { setShowNotif(v => !v); setShowProfile(false) }} aria-label="Announcements">
            <Bell size={17} />
            {notifData?.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-brand-red rounded-full text-[9px] flex items-center justify-center text-white font-bold">{notifData.length > 9 ? '9+' : notifData.length}</span>}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 card-sm shadow-2xl z-50 overflow-hidden p-0">
              <div className="px-4 py-3 border-b border-default text-sm font-semibold text-white">Announcements</div>
              <div className="max-h-72 overflow-y-auto">
                {(notifData || []).length === 0 ? (
                  <div className="p-4 text-sm text-slate-400 text-center">No announcements</div>
                ) : (notifData || []).map(a => (
                  <div key={a.id} className="px-4 py-3 border-b border-default/50 hover:bg-navy-600">
                    <div className="text-sm font-medium text-white">{a.title}</div>
                    <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{a.body}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{fmt.ago(a.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-navy-600 transition-all min-w-0"
            onClick={() => { setShowProfile(v => !v); setShowNotif(false) }}
          >
            <div className="avatar-sm text-xs">{user?.first_name?.[0]}{user?.last_name?.[0]}</div>
            <div className="hidden md:block text-left min-w-0">
              <div className="text-xs font-medium text-white leading-tight truncate max-w-32">{user?.first_name} {user?.last_name}</div>
              <div className="text-[10px] text-slate-400 leading-tight truncate max-w-32">{user?.role?.replace(/_/g, ' ')}</div>
            </div>
          </button>
          {showProfile && (
            <div className="absolute right-0 top-full mt-2 w-56 card-sm shadow-2xl z-50 overflow-hidden p-0">
              <div className="px-4 py-3 border-b border-default">
                <div className="text-sm font-semibold text-white truncate">{user?.first_name} {user?.last_name}</div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">{user?.email}</div>
                <div className="text-xs text-cyan mt-0.5">{user?.role?.replace(/_/g, ' ')}</div>
              </div>
              <div className="py-1">
                <button className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-navy-600 flex items-center gap-2" onClick={() => { navigate('/settings'); setShowProfile(false) }}><Settings size={15} /> Settings</button>
                <button className="w-full text-left px-4 py-2 text-sm text-brand-red hover:bg-navy-600 flex items-center gap-2" onClick={handleLogout}><DoorOpen size={15} /> Logout</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {scanOpen && (
        <div className="modal-overlay">
          <form onSubmit={handleScanSubmit} className="modal w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white">Scan Patient Barcode</h2>
              <button type="button" className="btn-icon" onClick={() => setScanOpen(false)} aria-label="Close scanner"><X size={16} /></button>
            </div>
            <input
              ref={scanInputRef}
              className="input w-full font-mono"
              value={scanCode}
              onChange={e => setScanCode(e.target.value)}
              placeholder="Scan barcode here"
              autoComplete="off"
            />
            {scanError && <div className="text-xs text-brand-red">{scanError}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={scanLoading} className="btn-primary flex-1 disabled:opacity-50">
                {scanLoading ? 'Opening...' : 'Open Patient'}
              </button>
              <button type="button" className="btn flex-1" onClick={() => setScanOpen(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </header>
  )
}
