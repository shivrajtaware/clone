# MediCore HMS — API Reference

Base URL: `http://localhost:5000/api`
Auth Header: `Authorization: Bearer <token>`

## Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/login | Login (returns token + refreshToken) |
| POST | /auth/refresh | Refresh access token |
| POST | /auth/logout | Logout (invalidates refresh token) |
| GET  | /auth/me | Get current user profile |
| PUT  | /auth/change-password | Change password |

## Patients
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /patients | List patients (search, gender, page, limit) |
| POST | /patients | Register new patient |
| GET  | /patients/search?q= | Quick search |
| GET  | /patients/:id | Get patient + full profile |
| PUT  | /patients/:id | Update patient |
| GET  | /patients/:id/timeline | Full medical timeline |

## Appointments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /appointments | List appointments (date, doctor_id, status) |
| POST | /appointments | Book appointment |
| GET  | /appointments/slots?doctor_id&date | Available time slots |
| GET  | /appointments/stats?date | Daily stats |
| PATCH| /appointments/:id/status | Update status |

## EMR
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /emr/:patientId | Full EMR (notes, vitals, prescriptions, allergies) |
| POST | /emr/:patientId/notes | Add SOAP note |
| POST | /emr/:patientId/vitals | Record vitals (auto-alerts critical values) |
| POST | /emr/:patientId/prescriptions | Create prescription |
| POST | /emr/:patientId/allergies | Add allergy |

## Beds
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /beds | All beds with status (ward filter) |
| GET  | /beds/wards | Ward list |
| POST | /beds/admit | Admit patient to bed |
| POST | /beds/discharge | Discharge patient |
| PATCH| /beds/:id/status | Update bed status |

## ICU
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /icu/patients | ICU patients with live vitals |
| GET  | /icu/flowsheets/:patientId | Nursing flowsheets |
| POST | /icu/flowsheets | Add flowsheet entry |
| POST | /icu/scores | Update ICU scores |

## OT
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /ot/rooms | OT rooms with status |
| GET  | /ot/schedule?date | Daily OT schedule |
| POST | /ot/schedule | Schedule surgery |
| PATCH| /ot/checklist/:id | Update WHO checklist |
| PATCH| /ot/:id/status | Update OT status |

## Emergency
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /emergency | Active emergency cases |
| POST | /emergency | Register emergency |
| PATCH| /emergency/:id | Update case |
| GET  | /emergency/stats | Triage statistics |

## Lab
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /lab/orders | Lab orders (status, is_stat filters) |
| POST | /lab/orders | Create lab order |
| PATCH| /lab/orders/:id/collect | Mark sample collected |
| PATCH| /lab/orders/:id/results | Enter results |
| PATCH| /lab/orders/:id/verify | Verify & report |
| GET  | /lab/stats | Lab statistics |

## Radiology
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /radiology/orders | Imaging orders |
| POST | /radiology/orders | Create imaging order |
| PATCH| /radiology/orders/:id/report | Submit report |

## Pharmacy
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /pharmacy/inventory | Drug inventory |
| POST | /pharmacy/inventory | Add drug |
| PUT  | /pharmacy/inventory/:id | Update drug |
| POST | /pharmacy/inventory/:id/batch | Receive stock |
| POST | /pharmacy/dispense | Dispense drug (deducts stock) |
| GET  | /pharmacy/low-stock | Low stock items |
| GET  | /pharmacy/purchase-orders | PO list |
| POST | /pharmacy/purchase-orders | Create PO |

## Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /billing/bills | List bills (status, type, patient_id) |
| POST | /billing/bills | Generate bill |
| GET  | /billing/bills/:id | Get bill detail |
| POST | /billing/bills/:id/payment | Record payment |
| GET  | /billing/summary | Daily financial summary |

## Staff
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /staff | List staff (role, department_id, search) |
| POST | /staff | Add staff member |
| PUT  | /staff/:id | Update staff |
| GET  | /staff/roster | Duty roster |
| POST | /staff/roster | Add roster entry |
| GET  | /staff/leaves | Leave requests |
| POST | /staff/leaves | Apply for leave |
| PATCH| /staff/leaves/:id | Approve/reject leave |

## Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /analytics/dashboard | Dashboard KPIs |
| GET  | /analytics/revenue?year= | Monthly revenue data |
| GET  | /analytics/departments | Department stats |
| GET  | /analytics/quality-metrics | Quality indicators |

## Super Admin (requires SUPER_ADMIN role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /superadmin/stats | Global platform statistics |
| GET  | /superadmin/hospitals | All hospitals |
| POST | /superadmin/hospitals | Add hospital + admin account |
| GET  | /superadmin/hospitals/:id | Hospital detail |
| PUT  | /superadmin/hospitals/:id | Update hospital |
| PATCH| /superadmin/hospitals/:id/toggle | Activate/suspend |
| POST | /superadmin/hospitals/:id/extend-license | Extend license |
| PATCH| /superadmin/hospitals/:id/modules | Update enabled modules |
| GET  | /superadmin/invoices | All subscription invoices |
| PATCH| /superadmin/invoices/:id/mark-paid | Mark invoice paid |
| POST | /superadmin/announcements | Broadcast announcement |
