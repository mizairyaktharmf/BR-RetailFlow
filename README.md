# BR-RetailFlow

**Ice Cream Inventory & Analytics Solution for Baskin Robbins UAE**

A comprehensive inventory tracking, sales reporting, and analytics system designed to help Baskin Robbins (Galadari franchise) in UAE track flavor movement across all branches, enabling data-driven ordering decisions.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Solution Overview](#solution-overview)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [User Roles & Permissions](#user-roles--permissions)
- [Features](#features)
- [Flavor Expert App Pages](#flavor-expert-app-pages)
- [Sales Reporting Windows](#sales-reporting-windows)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Installation](#installation)
- [Deployment](#deployment)
- [Development Progress](#development-progress)
- [Contributing](#contributing)

---

## Problem Statement

Baskin Robbins UAE faces critical inventory and sales tracking challenges:

- **POS Limitation**: Current POS system only records transaction types (kid's scoop, value scoop) - NOT the specific flavor sold
- **Poor Visibility**: Management cannot identify which flavors are fast-moving vs slow-moving
- **Inefficient Ordering**: Results in over-ordering slow flavors and under-ordering popular ones
- **Manual Sales Tracking**: Currently using WhatsApp groups for sales updates - inefficient and hard to analyze
- **No Budget Tracking**: No easy way to compare actual sales vs budget targets
- **No Year Comparison**: Cannot easily compare performance with previous year

---

## Solution Overview

BR-RetailFlow solves these problems through:

### 1. Daily Inventory Tracking

```
┌─────────────────────────────────────────────────────────────────┐
│                    DAILY WORKFLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MORNING (Opening)                                               │
│  ─────────────────                                               │
│  • System auto-loads previous day's closing as today's opening  │
│  • Flavor Expert verifies/adjusts if needed                      │
│                                                                  │
│  DURING DAY                                                      │
│  ──────────                                                      │
│  • Record any new tub receipts from warehouse                   │
│  • Each tub = 10 inches (standard size)                         │
│  • Submit sales reports at designated windows                    │
│                                                                  │
│  END OF DAY (Closing)                                           │
│  ─────────────────────                                          │
│  • Flavor Expert measures remaining inches in each tub           │
│  • Enters closing inventory                                      │
│  • System calculates: Consumed = Opening + Received - Closing   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Time-Window Sales Reporting (Replaces WhatsApp)

Instead of sending sales to WhatsApp groups, flavor experts now submit sales through the app at specific time windows with photo proof.

### 3. Key Calculations

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
│  │ FLAVOR EXPERT APP│         │  ADMIN DASHBOARD │              │
│  │  (Mobile PWA)    │         │   (Web App)      │              │
│  │                  │         │                  │              │
│  │  • Offline-first │         │  • Analytics     │              │
│  │  • Daily entry   │         │  • Reports       │              │
│  │  • Sales reports │         │  • Budget vs     │              │
│  │  • Photo upload  │         │    Actual        │              │
│  │  • Simple UI     │         │  • YoY Compare   │              │
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
│  │  • File Upload (Photos)                 │                    │
│  └─────────────────┬───────────────────────┘                    │
│                    │                                             │
│                    ▼                                             │
│  ┌─────────────────────────────────────────┐                    │
│  │           POSTGRESQL DATABASE           │                    │
│  │                                         │                    │
│  │  • Users & Roles                        │                    │
│  │  • Branches & Hierarchy                 │                    │
│  │  • Inventory Records                    │                    │
│  │  • Sales Reports                        │                    │
│  │  • Budget Targets                       │                    │
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
| **UI Framework** | Tailwind CSS + shadcn/ui | Styling & Components |
| **Backend** | FastAPI (Python) | REST API |
| **Database** | PostgreSQL | Primary data store |
| **Offline Storage** | IndexedDB (idb) | Offline capability |
| **Monorepo** | Turborepo | Build system |
| **Deployment** | AWS EC2 + Vercel | Hosting |

---

## Project Structure

```
BR-RetailFlow/
├── apps/
│   ├── flavor-expert-app/    # Mobile-first PWA for flavor experts
│   │   ├── app/              # Next.js App Router pages
│   │   │   ├── login/        # Login page
│   │   │   ├── dashboard/    # Main dashboard
│   │   │   ├── inventory/    # Inventory management
│   │   │   ├── sales/        # Sales reporting
│   │   │   └── receive/      # Receive from warehouse
│   │   ├── components/ui/    # shadcn/ui components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API services
│   │   ├── store/            # Offline storage (IndexedDB)
│   │   └── lib/              # Utilities
│   │
│   ├── admin-dashboard/      # Admin web application (TODO)
│   │
│   └── api/                  # FastAPI backend
│       ├── routers/          # API route handlers
│       │   ├── auth.py       # Authentication
│       │   ├── users.py      # User management
│       │   ├── branches.py   # Branch management
│       │   ├── flavors.py    # Flavor management
│       │   ├── inventory.py  # Inventory endpoints
│       │   └── analytics.py  # Analytics endpoints
│       ├── models/           # SQLAlchemy models
│       │   ├── user.py       # User model
│       │   ├── location.py   # Territory/Area/Branch
│       │   ├── inventory.py  # Inventory models
│       │   └── sales.py      # Sales models
│       ├── schemas/          # Pydantic schemas
│       ├── services/         # Business logic
│       ├── utils/            # Utility functions
│       └── scripts/          # DB scripts (seed)
│
├── packages/
│   ├── ui/                   # Shared UI components
│   └── shared/               # Shared utilities
│
├── docs/                     # Documentation
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
                    └── Staff (Flavor Expert)
```

### Permission Matrix

| Feature | Staff | Admin | Super Admin | Supreme Admin |
|---------|-------|-------|-------------|---------------|
| Enter daily inventory | Own branch | ❌ | ❌ | ❌ |
| Submit sales reports | Own branch | ❌ | ❌ | ❌ |
| Receive warehouse stock | Own branch | ❌ | ❌ | ❌ |
| View own branch data | ✅ | ✅ | ✅ | ✅ |
| View area branches | ❌ | ✅ | ✅ | ✅ |
| View territory data | ❌ | ❌ | ✅ | ✅ |
| View all UAE data | ❌ | ❌ | ❌ | ✅ |
| View sales photos | ❌ | ✅ | ✅ | ✅ |
| Manage staff | ❌ | ✅ | ✅ | ✅ |
| Set budget targets | ❌ | ❌ | ✅ | ✅ |
| System settings | ❌ | ❌ | ❌ | ✅ |

---

## Features

### Phase 1: Foundation ✅
- [x] Project structure (Monorepo with Turborepo)
- [x] Database models (Users, Locations, Inventory, Sales)
- [x] Authentication system (JWT)
- [x] API endpoints
- [x] Role-based access control

### Phase 2: Flavor Expert App ✅
- [x] Login screen with branch credentials
- [x] Dashboard with quick actions
- [x] Opening inventory form
- [x] Closing inventory form
- [x] Tub receipt entry (warehouse receiving)
- [x] Sales reporting with time windows
- [x] Photo upload for sales proof
- [x] Offline storage (IndexedDB)
- [x] Scoop count tracking
- [x] Product count tracking (sundaes, shakes, cakes)

### Phase 3: Admin Dashboard 📋
- [ ] Login with role detection
- [ ] Role-based dashboard views
- [ ] View sales photos from branches
- [ ] Branch performance comparison
- [ ] Budget vs Actual tracking
- [ ] Year-over-Year comparison
- [ ] User management
- [ ] Branch management

### Phase 4: Analytics 📊
- [ ] Flavor consumption calculation
- [ ] Weekly/Monthly trends
- [ ] Branch comparison
- [ ] Area/Territory rollups
- [ ] Top moving flavors report
- [ ] Slow moving flavors alert
- [ ] Cup usage analytics

### Phase 5: Advanced Features 🚀
- [ ] Ordering recommendations
- [ ] Wastage tracking
- [ ] Export to Excel/PDF
- [ ] Push notifications
- [ ] Arabic language support

---

## Flavor Expert App Pages

### 1. Login Page (`/login`)
- Branch ID and password authentication
- Role validation (only staff can access)
- Remember me functionality
- Clear help information

### 2. Dashboard (`/dashboard`)
- Welcome message with branch info
- Current date and time
- Online/offline status indicator
- Pending sync count
- Sales window status (open/closed)
- Quick action cards:
  - Ice Cream Inventory
  - Receive from Warehouse
  - Submit Sales Report
  - Daily Summary
- Sales windows schedule

### 3. Inventory Page (`/inventory`)
- **Opening Tab**: Record morning inventory levels
- **Closing Tab**: Record end-of-day levels
- Search flavors functionality
- Grouped by category (Classic, Premium, Fruit, etc.)
- Measurement in inches (0-10 per tub)
- Auto-calculation of consumption

### 4. Sales Report Page (`/sales`)
- Time-window restricted submission
- Current window status display
- POS photo capture/upload (required)
- Sales figures entry:
  - Total sales (AED)
  - Transaction count
  - Scoop counts (kids, single, double, triple)
  - Other products (sundaes, shakes, cakes, take-home)
- Notes field

### 5. Receive Page (`/receive`)
- Search and add flavors
- Quantity adjustment (+/-)
- Running total display
- Delivery reference number
- Submission confirmation

---

## Sales Reporting Windows

Sales reports can ONLY be submitted during designated time windows:

| Window | Time | Purpose |
|--------|------|---------|
| **3 PM** | 3:00 PM - 4:00 PM | Afternoon check |
| **7 PM** | 7:00 PM - 8:00 PM | Evening check |
| **9 PM** | 9:00 PM - 10:00 PM | Night check |
| **Closing** | 10:00 PM onwards | End of day |

**Why time windows?**
- Ensures regular reporting throughout the day
- Replaces WhatsApp group updates
- Provides consistent data points for analytics
- Photo proof prevents data manipulation

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
│   FLAVOR    │────<│  INVENTORY  │────────────┤
└─────────────┘     └─────────────┘            │
                                               │
┌─────────────┐     ┌─────────────┐            │
│   BUDGET    │────<│DAILY_SALES  │────────────┘
└─────────────┘     └─────────────┘
```

### Core Tables

| Table | Description |
|-------|-------------|
| `users` | All system users with roles |
| `territories` | Territory divisions (Dubai, Abu Dhabi, etc.) |
| `areas` | Areas within territories (Karama, Deira, etc.) |
| `branches` | Individual store branches |
| `flavors` | Master list of ice cream flavors |
| `daily_inventory` | Daily opening/closing records |
| `tub_receipts` | Incoming tub records |
| `daily_sales` | Sales reports with photo URLs |
| `cup_usage` | Cup usage tracking |
| `promotions` | Active promotions |
| `promotion_usage` | Promotion redemption tracking |
| `branch_budgets` | Monthly budget targets |

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
| GET | `/auth/me` | Get current user |
| GET | `/branches` | List branches (role-filtered) |
| GET | `/flavors` | List all flavors |
| POST | `/inventory/daily/bulk` | Submit inventory (bulk) |
| GET | `/inventory/daily/opening` | Get opening inventory |
| GET | `/inventory/summary/{branch}/{date}` | Get daily summary |
| POST | `/inventory/receipts/bulk` | Submit tub receipts |
| POST | `/sales/daily` | Submit sales report |
| POST | `/sales/upload-photo` | Upload POS photo |
| GET | `/analytics/consumption` | Get consumption data |
| GET | `/analytics/trending` | Get trending flavors |

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
   cp apps/api/.env.example apps/api/.env
   # Edit .env with your database credentials
   ```

5. **Seed initial data**
   ```bash
   cd apps/api
   python scripts/seed.py
   ```

6. **Start development servers**
   ```bash
   # Terminal 1: Start API
   npm run dev:api

   # Terminal 2: Start Flavor Expert App
   npm run dev:flavor-expert
   ```

### Test Accounts

After seeding, use these credentials:

| Role | Username | Password |
|------|----------|----------|
| Supreme Admin | supreme_admin | admin123 |
| Territory Manager | tm_dubai | admin123 |
| Area Manager | am_karama | admin123 |
| Flavor Expert | fe_karama | staff123 |

---

## Deployment

### Backend (AWS EC2)

1. Launch EC2 instance (t2.micro - Free Tier)
2. Install Python 3.10+, PostgreSQL
3. Clone repository
4. Setup environment variables
5. Run with Gunicorn + Nginx

### Frontend (Vercel)

1. Connect GitHub repository
2. Set root directory to `apps/flavor-expert-app` (Flavor Expert App)
3. Configure environment variables:
   ```
   API_URL=https://your-ec2-ip:8000/api/v1
   ```
4. Deploy

---

## Development Progress

### Current Status: Phase 2 Complete - Flavor Expert App

| Task | Status | Date |
|------|--------|------|
| Project structure | ✅ Complete | 2024-01-16 |
| README documentation | ✅ Complete | 2024-01-16 |
| Backend API setup | ✅ Complete | 2024-01-16 |
| Database models | ✅ Complete | 2024-01-16 |
| Flavor Expert App - Login | ✅ Complete | 2024-01-16 |
| Flavor Expert App - Dashboard | ✅ Complete | 2024-01-16 |
| Flavor Expert App - Inventory | ✅ Complete | 2024-01-16 |
| Flavor Expert App - Sales | ✅ Complete | 2024-01-16 |
| Flavor Expert App - Receive | ✅ Complete | 2024-01-16 |
| Admin Dashboard | 📋 Pending | - |
| Analytics Features | 📋 Pending | - |

### Changelog

#### v0.2.0 (2024-01-16)
- Complete Flavor Expert App with all pages
- Sales reporting with time windows
- Photo upload for sales proof
- Offline storage support
- Opening/Closing inventory
- Warehouse receiving

#### v0.1.0 (2024-01-16)
- Initial project setup
- Monorepo structure with Turborepo
- FastAPI backend with all models
- Basic documentation

---

## Contributing

1. Create feature branch from `main`
2. Make changes following the code style
3. Test thoroughly
4. Submit pull request

---

## License

Proprietary - Baskin Robbins UAE / Galadari

---

## Contact

For questions or support, contact the development team.
