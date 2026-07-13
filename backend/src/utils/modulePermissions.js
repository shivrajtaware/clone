const ALL_MODULES = [
  'DASHBOARD',
  'ANALYTICS',
  'PATIENTS',
  'APPOINTMENTS',
  'MEDICINE_STACKS',
  'EMR',
  'EMERGENCY',
  'BEDS',
  'ICU',
  'OT',
  'LAB',
  'RADIOLOGY',
  'PHARMACY',
  'BILLING',
  'BILLING_CONFIG',
  'INVENTORY',
  'STAFF',
  'AMBULANCE',
  'DIETARY',
  'MORTUARY',
  'COMPLIANCE',
  'COMMUNICATION',
  'SETTINGS',
];

const ROLE_DEFAULT_MODULES = {
  SUPER_ADMIN: ALL_MODULES,
  HOSPITAL_ADMIN: ALL_MODULES,
  DOCTOR: ['DASHBOARD', 'PATIENTS', 'APPOINTMENTS', 'MEDICINE_STACKS', 'EMR', 'BEDS', 'ICU', 'OT', 'LAB', 'RADIOLOGY', 'PHARMACY', 'COMMUNICATION'],
  NURSE: ['DASHBOARD', 'PATIENTS', 'APPOINTMENTS', 'EMR', 'BEDS', 'ICU', 'OT', 'EMERGENCY', 'PHARMACY', 'COMMUNICATION'],
  RECEPTIONIST: ['DASHBOARD', 'PATIENTS', 'APPOINTMENTS', 'BILLING', 'AMBULANCE', 'COMMUNICATION'],
  LAB_TECHNICIAN: ['DASHBOARD', 'PATIENTS', 'EMR', 'COMMUNICATION'],
  PHARMACIST: ['DASHBOARD', 'PHARMACY', 'BILLING', 'COMMUNICATION'],
  HR_MANAGER: ['DASHBOARD', 'STAFF', 'AMBULANCE', 'DIETARY', 'COMMUNICATION'],
  ACCOUNTANT: ['DASHBOARD', 'BILLING', 'BILLING_CONFIG', 'ANALYTICS'],
  PATIENT_PORTAL: ['DASHBOARD', 'APPOINTMENTS', 'EMR', 'BILLING'],
};

const normalizeModules = (modules = []) => (
  [...new Set((Array.isArray(modules) ? modules : [])
    .map(module => String(module).trim().toUpperCase())
    .filter(module => ALL_MODULES.includes(module)))]
);

const defaultModulesForRole = (role) => ROLE_DEFAULT_MODULES[role] || ['DASHBOARD'];

const getAllowedModules = async (prisma, user) => {
  if (!user) return [];
  if (user.role === 'SUPER_ADMIN' || user.role === 'HOSPITAL_ADMIN') return ALL_MODULES;
  if (!user.hospital_id) return defaultModulesForRole(user.role);

  const [permission] = await prisma.$queryRaw`
    SELECT modules
    FROM role_module_permissions
    WHERE hospital_id = ${user.hospital_id} AND role::text = ${user.role}
    LIMIT 1
  `;

  return permission ? normalizeModules(permission.modules) : defaultModulesForRole(user.role);
};

module.exports = {
  ALL_MODULES,
  ROLE_DEFAULT_MODULES,
  defaultModulesForRole,
  getAllowedModules,
  normalizeModules,
};
