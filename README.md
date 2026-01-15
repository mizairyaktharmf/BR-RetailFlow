# BR-RetailFlow

**Ice Cream Inventory & Analytics Solution for Baskin Robbins UAE**

A comprehensive inventory tracking and analytics system designed to help Baskin Robbins (Galadari franchise) in UAE track flavor movement across all branches, enabling data-driven ordering decisions.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Solution Overview](#solution-overview)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [User Roles & Permissions](#user-roles--permissions)
- [Features](#features)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Installation](#installation)
- [Deployment](#deployment)
- [Development Progress](#development-progress)
- [Contributing](#contributing)

---

## Problem Statement

Baskin Robbins UAE faces a critical inventory management challenge:

- **POS Limitation**: Current POS system only records transaction types (kid's scoop, value scoop) - NOT the specific flavor sold
- **Poor Visibility**: Management cannot identify which flavors are fast-moving vs slow-moving
- **Inefficient Ordering**: Results in over-ordering slow flavors and under-ordering popular ones
- **Financial Impact**: Leads to wastage and stockouts across 1000+ branches

---

## Solution Overview

BR-RetailFlow solves this through daily inventory tracking:

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    DAILY WORKFLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MORNING (Opening)                                               │
│  ─────────────────                                               │
│  • System auto-loads previous day's closing as today's opening  │
│  • Steward verifies/adjusts if needed                           │
│                                                                  │
│  DURING DAY                                                      │
│  ──────────                                                      │
│  • Record any new tub receipts from warehouse                   │
│  • Each tub = 10 inches (standard size)                         │
│                                                                  │
│  END OF DAY (Closing)                                           │
│  ─────────────────────                                          │
│  • Steward measures remaining inches in each tub                │
│  • Enters closing inventory                                      │
│  • System calculates: Consumed = Opening + Received - Closing   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Calculation

```
Daily Consumption = Opening Stock + Tubs Received - Closing Stock

Example:
  Opening:  8 inches (Praline)
  Received: 10 inches (1 new tub)
  Closing:  5 inches
  ─────────────────────
  Consumed: 13 inches sold that day
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     BR-RetailFlow Architecture                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │   STEWARD APP    │         │  ADMIN DASHBOARD │              │
│  │  (Mobile PWA)    │         │   (Web App)      │              │
│  │                  │         │                  │              │
│  │  • Offline-first │         │  • Analytics     │              │
│  │  • Daily entry   │         │  • Reports       │              │
│  │  • Simple UI     │         │  • Management    │              │
│  └────────┬─────────┘         └────────┬─────────┘              │
│           │                            │                         │
│           │         ┌──────────────────┘                         │
│           │         │                                            │
│           ▼         ▼                                            │
│  ┌─────────────────────────────────────────┐                    │
│  │            FASTAPI BACKEND              │                    │
│  │                                         │                    │
│  │  • REST API                             │                    │
│  │  • JWT Authentication                   │                    │
│  │  • Role-based Access Control            │                    │
│  │  • Data Validation                      │                    │
│  └─────────────────┬───────────────────────┘                    │
│                    │                                             │
│                    ▼                                             │
│  ┌─────────────────────────────────────────┐                    │
│  │           POSTGRESQL DATABASE           │                    │
│  │                                         │                    │
│  │  • Users & Roles                        │                    │
│  │  • Branches & Hierarchy                 │                    │
│  │  • Inventory Records                    │                    │
│  │  • Flavor Master Data                   │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  DEPLOYMENT                                                      │
│  • Backend: AWS EC2 (Free Tier)                                 │
│  • Frontend: Vercel (Free Tier)                                 │
│  • Database: PostgreSQL on EC2                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 14 (JavaScript) | Web applications |
| **Backend** | FastAPI (Python) | REST API |
| **Database** | PostgreSQL | Primary data store |
| **Cache** | Redis (optional) | Session management |
| **Monorepo** | Turborepo | Build system |
| **Deployment** | AWS EC2 + Vercel | Hosting |

---

## Project Structure

```
BR-RetailFlow/
├── apps/
│   ├── steward-app/          # Mobile-first PWA for stewards
│   │   ├── components/       # React components
│   │   ├── pages/            # Next.js pages
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API services
│   │   ├── store/            # Offline storage (IndexedDB)
│   │   └── styles/           # CSS modules
│   │
│   ├── admin-dashboard/      # Admin web application
│   │   ├── components/       # React components
│   │   ├── pages/            # Next.js pages
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API services
│   │   └── styles/           # CSS modules
│   │
│   └── api/                  # FastAPI backend
│       ├── routers/          # API route handlers
│       ├── models/           # SQLAlchemy models
│       ├── schemas/          # Pydantic schemas
│       ├── services/         # Business logic
│       ├── utils/            # Utility functions
│       ├── scripts/          # DB scripts (seed, migrate)
│       ├── main.py           # Application entry point
│       └── requirements.txt  # Python dependencies
│
├── packages/
│   ├── ui/                   # Shared UI components
│   │   └── components/       # Reusable React components
│   │
│   └── shared/               # Shared utilities
│       ├── utils/            # Helper functions
│       └── constants/        # Shared constants
│
├── docs/                     # Documentation
│   ├── API.md                # API documentation
│   ├── DATABASE.md           # Database schema details
│   └── DEPLOYMENT.md         # Deployment guide
│
├── package.json              # Root package.json
├── turbo.json                # Turborepo config
└── README.md                 # This file
```

---

## User Roles & Permissions

### Role Hierarchy

```
Supreme Admin (Office/HQ)
    │
    └── Super Admin (Territory Manager)
            │
            └── Admin (Area Manager)
                    │
                    └── Staff (Branch Steward)
```

### Permission Matrix

| Feature | Staff | Admin | Super Admin | Supreme Admin |
|---------|-------|-------|-------------|---------------|
| Enter daily inventory | Own branch | ❌ | ❌ | ❌ |
| View own branch data | ✅ | ✅ | ✅ | ✅ |
| View area branches | ❌ | ✅ | ✅ | ✅ |
| View territory data | ❌ | ❌ | ✅ | ✅ |
| View all UAE data | ❌ | ❌ | ❌ | ✅ |
| Manage staff | ❌ | ✅ | ✅ | ✅ |
| Manage admins | ❌ | ❌ | ✅ | ✅ |
| Manage super admins | ❌ | ❌ | ❌ | ✅ |
| System settings | ❌ | ❌ | ❌ | ✅ |
| Export reports | ❌ | ✅ | ✅ | ✅ |
| Approve corrections | ❌ | ✅ | ✅ | ✅ |

---

## Features

### Phase 1: Foundation ✅
- [x] Project structure (Monorepo)
- [ ] Database schema
- [ ] Authentication system
- [ ] Basic API endpoints
- [ ] Role-based access control

### Phase 2: Steward App 🔄
- [ ] Login screen
- [ ] Daily inventory form (Opening)
- [ ] Tub receipt entry
- [ ] Closing inventory form
- [ ] Offline storage (IndexedDB)
- [ ] Auto-sync when online

### Phase 3: Admin Dashboard 📋
- [ ] Login with role detection
- [ ] Role-based dashboard views
- [ ] Branch management
- [ ] User management
- [ ] Basic reports

### Phase 4: Analytics 📊
- [ ] Flavor consumption calculation
- [ ] Weekly/Monthly trends
- [ ] Branch comparison
- [ ] Area/Territory rollups
- [ ] Top moving flavors report
- [ ] Slow moving flavors alert

### Phase 5: Advanced Features 🚀
- [ ] Ordering recommendations
- [ ] Wastage tracking
- [ ] Export to Excel/PDF
- [ ] Notifications
- [ ] Arabic language support (future)

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  TERRITORY  │────<│    AREA     │────<│   BRANCH    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
┌─────────────┐                                │
│    USER     │────────────────────────────────┤
└─────────────┘                                │
                                               │
┌─────────────┐     ┌─────────────┐            │
│   FLAVOR    │────<│  INVENTORY  │────────────┘
└─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │ DAILY_ENTRY │
                    └─────────────┘
```

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | All system users with roles |
| `territories` | Territory divisions |
| `areas` | Areas within territories |
| `branches` | Individual store branches |
| `flavors` | Master list of ice cream flavors |
| `daily_inventory` | Daily opening/closing records |
| `tub_receipts` | Incoming tub records |

---

## API Documentation

### Base URL
- Development: `http://localhost:8000/api/v1`
- Production: `https://api.br-retailflow.com/api/v1`

### Authentication
All endpoints (except login) require JWT Bearer token.

### Main Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User login |
| POST | `/auth/refresh` | Refresh token |
| GET | `/branches` | List branches (role-filtered) |
| GET | `/flavors` | List all flavors |
| POST | `/inventory/opening` | Submit opening inventory |
| POST | `/inventory/closing` | Submit closing inventory |
| POST | `/inventory/receipt` | Record tub receipt |
| GET | `/analytics/consumption` | Get consumption data |
| GET | `/reports/trending` | Get trending flavors |

See [docs/API.md](docs/API.md) for complete API documentation.

---

## Installation

### Prerequisites

- Node.js >= 18.0.0
- Python >= 3.10
- PostgreSQL >= 14

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/br-retailflow.git
   cd br-retailflow
   ```

2. **Install Node dependencies**
   ```bash
   npm install
   ```

3. **Setup Python environment**
   ```bash
   cd apps/api
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

6. **Seed initial data**
   ```bash
   npm run db:seed
   ```

7. **Start development servers**
   ```bash
   # Terminal 1: Start API
   npm run dev:api

   # Terminal 2: Start frontend apps
   npm run dev
   ```

---

## Deployment

### Backend (AWS EC2)

1. Launch EC2 instance (t2.micro - Free Tier)
2. Install Python, PostgreSQL
3. Clone repository
4. Setup environment variables
5. Run with Gunicorn + Nginx

### Frontend (Vercel)

1. Connect GitHub repository
2. Configure build settings
3. Set environment variables
4. Deploy

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

---

## Development Progress

### Current Status: Phase 1 - Foundation

| Task | Status | Date |
|------|--------|------|
| Project structure | ✅ Complete | 2024-01-16 |
| README documentation | ✅ Complete | 2024-01-16 |
| Backend setup | 🔄 In Progress | - |
| Frontend setup | 📋 Pending | - |
| Database schema | 📋 Pending | - |

### Changelog

#### v0.1.0 (2024-01-16)
- Initial project setup
- Monorepo structure with Turborepo
- Basic documentation

---

## Contributing

1. Create feature branch from `main`
2. Make changes
3. Submit pull request

---

## License

Proprietary - Baskin Robbins UAE / Galadari

---

## Contact

For questions or support, contact the development team.
