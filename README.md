# SOFAST Web Application

SOFAST is a Point of Sale (POS) system migrated from a legacy Visual Basic desktop application to a modern, robust, and scalable web architecture.

This repository contains the decoupled full-stack architecture foundation, structured into a React (Vite) frontend and a Node.js / Express backend with MongoDB readiness.

---

## 1. Project Overview

The SOFAST web system modernizes POS operations with:
- **Clean Separation of Concerns**: Fully decoupled frontend client and RESTful backend service.
- **Modern Development Experience**: Fast module replacement with Vite and automated server reloading.
- **Robust API Architecture**: Centralized Axios client, structured Express routes, middleware, and standard error handling.
- **Database Readiness**: Mongoose ODM configuration with environment-driven connections.

---

## 2. Technology Stack

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: JavaScript (ES Modules)
- **Routing**: React Router (`react-router-dom`)
- **HTTP Client**: Axios (configured in `frontend/src/services/api.js`)

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database ODM**: Mongoose (MongoDB)
- **Environment Management**: `dotenv`
- **Security & Utilities**: `cors`
- **Development Tooling**: `nodemon`

### Root & Tooling
- **Orchestration**: `concurrently` (runs frontend and backend concurrently in development)

---

## 3. Project Structure

```
SOFAST/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/          # Static assets (images, icons, styles)
│   │   ├── components/      # Reusable UI components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── layouts/         # Page and layout wrappers
│   │   ├── services/        # Centralized API service & Axios instance
│   │   │   └── api.js
│   │   ├── utils/           # Helper functions and utilities
│   │   ├── App.jsx          # Root application component
│   │   ├── index.css        # Base styles
│   │   └── main.jsx         # React application entry point
│   ├── .env.example         # Frontend environment template
│   ├── .gitignore           # Frontend Git ignore rules
│   ├── index.html           # HTML template
│   ├── package.json         # Frontend dependencies and scripts
│   └── vite.config.js       # Vite configuration
│
├── backend/
│   ├── src/
│   │   ├── config/          # Database and service configurations
│   │   │   └── database.js
│   │   ├── controllers/     # Route controllers (future business logic)
│   │   ├── middleware/      # Error handler and 404 middleware
│   │   │   ├── errorHandler.js
│   │   │   └── notFoundHandler.js
│   │   ├── models/          # Mongoose data schemas
│   │   ├── routes/          # API route definitions
│   │   │   ├── health.routes.js
│   │   │   └── index.js
│   │   ├── services/        # Business logic services
│   │   ├── utils/           # Backend helper functions
│   │   └── server.js        # Express application entry point
│   ├── .env.example         # Backend environment template
│   ├── .gitignore           # Backend Git ignore rules
│   └── package.json         # Backend dependencies and scripts
│
├── .gitignore               # Root Git ignore rules
├── package.json             # Root workspace scripts & dev tooling
└── README.md                # Project documentation
```

---

## 4. How to Install Dependencies

You can install all dependencies (root, backend, and frontend) in one step from the project root:

```bash
npm run install:all
```

Alternatively, you can install each package individually:

```bash
# Root dependencies (concurrently)
npm install

# Backend dependencies
cd backend
npm install
cd ..

# Frontend dependencies
cd frontend
npm install
cd ..
```

---

## 5. How to Configure Environment Variables

Both backend and frontend utilize environment variables. Sample templates are provided as `.env.example`.

### Backend Configuration
Create a `.env` file inside the `backend/` directory:

```bash
cp backend/.env.example backend/.env
```

Contents of `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sofast
```

### Frontend Configuration
Create a `.env` file inside the `frontend/` directory:

```bash
cp frontend/.env.example frontend/.env
```

Contents of `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 6. How to Start Frontend and Backend

### Option A: Run Concurrently from Root (Recommended)
From the root `SOFAST/` directory, start both the backend server and Vite frontend server simultaneously:

```bash
npm run dev
```

### Option B: Run Individually
Start backend only:
```bash
npm run dev:backend
# or: cd backend && npm run dev
```

Start frontend only:
```bash
npm run dev:frontend
# or: cd frontend && npm run dev
```

- **Frontend URL**: [http://localhost:5173](http://localhost:5173)
- **Backend URL**: [http://localhost:5000](http://localhost:5000)

---

## 7. API Health-Check Endpoint

The backend provides a standardized health check endpoint to verify server readiness:

- **Method**: `GET`
- **Endpoint**: `/api/health`
- **Full URL**: `http://localhost:5000/api/health`

### Expected Response:
```json
{
  "success": true,
  "message": "SOFAST API is running"
}
```
