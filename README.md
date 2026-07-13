# 🏥 MediCore HMS — Complete Hospital Management System

> **Enterprise-grade Hospital Management System with Multi-Tenant SaaS Admin Panel**
> Version 1.0.0 | Built with React + Node.js + PostgreSQL

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Prerequisites](#prerequisites)
5. [Installation & Setup](#installation--setup)
6. [Environment Variables](#environment-variables)
7. [Database Setup](#database-setup)
8. [Running the Project](#running-the-project)
9. [Super Admin Panel](#super-admin-panel)
10. [Modules Overview](#modules-overview)
11. [API Documentation](#api-documentation)
12. [Deployment Guide](#deployment-guide)
13. [License](#license)

---

## Project Overview

MediCore HMS is a **multi-tenant SaaS platform** where:
- **You (the company)** own the Super Admin panel — add hospitals, manage licenses, monitor all tenants
- **Each hospital** gets their own isolated HMS instance with full 22-module system
- **Staff, Doctors, Nurses, Patients** each have role-specific dashboards

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| State Management | Zustand + React Query |
| Backend | Node.js + Express.js |
| Database | PostgreSQL 15 via Prisma ORM |
| Authentication | JWT + bcryptjs + Refresh Tokens |
| Real-time | Socket.io (ICU vitals, alerts) |
| File Storage | AWS S3 / Local (configurable) |
| Email | Nodemailer + SendGrid |
| SMS/WhatsApp | Twilio API |
| Charts | Recharts |
| PDF Generation | Puppeteer |
| Deployment | Docker + Docker Compose |

---

## Project Structure

```
medicore/
├── frontend/                    # React Vite Application
│   ├── public/
│   │   └── favicon.ico
│   ├── src/
│   │   ├── assets/              # Images, fonts, icons
│   │   ├── components/          # Reusable UI components
│   │   │   ├── common/          # Button, Input, Modal, Table, etc.
│   │   │   ├── dashboard/       # Dashboard widgets
│   │   │   ├── patients/        # Patient management components
│   │   │   ├── appointments/    # Scheduling components
│   │   │   ├── emr/             # Electronic Medical Records
│   │   │   ├── beds/            # Bed management & floor map
│   │   │   ├── icu/             # ICU monitoring
│   │   │   ├── ot/              # Operation Theatre
│   │   │   ├── lab/             # Laboratory
│   │   │   ├── pharmacy/        # Pharmacy management
│   │   │   ├── billing/         # Billing & insurance
│   │   │   ├── emergency/       # Emergency & triage
│   │   │   ├── staff/           # Staff management
│   │   │   ├── radiology/       # Radiology & imaging
│   │   │   ├── inventory/       # Inventory & assets
│   │   │   ├── ambulance/       # Ambulance dispatch
│   │   │   ├── dietary/         # Dietary management
│   │   │   ├── compliance/      # Audit & compliance
│   │   │   ├── analytics/       # Reports & analytics
│   │   │   └── superadmin/      # Super Admin SaaS panel
│   │   ├── context/             # React Context (Auth, Theme)
│   │   ├── hooks/               # Custom React hooks
│   │   ├── pages/               # Page-level components
│   │   ├── routes/              # React Router config
│   │   ├── utils/               # Helpers, formatters, constants
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
│
├── backend/                     # Node.js Express API
│   ├── prisma/
│   │   ├── schema.prisma        # Full DB schema (all 22 modules)
│   │   └── seed.js              # Seed data for testing
│   └── src/
│       ├── config/
│       │   ├── db.js            # Prisma client
│       │   ├── socket.js        # Socket.io setup
│       │   └── storage.js       # S3 / local storage
│       ├── controllers/         # Route handlers (one per module)
│       ├── middleware/
│       │   ├── auth.js          # JWT verification
│       │   ├── rbac.js          # Role-based access control
│       │   ├── tenant.js        # Multi-tenant isolation
│       │   ├── rateLimit.js     # API rate limiting
│       │   └── errorHandler.js  # Global error handler
│       ├── models/              # Prisma model helpers
│       ├── routes/              # Express router (one per module)
│       ├── services/            # Business logic layer
│       ├── utils/               # PDF, SMS, email helpers
│       ├── app.js               # Express app setup
│       └── server.js            # Entry point
│   ├── .env.example
│   └── package.json
│
├── docs/
│   ├── API.md                   # Full API reference
│   ├── DATABASE.md              # Schema documentation
│   ├── DEPLOYMENT.md            # Production deployment guide
│   └── SUPERADMIN.md            # SaaS admin guide
│
├── docker-compose.yml           # Full stack Docker setup
├── .gitignore
└── README.md
```

---

## Prerequisites

Install these before starting:

| Tool | Version | Download |
|------|---------|----------|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | Comes with Node |
| PostgreSQL | 15+ | https://postgresql.org |
| Git | Any | https://git-scm.com |
| Docker (optional) | 24+ | https://docker.com |

---

## Installation & Setup

### Step 1 — Clone / Download

```bash
# If using git
git clone https://github.com/yourcompany/medicore-hms.git
cd medicore-hms

# OR extract downloaded ZIP and cd into folder
```

### Step 2 — Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials (see Environment Variables section)
nano .env

# Generate Prisma client
npx prisma generate

# Run database migrations (creates all tables)
npx prisma migrate dev --name init

# Create the Super Admin account (no hospital or demo data is added)
npm run seed

# For an existing client database: erase all hospitals and application data,
# then recreate only the Super Admin account
npm run reset:clean

# Start backend server
npm run dev
# Backend runs on http://localhost:5000
```

### Step 3 — Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit frontend .env
nano .env

# Start frontend dev server
npm run dev
# Frontend runs on http://localhost:5173
```

### Step 4 — First Login

After seeding, only this platform-owner account is available. Create the first hospital and its staff from the Super Admin panel.

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@medicore.com | MediCore@2026 |

---

## Environment Variables

### Backend `.env`

```env
# Server
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

# Database (PostgreSQL)
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/medicore_db"

# JWT Secrets (change these in production — use 64+ char random strings)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_REFRESH_SECRET=your_refresh_secret_key_change_this_too
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Super Admin (your company credentials)
SUPER_ADMIN_EMAIL=superadmin@medicore.com
SUPER_ADMIN_PASSWORD=MediCore@2026

# Email (SendGrid or SMTP)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=noreply@medicore.com

# Twilio (SMS & WhatsApp) — optional
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE=+1234567890
TWILIO_WHATSAPP=whatsapp:+14155238886

# File Storage
STORAGE_TYPE=local        # 'local' or 's3'
UPLOAD_DIR=./uploads
# If using S3:
AWS_ACCESS_KEY=your_aws_key
AWS_SECRET_KEY=your_aws_secret
AWS_BUCKET=medicore-uploads
AWS_REGION=ap-south-1

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200

# Socket.io
SOCKET_CORS_ORIGIN=http://localhost:5173
```

### Frontend `.env`

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_APP_NAME=MediCore HMS
VITE_COMPANY_NAME=MediCore Technologies
```

---

## Database Setup

### Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb medicore_db
sudo -u postgres createuser medicore_user --pwprompt
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE medicore_db TO medicore_user;"
```

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
createdb medicore_db
```

**Windows:**
Download installer from https://postgresql.org/download/windows/

### Run Migrations

```bash
cd backend
npx prisma migrate dev --name init
npx prisma studio   # Optional: visual DB editor at http://localhost:5555
```

---

## Running the Project

### Development (Manual)

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

### Development (Docker — Recommended)

```bash
# From root of project
docker-compose up --build

# Services started:
# - PostgreSQL:  localhost:5432
# - Backend API: localhost:5000
# - Frontend:    localhost:5173
# - Prisma Studio: localhost:5555 (dev only)
```

---

## Super Admin Panel

As the **company owner (you)**, you have a dedicated Super Admin dashboard at:

```
http://localhost:5173/superadmin
Login: superadmin@medicore.com / MediCore@2026
```

### What Super Admin Can Do:
- ✅ Add new hospitals (tenants) to the platform
- ✅ Set license type: Basic / Professional / Enterprise
- ✅ Set license expiry date — hospital loses access when expired
- ✅ Enable/disable specific modules per hospital
- ✅ View all hospitals' usage statistics
- ✅ Monitor revenue, active users, storage across all tenants
- ✅ Suspend or reactivate any hospital
- ✅ Create/reset admin accounts for hospitals
- ✅ View global analytics (total patients across all hospitals)
- ✅ Send announcements to all hospitals
- ✅ Manage billing and invoices for each hospital

---

## Modules Overview

| # | Module | Key Features |
|---|--------|-------------|
| 1 | Patient Management | UHID, QR wristband, family linking, allergy register, timeline |
| 2 | Appointments | Multi-doctor booking, queue management, teleconsult, no-show tracking |
| 3 | EMR | SOAP notes, ICD-10, vitals graphs, prescriptions, referrals |
| 4 | Bed Management | Interactive floor map, real-time status, admission/discharge workflow |
| 5 | ICU Dashboard | Live vitals, APACHE II/SOFA scores, nursing flowsheet, family bulletin |
| 6 | Operation Theatre | OT scheduling, pre-op checklist, WHO safety checklist, implant tracking |
| 7 | Emergency & Triage | 5-level triage, MLC flagging, mass casualty mode, resuscitation logs |
| 8 | Laboratory | Barcode tracking, STAT orders, critical value alerts, TAT reports |
| 9 | Radiology | DICOM-ready, imaging orders, report templates, critical findings |
| 10 | Pharmacy | Drug inventory, dispensing, expiry tracker, drug interaction alerts |
| 11 | Billing & Insurance | IPD/OPD billing, cashless claims, TPA management, GST reports |
| 12 | Inventory & Assets | Consumables, asset register, maintenance scheduler, QR tags |
| 13 | Staff & HR | Duty roster, attendance, leave management, payroll |
| 14 | Ambulance | Fleet tracking, GPS dispatch, trip logs, pre-arrival data |
| 15 | Dietary | Diet orders, kitchen management, allergy-aware meal planning |
| 16 | Compliance | NABH checklist, incident reporting, audit trail, CAPA |
| 17 | Analytics | Revenue, occupancy, quality metrics, department P&L |
| 18 | Mortuary | Body reception, death certification, release workflow |
| 19 | Telemedicine | Video consult, e-prescription, async messaging |
| 20 | Patient Portal | Self-booking, report access, bill payment, medication reminders |
| 21 | Communication | Internal chat, announcements, task management, helpdesk |
| 22 | Super Admin SaaS | Multi-tenant management, license control, global analytics |

---

## API Documentation

See `docs/API.md` for full endpoint reference.

Base URL: `http://localhost:5000/api`

Authentication: All endpoints require `Authorization: Bearer <token>` header except login.

Quick reference:
```
POST   /auth/login                    Login
POST   /auth/refresh                  Refresh token
GET    /patients                      List patients
POST   /patients                      Register patient
GET    /patients/:id                  Get patient
PUT    /patients/:id                  Update patient
GET    /appointments                  List appointments
POST   /appointments                  Book appointment
GET    /emr/:patientId                Get EMR
POST   /emr/:patientId/notes          Add SOAP note
POST   /emr/:patientId/prescriptions  Add prescription
GET    /beds                          Bed status
POST   /beds/admit                    Admit patient
POST   /beds/discharge                Discharge patient
GET    /icu/patients                  ICU patients list
GET    /lab/orders                    Lab orders
POST   /lab/orders                    Create lab order
GET    /pharmacy/inventory            Drug inventory
POST   /pharmacy/dispense             Dispense drug
GET    /billing/bills                 List bills
POST   /billing/bills                 Create bill
GET    /analytics/dashboard           Dashboard stats
GET    /superadmin/hospitals          All hospitals (Super Admin)
POST   /superadmin/hospitals          Add hospital (Super Admin)
```

---

## Deployment Guide

See `docs/DEPLOYMENT.md` for full production deployment steps.

### Quick Production Checklist:
- [ ] Change all `.env` secrets
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS (SSL certificate via Let's Encrypt)
- [ ] Set up PostgreSQL with strong password
- [ ] Configure S3 for file storage
- [ ] Set up SendGrid for transactional emails
- [ ] Configure Twilio for SMS alerts
- [ ] Enable daily database backups
- [ ] Set up monitoring (PM2 / Nginx)
- [ ] Run `npm run build` for frontend
- [ ] Set up reverse proxy (Nginx config in `docs/DEPLOYMENT.md`)

---

## License

This software is proprietary. Sold as a complete product by MediCore Technologies.
Each hospital license allows deployment on one server instance.
Multi-hospital/SaaS deployment requires Enterprise license.

For support: support@medicore.com
