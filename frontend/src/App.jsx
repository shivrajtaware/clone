// src/App.jsx
import { Component, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './context/authStore'
import { hasModuleAccess } from './utils/helpers'

// Layouts
import AppLayout     from './components/common/AppLayout'
import AuthLayout    from './components/common/AuthLayout'

// Auth
import LoginPage     from './pages/LoginPage'

// Hospital HMS Pages
import DashboardPage    from './pages/DashboardPage'
import PatientsPage     from './pages/PatientsPage'
import PatientDetailPage from './pages/PatientDetailPage'
import AppointmentsPage from './pages/AppointmentsPage'
import EMRPage          from './pages/EMRPage'
import BedsPage         from './pages/BedsPage'
import ICUPage          from './pages/ICUPage'
import OTPage           from './pages/OTPage'
import EmergencyPage    from './pages/EmergencyPage'
import RadiologyPage    from './pages/RadiologyPage'
import PharmacyPage     from './pages/PharmacyPage'
import MedicineStacksPage from './pages/MedicineStacksPage'
import BillingPage      from './pages/BillingPage'
import BillingConfigPage from './pages/BillingConfigPage'
import InventoryPage    from './pages/InventoryPage'
import StaffPage        from './pages/StaffPage'
import AmbulancePage    from './pages/AmbulancePage'
import DietaryPage      from './pages/DietaryPage'
import CompliancePage   from './pages/CompliancePage'
import AnalyticsPage    from './pages/AnalyticsPage'
import MortuaryPage     from './pages/MortuaryPage'
import CommunicationPage from './pages/CommunicationPage'
import SettingsPage     from './pages/SettingsPage'

// Super Admin Pages
import SuperAdminLayout    from './components/superadmin/SuperAdminLayout'
import SADashboardPage     from './pages/superadmin/SADashboardPage'
import SAHospitalsPage     from './pages/superadmin/SAHospitalsPage'
import SAHospitalDetailPage from './pages/superadmin/SAHospitalDetailPage'
import SAInvoicesPage      from './pages/superadmin/SAInvoicesPage'
import SAAnalyticsPage     from './pages/superadmin/SAAnalyticsPage'
import SASettingsPage      from './pages/superadmin/SASettingsPage'

const LegacyPrivateRoute = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore()
  const token = localStorage.getItem('token')

  // No token at all → go to login
  if (!token && !isAuthenticated) return <Navigate to="/login" replace />

  // Has token but store not hydrated yet → wait
  if (token && !user) return (
    <div className="flex h-screen items-center justify-center bg-navy-900">
      <div className="w-8 h-8 border-2 border-navy-500 border-t-cyan rounded-full animate-spin" />
    </div>
  )

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />
  return children
}

const LegacySuperAdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'SUPER_ADMIN') return <Navigate to="/" replace />
  return children
}

const SessionLoader = () => (
  <div className="flex h-screen flex-col items-center justify-center gap-3 bg-white text-slate-700">
    <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-pink-600 animate-spin" />
    <div className="text-sm font-medium">Opening MediCore HMS...</div>
  </div>
)

const useRestoreSession = () => {
  const { user, fetchMe } = useAuthStore()
  const [isRestoringSession, setIsRestoringSession] = useState(false)
  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token || user || isRestoringSession) return

    setIsRestoringSession(true)
    fetchMe()
      .catch(() => {})
      .finally(() => setIsRestoringSession(false))
  }, [fetchMe, isRestoringSession, token, user])

  return { token }
}

const PrivateRoute = ({ children, roles }) => {
  const { isAuthenticated, user } = useAuthStore()
  const { token } = useRestoreSession()

  if (!token && !isAuthenticated) return <Navigate to="/login" replace />
  if (token && !user) return <SessionLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />
  return children
}

const SuperAdminRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore()
  const { token } = useRestoreSession()

  if (token && !user) return <SessionLoader />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'SUPER_ADMIN') return <Navigate to="/" replace />
  return children
}

class ModuleErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.name !== this.props.name && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="card max-w-3xl mx-auto mt-8">
        <div className="text-base font-bold text-brand-red mb-2">{this.props.name} could not load</div>
        <div className="text-sm text-slate-400 mb-4">
          The module hit a browser render error. Refresh the page after the latest update is loaded.
        </div>
        <pre className="text-xs bg-white/80 border border-default rounded-lg p-3 overflow-auto max-h-40">
          {this.state.error?.message || 'Unknown render error'}
        </pre>
        <button className="btn-primary mt-4" onClick={() => window.location.reload()}>Reload module</button>
      </div>
    )
  }
}

const GuardedModule = ({ name, children }) => (
  <ModuleErrorBoundary name={name}>{children}</ModuleErrorBoundary>
)

