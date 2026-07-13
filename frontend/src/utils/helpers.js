// src/utils/helpers.js
import { format, formatDistanceToNow, differenceInYears } from 'date-fns'

export const fmt = {
  date:     (d) => d ? format(new Date(d), 'dd MMM yyyy') : '—',
  time:     (d) => d ? format(new Date(d), 'hh:mm a') : '—',
  datetime: (d) => d ? format(new Date(d), 'dd MMM yyyy, hh:mm a') : '—',
  ago:      (d) => d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '—',
  age:      (dob) => dob ? `${differenceInYears(new Date(), new Date(dob))} yrs` : '—',
  currency: (n) => n !== null && n !== undefined ? `₹${parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })}` : '₹0',
  pct:      (n) => `${parseFloat(n || 0).toFixed(1)}%`,
  name:     (u) => u ? `${u.first_name} ${u.last_name}` : '—',
}

export const BLOOD_GROUPS = ['A_POS','A_NEG','B_POS','B_NEG','O_POS','O_NEG','AB_POS','AB_NEG']
export const BG_DISPLAY   = { A_POS:'A+', A_NEG:'A−', B_POS:'B+', B_NEG:'B−', O_POS:'O+', O_NEG:'O−', AB_POS:'AB+', AB_NEG:'AB−' }
export const GENDERS      = ['MALE','FEMALE','OTHER']
export const USER_ROLES   = ['HOSPITAL_ADMIN','DOCTOR','NURSE','RECEPTIONIST','PHARMACIST','HR_MANAGER','ACCOUNTANT','PATIENT_PORTAL']
export const ROLE_LABELS  = { SUPER_ADMIN:'Super Admin', HOSPITAL_ADMIN:'Hospital Admin', DOCTOR:'Doctor', NURSE:'Nurse', RECEPTIONIST:'Receptionist', PHARMACIST:'Pharmacist', HR_MANAGER:'HR Manager', ACCOUNTANT:'Accountant', PATIENT_PORTAL:'Patient' }
export const TRIAGE_COLORS = { RED:'text-brand-red bg-brand-red/10', ORANGE:'text-orange-400 bg-orange-400/10', YELLOW:'text-brand-amber bg-brand-amber/10', GREEN:'text-brand-green bg-brand-green/10', BLUE:'text-brand-blue bg-brand-blue/10' }
export const STATUS_COLORS = {
  AVAILABLE:'badge-green', OCCUPIED:'badge-red', CLEANING:'badge-amber', RESERVED:'badge-blue', MAINTENANCE:'badge-gray',
  ADMITTED:'badge-cyan', DISCHARGED:'badge-green', EXPIRED:'badge-gray',
  BOOKED:'badge-gray', CONFIRMED:'badge-blue', CHECKED_IN:'badge-amber', IN_CONSULTATION:'badge-purple', COMPLETED:'badge-green', NO_SHOW:'badge-red', CANCELLED:'badge-gray',
  ACTIVE:'badge-green', INACTIVE:'badge-gray', SUSPENDED:'badge-red',
  BASIC:'badge-gray', PROFESSIONAL:'badge-blue', ENTERPRISE:'badge-purple',
  ORDERED:'badge-gray', COLLECTED:'badge-blue', PROCESSING:'badge-amber', RESULTED:'badge-cyan', VERIFIED:'badge-green', REPORTED:'badge-green', REJECTED:'badge-red',
  PAID:'badge-green', PARTIAL_PAID:'badge-amber', PENDING:'badge-amber', OVERDUE:'badge-red', DRAFT:'badge-gray', GENERATED:'badge-blue',
}

export const getStatusBadge = (status) => STATUS_COLORS[status] || 'badge-gray'
export const getInitials = (firstName, lastName) => `${(firstName||'')[0]||''}${(lastName||'')[0]||''}`.toUpperCase()
export const avatarColors = ['bg-gradient-to-br from-cyan to-cyan-dark','bg-gradient-to-br from-brand-purple to-brand-pink','bg-gradient-to-br from-brand-green to-cyan','bg-gradient-to-br from-brand-amber to-brand-red','bg-gradient-to-br from-brand-blue to-brand-purple']
export const getAvatarColor = (str) => avatarColors[(str?.charCodeAt(0) || 0) % avatarColors.length]

export const MODULES = [
  { key:'DASHBOARD',       label:'Dashboard' },
  { key:'ANALYTICS',       label:'Analytics' },
  { key:'PATIENTS',        label:'Patient Management' },
  { key:'APPOINTMENTS',    label:'Appointments' },
  { key:'MEDICINE_STACKS', label:'Medicine Stacks' },
  { key:'EMR',             label:'EMR / Medical Records' },
  { key:'EMERGENCY',       label:'Emergency & Triage' },
  { key:'BEDS',            label:'Bed Management' },
  { key:'ICU',             label:'ICU Dashboard' },
  { key:'OT',              label:'Operation Theatre' },
  { key:'RADIOLOGY',       label:'Radiology' },
  { key:'PHARMACY',        label:'Pharmacy' },
  { key:'BILLING',         label:'Billing & Insurance' },
  { key:'BILLING_CONFIG',  label:'Billing Config' },
  { key:'INVENTORY',       label:'Inventory & Assets' },
  { key:'STAFF',           label:'Staff & HR' },
  { key:'AMBULANCE',       label:'Ambulance' },
  { key:'DIETARY',         label:'Dietary' },
  { key:'COMPLIANCE',      label:'Compliance & Audit' },
  { key:'MORTUARY',        label:'Mortuary' },
  { key:'COMMUNICATION',   label:'Communication' },
  { key:'SETTINGS',        label:'Settings' },
]

export const hasModuleAccess = (user, moduleKey) => {
  if (!user) return false
  if (['SUPER_ADMIN', 'HOSPITAL_ADMIN'].includes(user.role)) return true
  return (user.allowed_modules || []).includes(moduleKey)
}
