
Verify installation:
```bash
node --version
npm --version
psql --version
```

## ⚡ Quick Start (5 minutes)

### 1️⃣ Clone/Navigate to Project
```bash
cd medicore
```

### 2️⃣ Setup PostgreSQL Database
```sql
-- Using psql or pgAdmin:
CREATE DATABASE medicore_db;
CREATE USER medicore_user WITH PASSWORD 'medicore_pass';
GRANT ALL PRIVILEGES ON DATABASE medicore_db TO medicore_user;
```

### 3️⃣ Backend Setup & Run
```bash
cd backend
npm install
cp .env.example .env  # or: Copy-Item .env.example .env (Windows)
npx prisma migrate dev
npm run dev
```
✅ Backend runs on: `http://localhost:5000`

### 4️⃣ Frontend Setup & Run (New Terminal)
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
✅ Frontend runs on: `http://localhost:5173`

### 5️⃣ Access Application
- **Application**: http://localhost:5173
- **API Docs**: http://localhost:5000/api
- **Database Studio**: `npx prisma studio` (from backend folder)

### 🔑 Default Credentials
```
Email: superadmin@medicore.com
Password: MediCore@2026
```

---

## 📁 Project Structure

```
medicore/
├── backend/                    # Express.js API Server
│   ├── src/
│   │   ├── app.js             # Express app setup
│   │   ├── server.js          # Server entry point
│   │   ├── config/            # Configuration files
│   │   │   ├── db.js          # Database connection
│   │   │   └── socket.js      # WebSocket setup
│   │   ├── controllers/       # Business logic (authController, patientController, etc.)
│   │   ├── routes/            # API endpoints (ambulance, appointments, patients, etc.)
│   │   ├── middleware/        # Express middlewares (auth, rbac, errorHandler)
│   │   ├── services/          # Business services
│   │   └── utils/             # Helper functions (logger, etc.)
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   ├── seed.js            # Database seed script
│   │   └── migrations/        # Database migrations
│   ├── .env.example           # Environment variables template
│   ├── package.json
│   └── Dockerfile
│
├── frontend/                   # React + Vite Application
│   ├── src/
│   │   ├── App.jsx            # Main App component
│   │   ├── main.jsx           # Entry point
│   │   ├── index.css          # Global styles
│   │   ├── components/        # Reusable UI components
│   │   │   ├── common/        # AppLayout, Sidebar, Modal, etc.
│   │   │   ├── ambulance/     # Ambulance module components
│   │   │   ├── appointments/  # Appointments module components
│   │   │   ├── patients/      # Patients module components
│   │   │   ├── pharmacy/      # Pharmacy module components
│   │   │   ├── lab/           # Lab module components
│   │   │   └── ...            # Other modules
│   │   ├── pages/             # Page components (LabPage, PatientPage, etc.)
│   │   ├── routes/            # Route configuration
│   │   ├── context/           # State management (authStore, etc.)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── utils/
│   │   │   ├── api.js         # Axios API client
│   │   │   └── helpers.js     # Utility functions
│   │   ├── config/            # App configuration
│   │   └── assets/            # Images, icons, etc.
│   ├── public/
│   ├── .env.example           # Environment variables template
│   ├── vite.config.js         # Vite configuration
│   ├── tailwind.config.js     # Tailwind CSS config
│   ├── postcss.config.js      # PostCSS config
│   ├── package.json
│   ├── index.html
│   └── Dockerfile
│
├── docker-compose.yml         # Docker Compose configuration
├── README.md                  # Project README
└── SETUP_GUIDE.md            # This file

```

---

## 💻 Technology Stack

### **Backend**
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Validation**: express-validator
- **Real-time**: Socket.io
- **Security**: Helmet, CORS, Rate Limiting
- **Email**: Nodemailer
- **SMS/WhatsApp**: Twilio (optional)
- **Logging**: Winston
- **Monitoring**: Morgan HTTP request logger

### **Frontend**
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **State Management**: Zustand
- **Forms**: React Hook Form
- **Charts**: Recharts
- **UI Icons**: Lucide React
- **Notifications**: React Hot Toast
- **Query Management**: TanStack React Query

---

## 🗄️ Database Setup Details