const MODULE_HOME = {
  DASHBOARD: '/',
  ANALYTICS: '/analytics',
  PATIENTS: '/patients',
  APPOINTMENTS: '/appointments',
  MEDICINE_STACKS: '/medicine-stacks',
  EMR: '/emr',
  EMERGENCY: '/emergency',
  BEDS: '/beds',
  ICU: '/icu',
  OT: '/ot',
  RADIOLOGY: '/radiology',
  PHARMACY: '/pharmacy',
  BILLING: '/billing',
  BILLING_CONFIG: '/billing-config',
  INVENTORY: '/inventory',
  STAFF: '/staff',
  AMBULANCE: '/ambulance',
  DIETARY: '/dietary',
  MORTUARY: '/mortuary',
  COMPLIANCE: '/compliance',
  COMMUNICATION: '/communication',
  SETTINGS: '/settings',
}

const ModuleRoute = ({ module, children }) => {
  const { user } = useAuthStore()
  if (!hasModuleAccess(user, module)) {
    const fallback = (user?.allowed_modules || []).map(key => MODULE_HOME[key]).find(Boolean) || '/'
    return <Navigate to={fallback} replace />
  }
  return children
}

export default function App() {
  const { user, isAuthenticated } = useAuthStore()

  return (
    <Routes>
      {/* Auth */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={isAuthenticated ? <Navigate to={user?.role === 'SUPER_ADMIN' ? '/superadmin' : '/'} replace /> : <LoginPage />} />
      </Route>

      {/* Super Admin Panel */}
      <Route path="/superadmin" element={<SuperAdminRoute><SuperAdminLayout /></SuperAdminRoute>}>
        <Route index           element={<SADashboardPage />} />
        <Route path="hospitals" element={<SAHospitalsPage />} />
        <Route path="hospitals/:id" element={<SAHospitalDetailPage />} />
        <Route path="invoices"  element={<SAInvoicesPage />} />
        <Route path="analytics" element={<SAAnalyticsPage />} />
        <Route path="settings"  element={<SASettingsPage />} />
      </Route>

      {/* Hospital HMS */}
      <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route index                    element={<ModuleRoute module="DASHBOARD"><DashboardPage /></ModuleRoute>} />
        <Route path="patients"          element={<ModuleRoute module="PATIENTS"><PatientsPage /></ModuleRoute>} />
        <Route path="patients/:id"      element={<ModuleRoute module="PATIENTS"><PatientDetailPage /></ModuleRoute>} />
        <Route path="appointments"      element={<ModuleRoute module="APPOINTMENTS"><AppointmentsPage /></ModuleRoute>} />
        <Route path="emr"               element={<ModuleRoute module="EMR"><EMRPage /></ModuleRoute>} />
        <Route path="emr/:patientId"    element={<ModuleRoute module="EMR"><EMRPage /></ModuleRoute>} />
        <Route path="beds"              element={<ModuleRoute module="BEDS"><BedsPage /></ModuleRoute>} />
        <Route path="icu"               element={<ModuleRoute module="ICU"><ICUPage /></ModuleRoute>} />
        <Route path="ot"                element={<ModuleRoute module="OT"><OTPage /></ModuleRoute>} />
        <Route path="emergency"         element={<ModuleRoute module="EMERGENCY"><GuardedModule name="Emergency"><EmergencyPage /></GuardedModule></ModuleRoute>} />
        <Route path="radiology"         element={<ModuleRoute module="RADIOLOGY"><GuardedModule name="Radiology"><RadiologyPage /></GuardedModule></ModuleRoute>} />
        <Route path="pharmacy"          element={<ModuleRoute module="PHARMACY"><GuardedModule name="Pharmacy"><PharmacyPage /></GuardedModule></ModuleRoute>} />
        <Route path="medicine-stacks"   element={<ModuleRoute module="MEDICINE_STACKS"><MedicineStacksPage /></ModuleRoute>} />
        <Route path="billing"           element={<ModuleRoute module="BILLING"><BillingPage /></ModuleRoute>} />
        <Route path="billing-config"    element={<ModuleRoute module="BILLING_CONFIG"><BillingConfigPage /></ModuleRoute>} />
        <Route path="inventory"         element={<ModuleRoute module="INVENTORY"><InventoryPage /></ModuleRoute>} />
        <Route path="staff"             element={<ModuleRoute module="STAFF"><StaffPage /></ModuleRoute>} />
        <Route path="ambulance"         element={<ModuleRoute module="AMBULANCE"><AmbulancePage /></ModuleRoute>} />
        <Route path="dietary"           element={<ModuleRoute module="DIETARY"><DietaryPage /></ModuleRoute>} />
        <Route path="compliance"        element={<ModuleRoute module="COMPLIANCE"><CompliancePage /></ModuleRoute>} />
        <Route path="analytics"         element={<ModuleRoute module="ANALYTICS"><AnalyticsPage /></ModuleRoute>} />
        <Route path="mortuary"          element={<ModuleRoute module="MORTUARY"><MortuaryPage /></ModuleRoute>} />
        <Route path="communication"     element={<ModuleRoute module="COMMUNICATION"><CommunicationPage /></ModuleRoute>} />
        <Route path="settings"          element={<ModuleRoute module="SETTINGS"><SettingsPage /></ModuleRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