### Create Database Manually
```bash
# Using psql:
psql -U postgres

# Inside psql:
CREATE DATABASE medicore_db;
CREATE USER medicore_user WITH PASSWORD 'medicore_pass';
ALTER ROLE medicore_user WITH CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE medicore_db TO medicore_user;
```

### Run Migrations
```bash
cd backend
npx prisma migrate dev --name init
```

### Seed Database (Optional)
```bash
cd backend
npm run seed
```

### View Database with Prisma Studio
```bash
cd backend
npx prisma studio
```
Opens: `http://localhost:5555` - Visual database explorer

---

## 🚀 Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Production Mode

**Build Frontend:**
```bash
cd frontend
npm run build
```

**Run Backend (Production):**
```bash
cd backend
npm start
```

### Using Docker Compose
```bash
cd medicore
docker-compose up --build
```

---

## ✨ Key Features

### 📋 Core Modules
- **Patient Management** - Patient registration, history, medical records
- **Appointments** - Schedule, manage, and track appointments
- **EMR (Electronic Medical Records)** - Digital patient health records
- **Pharmacy** - Inventory, prescriptions, medication tracking
- **Lab** - Test management and results tracking
- **Billing** - Invoice generation and payment tracking
- **Staff Management** - Employee profiles and schedules
- **ICU Management** - Intensive care unit operations
- **OT (Operation Theatre)** - Surgery scheduling and management
- **Ambulance** - Fleet management and allocation
- **Beds Management** - Hospital bed allocation and tracking
- **Dietary** - Meal planning and nutrition management
- **Compliance** - Regulatory compliance tracking
- **Analytics & Dashboard** - Real-time metrics and reporting
- **Communication** - Internal messaging system
- **Radiology** - X-ray and imaging management
- **Mortuary** - Post-mortem management

### 🔐 Security Features
- JWT-based authentication
- Role-Based Access Control (RBAC)
- Password encryption with bcryptjs
- Rate limiting for API endpoints
- CORS protection
- Helmet for HTTP headers security

### 📱 Real-time Features
- WebSocket support (Socket.io)
- Live notifications
- Real-time data updates

---

## 📝 Common Commands

### Backend
```bash
cd backend

# Development
npm run dev              # Start dev server with auto-reload

# Database
npx prisma migrate dev  # Run migrations
npx prisma generate    # Generate Prisma client
npx prisma studio      # Open database UI
npm run seed            # Seed database with sample data

# Production
npm start               # Start production server
npm run prisma:migrate # Run migrations in production
```

### Frontend
```bash
cd frontend

# Development
npm run dev             # Start dev server

# Build
npm run build           # Build for production
npm run preview         # Preview production build locally

# Linting
npm run lint            # Run ESLint
```

---

## 🐛 Troubleshooting

### **Port Already in Use**
```bash
# Kill process on port 5000 (backend):
npx kill-port 5000

# Kill process on port 5173 (frontend):
npx kill-port 5173
```

### **Database Connection Error**
- Verify PostgreSQL is running
- Check `.env` DATABASE_URL is correct
- Ensure database and user exist

### **Module Not Found**
```bash
# Reinstall dependencies:
rm -rf node_modules package-lock.json
npm install
```

### **Prisma Migration Error**
```bash
cd backend
npx prisma migrate resolve --rolled-back
npx prisma migrate dev
```

### **Port 5000/5173 Already Used**
Change in `.env` or use different ports:
```bash
# Backend: PORT=5001
# Frontend: Update vite.config.js
```

---

## 📚 Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://medicore_user:medicore_pass@localhost:5432/medicore_db
JWT_SECRET=your_secret_here_64_chars_minimum
JWT_REFRESH_SECRET=your_refresh_secret_64_chars_min
SUPER_ADMIN_EMAIL=superadmin@medicore.com
SUPER_ADMIN_PASSWORD=MediCore@2026
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_APP_NAME=MediCore HMS
VITE_COMPANY_NAME=MediCore Technologies
```

---

## 🔗 Useful Links

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Prisma Studio**: http://localhost:5555
- **GitHub**: https://github.com/shivrajtaware/Medicore

---

## 📞 Support

For issues or questions, check:
1. This SETUP_GUIDE.md
2. Backend `README.md` for API documentation
3. GitHub Issues

---

**Happy coding! 🚀**

Last Updated: May 16, 2026
