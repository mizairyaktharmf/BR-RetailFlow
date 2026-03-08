# BR-RetailFlow - Complete Technical Documentation

> **Baskin Robbins UAE (Galadari Franchise) - Inventory & Analytics Platform**
> Last updated: March 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Apps & Features](#4-apps--features)
5. [Database Schema](#5-database-schema)
6. [API Endpoints](#6-api-endpoints)
7. [Authentication & Security](#7-authentication--security)
8. [Gemini AI Integration](#8-gemini-ai-integration)
9. [Sales Channels](#9-sales-channels)
10. [Budget System](#10-budget-system)
11. [Promotion Tracking](#11-promotion-tracking)
12. [Cake Inventory System](#12-cake-inventory-system)
13. [Deployment & Hosting](#13-deployment--hosting)
14. [Environment Variables](#14-environment-variables)
15. [Local Development Setup](#15-local-development-setup)

---

## 1. Overview

BR-RetailFlow is a full-stack inventory and analytics solution built for Baskin Robbins UAE. It handles daily ice cream inventory tracking (measured in inches per tub), POS sales reporting with AI-powered receipt extraction, multi-channel sales aggregation, real-time cake inventory, budget tracking with a smart advisor, and promotion monitoring -- all across a hierarchy of territories, areas, and branches.

**Two frontend apps:**
- **Flavor Expert App** -- Mobile-first PWA used by branch staff for daily operations
- **Admin Dashboard** -- Web app used by HQ, Territory Managers, and Area Managers

**One backend API:**
- **FastAPI** -- REST API with JWT auth, Gemini AI integration, PostgreSQL database

---

## 2. Tech Stack

### Frontend (Both Apps)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.2.0 | React framework (App Router) |
| React | 18.2.0 | UI library |
| Tailwind CSS | 3.4.1 | Utility-first CSS |
| Radix UI | Latest | Headless accessible components (Dialog, Tabs, Dropdown, etc.) |
| shadcn/ui | -- | Pre-built component library on Radix + Tailwind |
| Lucide React | 0.344.0 | Icon library |
| date-fns | 3.3.1 | Date manipulation |
| Recharts | 2.12.0 | Charts (admin dashboard only) |
| idb | 8.0.0 | IndexedDB wrapper (flavor expert only, offline support) |

### Backend (Python)

| Technology | Version | Purpose |
|------------|---------|---------|
| FastAPI | 0.104.1 | Web framework |
| Uvicorn | 0.24.0 | ASGI server |
| SQLAlchemy | 2.0.23 | ORM |
| PostgreSQL | 15+ | Database |
| psycopg2-binary | 2.9.9 | PostgreSQL driver |
| Pydantic | 2.5.0 | Request/response validation |
| python-jose | 3.3.0 | JWT token generation/verification |
| passlib + bcrypt | 1.7.4 / 4.0.1 | Password hashing |
| Alembic | 1.12.1 | Database migrations |
| Pillow | 10.2.0 | Image processing (resize before Gemini) |
| google-genai | 1.0.0+ | Google Gemini AI Vision API |
| openpyxl | 3.1.0+ | Excel file parsing |

### Build System

| Technology | Purpose |
|------------|---------|
| Turborepo | Monorepo task runner |
| npm workspaces | Package management |
| Docker + Docker Compose | Containerized deployment |

---

## 3. Project Structure

```
BR-RetailFlow/
|
+-- apps/
|   +-- admin-dashboard/          Next.js 14 (port 3002)
|   |   +-- app/
|   |   |   +-- login/
|   |   |   +-- dashboard/
|   |   |       +-- analytics/
|   |   |       +-- territories/
|   |   |       +-- areas/
|   |   |       +-- branches/
|   |   |       +-- sales/
|   |   |       +-- budget/
|   |   |       +-- cake-products/
|   |   |       +-- flavors/
|   |   |       +-- users/
|   |   |       +-- promotions/
|   |   |       +-- profile/
|   |   +-- components/ui/        shadcn components
|   |   +-- services/api.js       API service layer
|   |   +-- lib/utils.js          Utilities
|   |
|   +-- flavor-expert-app/        Next.js 14 (port 3001)
|   |   +-- app/
|   |   |   +-- login/
|   |   |   +-- dashboard/
|   |   |   +-- inventory/        Opening/closing inventory
|   |   |   +-- sales/            Sales reporting + photo upload
|   |   |   +-- sales-dashboard/  Sales analytics view
|   |   |   +-- receive/          Tub receipt entry
|   |   |   +-- cake/
|   |   |       +-- stock/        Cake stock management
|   |   |       +-- receive/      Cake receiving
|   |   |       +-- alerts/       Low-stock alerts
|   |   +-- store/                IndexedDB offline store
|   |   +-- services/api.js       API service layer
|   |
|   +-- api/                      FastAPI (port 8000)
|       +-- main.py               App entry + lifespan
|       +-- Dockerfile
|       +-- requirements.txt
|       +-- routers/              Route handlers
|       |   +-- auth.py
|       |   +-- users.py
|       |   +-- territories.py
|       |   +-- areas.py
|       |   +-- branches.py
|       |   +-- flavors.py
|       |   +-- inventory.py
|       |   +-- sales.py
|       |   +-- cake.py
|       |   +-- budget.py
|       |   +-- analytics.py
|       +-- models/               SQLAlchemy models
|       |   +-- user.py
|       |   +-- location.py
|       |   +-- inventory.py
|       |   +-- sales.py
|       |   +-- cake.py
|       +-- schemas/              Pydantic schemas
|       +-- services/             Business logic
|       |   +-- gemini_vision.py  AI extraction
|       |   +-- budget_excel.py   Excel parsing
|       +-- utils/
|           +-- config.py         Settings
|           +-- database.py       DB connection
|           +-- security.py       JWT + RBAC
|
+-- packages/
|   +-- ui/                       Shared UI components
|   +-- shared/                   Shared utilities
|
+-- docker-compose.yml
+-- turbo.json
+-- package.json
```

---

## 4. Apps & Features

### 4.1 Flavor Expert App (Mobile PWA)

Used by branch staff (Flavor Experts) daily. Mobile-first design, works offline via IndexedDB.

| Feature | Description |
|---------|-------------|
| **Branch Login** | Login with branch ID + password (not personal account) |
| **Opening Inventory** | Record ice cream levels (inches) for each tub at store open |
| **Closing Inventory** | Record remaining levels at close; system calculates consumption |
| **Tub Receiving** | Log new tubs received from warehouse with reference numbers |
| **Sales Reporting** | Upload POS receipt photos at 4 time windows: 3 PM, 7 PM, 9 PM, Closing |
| **Sales Dashboard** | View extracted sales data, categories, items, channels, budget achievement |
| **Cake Stock** | Track cake inventory in real-time (sale, receive, adjust) |
| **Cake Receiving** | Log cakes received from warehouse |
| **Cake Alerts** | View cakes below alert threshold |
| **Offline Support** | IndexedDB stores data locally; syncs when back online |

### 4.2 Admin Dashboard (Web App)

Used by HQ (Supreme Admin), Territory Managers, and Area Managers.

| Feature | Description |
|---------|-------------|
| **Role-Based Views** | Content filtered by user's role and assigned territory/area/branch |
| **User Management** | Create users, approve registrations, assign roles, reset passwords |
| **Territory/Area/Branch** | Full CRUD for organizational hierarchy |
| **Flavor Management** | Master list of ice cream flavors, bulk create, categories |
| **Sales Review** | View submitted POS photos and extracted data per branch/date/window |
| **Budget Upload** | Upload monthly budget sheet (Excel or photo) for each branch |
| **Budget Advisor** | Smart advisor: daily achievement, ATV focus, guest count targets, MTD summary |
| **Budget Chart** | Line chart: budget vs actual vs last year, day-by-day |
| **Cake Products** | Manage cake catalog, set default alert thresholds |
| **Analytics** | Flavor consumption trends, branch performance, territory rollups |
| **Promotion Tracking** | Track specific POS items/categories/names as promotions; view QTY, IR, AUV, sales |
| **Profile** | Update personal info, change password |

---

## 5. Database Schema

**Database:** PostgreSQL 15+ via SQLAlchemy 2.0 ORM. Migrations managed with Alembic.

### Users & Auth

```
users
  id              INTEGER PK
  email           VARCHAR UNIQUE
  username        VARCHAR UNIQUE
  hashed_password VARCHAR
  full_name       VARCHAR
  phone           VARCHAR
  role            ENUM (supreme_admin, super_admin, admin, staff)
  is_active       BOOLEAN
  is_verified     BOOLEAN
  is_approved     BOOLEAN
  branch_id       FK -> branches
  area_id         FK -> areas
  territory_id    FK -> territories
  verification_code VARCHAR
  last_login      DATETIME
  created_at      DATETIME
```

### Location Hierarchy

```
territories                    areas                         branches
  id        PK                   id        PK                  id          PK
  name      VARCHAR              name      VARCHAR             name        VARCHAR
  code      VARCHAR UNIQUE       code      VARCHAR UNIQUE      code        VARCHAR UNIQUE
  is_active BOOLEAN              territory_id FK               address     VARCHAR
                                 is_active BOOLEAN             phone       VARCHAR
                                                               territory_id FK
                                                               area_id      FK
                                                               manager_id   FK -> users
                                                               login_id     VARCHAR
                                                               hashed_password VARCHAR
                                                               is_active    BOOLEAN
```

### Ice Cream Inventory

```
flavors                        daily_inventory                tub_receipts
  id        PK                   id          PK                 id          PK
  name      VARCHAR              branch_id   FK                 branch_id   FK
  code      VARCHAR UNIQUE       date        DATE               date        DATE
  category  VARCHAR              flavor_id   FK                 flavor_id   FK
  standard_tub_size FLOAT (10)   entry_type  opening/closing    quantity    INTEGER
  is_active BOOLEAN              inches      FLOAT              inches_per_tub FLOAT
                                 entered_by_id FK               recorded_by_id FK
                                 notes       TEXT               reference_number VARCHAR
```

### Sales

```
daily_sales
  id                  PK
  branch_id           FK
  date                DATE
  sales_window        VARCHAR (3pm/7pm/9pm/closing)
  -- POS data
  total_sales         FLOAT
  transaction_count   INTEGER
  gross_sales         FLOAT
  cash_sales          FLOAT
  cash_gc             INTEGER
  atv                 FLOAT
  ly_sale             FLOAT
  -- Category/item breakdown (JSON)
  category_data       TEXT (JSON array of {name, qty, sales, pct})
  items_data          TEXT (JSON array of {code, name, category, quantity, sales, pct})
  photo_url           VARCHAR
  -- Home Delivery
  hd_gross_sales      FLOAT
  hd_net_sales        FLOAT
  hd_orders           INTEGER
  hd_photo_url        VARCHAR
  -- Deliveroo
  deliveroo_gross_sales FLOAT
  deliveroo_net_sales   FLOAT
  deliveroo_orders      INTEGER
  deliveroo_photo_url   VARCHAR
  -- Cool Mood
  cm_gross_sales      FLOAT
  cm_net_sales        FLOAT
  cm_orders           INTEGER
  -- Metadata
  submitted_by_id     FK
  created_at          DATETIME
  updated_at          DATETIME
```

### Budget

```
daily_budgets                  budget_uploads
  id          PK                 id              PK
  branch_id   FK                 branch_id       FK
  budget_date DATE               month           VARCHAR (YYYY-MM)
  day_name    VARCHAR            parlor_name     VARCHAR
  budget_amount FLOAT            area_manager    VARCHAR
  budget_gc   FLOAT              days_count      INTEGER
  ly_sales    FLOAT              total_budget    FLOAT
  ly_gc       INTEGER            total_ly_sales  FLOAT
  mtd_ly_sales FLOAT             total_ly_gc     INTEGER
  mtd_budget  FLOAT              ly_atv          FLOAT
  ly_atv      FLOAT              ly_auv          FLOAT
  day_of_week INTEGER            ly_cake_qty     FLOAT
  set_by      FK                 ly_hp_qty       FLOAT
                                 uploaded_by     FK
                                 status          VARCHAR
```

### Cake Inventory

```
cake_products                  cake_stock                     cake_stock_logs
  id        PK                   id              PK             id              PK
  name      VARCHAR              branch_id       FK             branch_id       FK
  code      VARCHAR UNIQUE       cake_product_id FK             cake_product_id FK
  category  VARCHAR              current_quantity INTEGER       change_type     ENUM
  default_alert_threshold INT    last_updated_by_id FK            (sale/received/adjustment/
  is_active BOOLEAN              last_updated_at DATETIME          wastage/initial)
                                 UNIQUE(branch_id,                quantity_change  INTEGER
                                        cake_product_id)          quantity_before  INTEGER
                                                                  quantity_after   INTEGER
cake_alert_configs                                                recorded_by_id   FK
  id              PK                                              created_at       DATETIME
  branch_id       FK
  cake_product_id FK
  threshold       INTEGER
  is_enabled      BOOLEAN
  configured_by_id FK
  UNIQUE(branch_id, cake_product_id)
```

### Promotions

```
promotions                     promotion_usage                tracked_items
  id          PK                 id            PK               id          PK
  name        VARCHAR            branch_id     FK               branch_id   FK
  code        VARCHAR            date          DATE             item_code   VARCHAR
  start_date  DATE               promotion_id  FK                 (e.g. "1142", "CAT:Desserts",
  end_date    DATE               usage_count   INTEGER               "NAME:Umm Ali")
  discount_type VARCHAR          total_discount FLOAT           item_name   VARCHAR
  discount_value FLOAT           recorded_by_id FK              category    VARCHAR
  is_active   BOOLEAN                                           is_active   BOOLEAN
                                                                created_by_id FK
```

---

## 6. API Endpoints

**Base URL:** `/api/v1`

### Authentication (`/auth`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | User login (username/email + password) -> JWT |
| POST | `/branch-login` | Branch login (branch_id + password) for Flavor Expert |
| POST | `/register` | New admin registration -> verification code |
| POST | `/verify` | Email verification with 6-digit code |
| POST | `/refresh` | Refresh access token |
| GET | `/me` | Get current user info |
| POST | `/change-password` | Change password |
| PUT | `/profile` | Update profile (name, phone) |

### Users (`/users`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List users (role-filtered) |
| POST | `/` | Create user (HQ only) |
| GET | `/pending-approvals` | Users awaiting approval |
| GET | `/{id}` | Get user |
| PUT | `/{id}` | Update user |
| POST | `/{id}/approve` | Approve user (HQ) |
| POST | `/{id}/reject` | Reject user (HQ) |
| POST | `/{id}/assign` | Assign to territory/branch |
| POST | `/{id}/reset-password` | Reset password |
| DELETE | `/{id}` | Delete user (HQ) |

### Locations (`/territories`, `/areas`, `/branches`)

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/territories` | List / Create |
| GET/PUT/DELETE | `/territories/{id}` | Get / Update / Delete |
| GET/POST | `/areas` | List / Create |
| GET/PUT/DELETE | `/areas/{id}` | Get / Update / Delete |
| GET/POST | `/branches` | List / Create |
| GET/PUT | `/branches/{id}` | Get / Update |
| POST | `/branches/{id}/assign` | Assign manager |
| POST | `/branches/{id}/set-branch-credentials` | Set branch login |
| GET | `/branches/{id}/staff` | Get branch staff |

### Flavors (`/flavors`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List flavors (search, filter) |
| GET | `/categories` | List flavor categories |
| POST | `/` | Create flavor |
| POST | `/bulk` | Bulk create flavors |
| GET/PUT/DELETE | `/{id}` | Get / Update / Soft-delete |

### Inventory (`/inventory`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/daily` | Create inventory entry |
| POST | `/daily/bulk` | Bulk submit entries |
| GET | `/daily` | List entries |
| GET | `/daily/opening` | Get opening inventory for branch/date |
| GET | `/summary/{branch}/{date}` | Summary with consumption calc |
| POST | `/receipts` | Create tub receipt |
| POST | `/receipts/bulk` | Bulk receipts |
| GET | `/receipts` | List receipts |

### Sales (`/sales`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/daily` | Submit sales report for window |
| GET | `/daily` | Get sales for branch/date |
| POST | `/extract-receipt` | **Gemini AI** -- extract POS/HD/Deliveroo receipt |
| GET | `/budget` | Get monthly budget for branch |

### Budget (`/budget`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/upload` | Upload budget sheet photo -> Gemini extraction |
| POST | `/upload-excel` | Upload budget Excel -> openpyxl parsing |
| POST | `/confirm` | Confirm and save extracted budget |
| GET | `/daily` | Get single day budget |
| GET | `/month` | Get full month budgets |
| GET | `/check/{branch_id}` | Check if budget uploaded for month |
| GET | `/advisor/{branch_id}` | **Smart Advisor** -- daily/MTD metrics + advice |
| GET | `/chart/{branch_id}` | Chart data (budget vs actual vs LY) |
| GET | `/tracker-overview` | Territory-wide budget overview |

### Cake (`/cake`)

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/cake-products` | List / Create cake products |
| PUT | `/cake-products/{id}` | Update cake product |
| GET | `/stock/{branch_id}` | Get current stock |
| POST | `/stock/sale` | Record sale (decrement) |
| POST | `/stock/receive` | Record receipt (increment) |
| POST | `/stock/adjustment` | Adjust stock |
| POST | `/stock/init` | Initialize stock (bulk) |
| GET | `/stock-logs` | Transaction history |
| GET | `/low-stock-alerts` | Branches below threshold |
| POST | `/alert-configs` | Set alert threshold |

### Analytics (`/analytics`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/consumption` | Flavor consumption by date range |
| GET | `/trending` | Trending flavors (up/down/stable) |
| GET | `/branch-performance` | Branch performance metrics |
| GET | `/summary` | Overall consumption summary |

---

## 7. Authentication & Security

### JWT Tokens

- **Library:** python-jose with cryptography
- **Algorithm:** HS256
- **Access token:** 30-minute expiry
- **Refresh token:** 7-day expiry
- **Payload:** `{ sub: user_id, type: "access"|"refresh", exp: timestamp }`

### Password Security

- **Hashing:** bcrypt via passlib
- **No plaintext** passwords stored anywhere

### Role-Based Access Control (RBAC)

| Role | Scope | Can Do |
|------|-------|--------|
| `supreme_admin` | All territories/areas/branches | Everything: manage users, locations, budgets, view all data |
| `super_admin` | Own territory only | Manage areas/branches in territory, view territory data |
| `admin` | Own area + assigned branches | View/manage assigned branches, upload budgets |
| `staff` | Own branch only | Submit inventory/sales, manage cake stock |

**Enforcement:**
- `require_role([roles])` FastAPI dependency on every endpoint
- Database queries auto-filtered by user's territory/area/branch scope
- Branch login creates a system `staff` user linked to that branch

### Branch Login Flow

1. Admin sets branch credentials: `login_id` (e.g., "BR-KARAMA-01") + password
2. Flavor Expert opens app -> enters branch login_id + password
3. API verifies -> returns JWT for linked system staff user
4. Staff user email pattern: `branch_{id}@branch.brretailflow.com`

---

## 8. Gemini AI Integration

### Purpose

Automate data extraction from:
- **POS receipts** -- sales summary, categories, individual items
- **Home Delivery reports** -- HD sales, orders, discounts
- **Deliveroo dashboards** -- multi-store aggregated delivery data
- **Budget sheets** -- monthly DAILY SALES TRACKER (photo upload, legacy)

### Configuration

- **Model:** `gemini-2.5-flash`
- **API:** Google Generative AI (`google-genai` Python SDK)
- **Temperature:** 0.1 (deterministic, consistent output)
- **Max tokens:** 65,536
- **Image preprocessing:** Large images resized to max 2048px before API call

### How It Works

1. Flavor Expert takes a photo of the POS receipt in the app
2. Photo uploaded to `POST /sales/extract-receipt` with `receipt_type`
3. Backend sends image + structured prompt to Gemini Vision
4. Gemini returns JSON with extracted data
5. Backend parses JSON, validates, returns to frontend
6. Frontend displays extracted data for review before saving

### Extraction Types

#### POS Sales Summary (`receipt_type: "pos"`)

Extracts from the top section of POS receipt:
```json
{
  "branch_code": "1772",
  "date": "2026-03-08",
  "gross_sales": 3500.00,
  "returns": 50.00,
  "total_sales": 3450.00,
  "discount": 100.00,
  "net_sales": 3350.00,
  "tax": 175.00,
  "guest_count": 104,
  "atv": 33.17,
  "cash_sales": 2100.00,
  "cash_gc": 63
}
```

#### POS Categories + Items (`receipt_type: "pos_categories"` or `"pos_combined"`)

Extracts category totals (under T> headers) and individual items:
```json
{
  "categories": [
    { "name": "Cups & Cones", "quantity": 66, "sales": 1096.11, "contribution_pct": 34.8 },
    { "name": "Sundaes", "quantity": 12, "sales": 456.00, "contribution_pct": 14.5 },
    { "name": "Desserts", "quantity": 8, "sales": 749.00, "contribution_pct": 23.8 }
  ],
  "items": [
    { "code": "1142", "name": "Chc Pnt Bliss S", "category": "Cups & Cones", "quantity": 3, "sales": 54.30, "contribution_pct": 1.7 },
    { "code": "2001", "name": "TA Umm Ali Sgl", "category": "Desserts", "quantity": 5, "sales": 400.00, "contribution_pct": 12.7 }
  ]
}
```

**Key rule in prompt:** Each item's `category` field MUST match the T>CategoryName header it appears under in the receipt. Items between T>Desserts and T>Toppings belong to "Desserts".

#### Home Delivery (`receipt_type: "hd"`)

```json
{
  "branch_name": "BR Karama",
  "date": "2026-03-08",
  "gross_sales": 1200.00,
  "discount": 50.00,
  "net_sales": 1150.00,
  "delivery_charges": 0.00,
  "vat": 57.50,
  "orders": 28,
  "avg_sales_per_order": 42.86
}
```

#### Deliveroo (`receipt_type: "deliveroo"`)

```json
{
  "stores": [
    { "name": "BR Karama", "gross_sales": 800.00, "net_sales": 720.00, "orders": 18, "discount": 80.00 }
  ],
  "totals": { "gross_sales": 800.00, "net_sales": 720.00, "orders": 18 }
}
```

#### Budget Sheet (Photo, Legacy)

Extracts DAILY SALES TRACKER format:
- Header: parlor name, month, area manager
- 28-31 daily rows: date, day, LY sales, budget, LY GC, MTD values
- Footer KPIs: ATV, AUV, Cake QTY, HP QTY

### Excel Alternative (Preferred)

**Service:** `budget_excel.py` using openpyxl

Instead of using Gemini Vision on a budget sheet photo:
1. Area Manager uploads the `.xlsx` file directly
2. `parse_budget_excel()` reads the workbook
3. Extracts same data structure as Gemini but instantly, free, and 100% accurate
4. Returns same response format so the confirm flow works unchanged

**Excel column mapping:**
- C1=SL, C2=2025 date, C3=2026 date, C4=Day name
- C5=LY sales, C8=Budget, C10=LY GC
- C13=MTD LY, C16=MTD Budget
- Row 33=TOTAL, Rows 35-38=KPIs

---

## 9. Sales Channels

The system tracks sales from multiple channels, all stored in the `daily_sales` table:

| Channel | Fields | Source |
|---------|--------|--------|
| **Dine-in (POS)** | total_sales, gross_sales, cash_sales, cash_gc, atv, category_data, items_data | POS receipt photo -> Gemini |
| **Home Delivery** | hd_gross_sales, hd_net_sales, hd_orders | HD report photo -> Gemini |
| **Deliveroo** | deliveroo_gross_sales, deliveroo_net_sales, deliveroo_orders | Deliveroo dashboard photo -> Gemini |
| **Cool Mood** | cm_gross_sales, cm_net_sales, cm_orders | Manual entry |

**Combined totals (used by Budget Advisor):**
```
combined_net = pos_net + hd_net + deliveroo_net + cool_mood_net
combined_gc  = pos_gc  + hd_orders + deliveroo_orders + cm_orders
```

### Sales Windows

Branch staff submit sales at 4 time windows during the day:
- **3 PM** -- mid-day snapshot
- **7 PM** -- evening snapshot
- **9 PM** -- night snapshot
- **Closing** -- final daily totals

POS data is cumulative, so the latest window for a day represents the true daily total. The system always uses the latest available window when calculating daily performance.

---

## 10. Budget System

### Workflow

1. **Upload:** HQ/AM uploads monthly DAILY SALES TRACKER (Excel preferred, photo supported)
2. **Extract:** System parses the file (openpyxl for Excel, Gemini for photos)
3. **Review:** Admin reviews extracted data in a table -- daily budget, LY sales, LY GC, KPIs
4. **Confirm:** Admin clicks confirm -> data saved to `daily_budgets` (one row per day) + `budget_uploads` (month summary)
5. **Track:** System compares daily actual sales (all channels) against budget targets

### Smart Advisor (`GET /budget/advisor/{branch_id}?date=YYYY-MM-DD`)

Returns real-time actionable advice for the branch manager:

| Advice Type | What It Shows |
|-------------|---------------|
| **Achievement** | Budget achieved (100%+), close (75-99%), or gap remaining with amount needed |
| **ATV Focus** | Current ATV vs budget ATV, with upsell target per guest |
| **Guest Count** | Remaining guests needed to hit target, projected sales at current ATV |
| **Strategy** | "Need X more guests at ATV Y to close gap" type calculations |
| **Top Category** | Highest performing category to push |
| **vs Last Year** | Year-over-year growth/decline percentage |
| **MTD Summary** | Month-to-date achievement %, total sales vs total budget |

### Budget Line Chart

`GET /budget/chart/{branch_id}?month=YYYY-MM` returns daily data:
```json
{
  "days": [
    { "date": "2026-03-01", "day": "Sun", "budget": 2743, "actual": 2850, "ly_sales": 2338 }
  ]
}
```

Rendered as a line chart with:
- Amber line: Budget target
- Green line: Actual sales
- Gray dashed line: Last year sales
- Dots colored green (above budget) or red (below budget)
- Purple dashed vertical line on selected day

---

## 11. Promotion Tracking

### Three Tracking Modes

| Mode | item_code Format | How It Matches |
|------|-----------------|----------------|
| **Code-based** | `"1142"` | Exact POS item code match + variants with same base name |
| **Name-based** | `"NAME:Umm Ali"` | All items whose name contains "Umm Ali" (case-insensitive) |
| **Category-based** | `"CAT:Desserts"` | All items in the Desserts category, matched via word-root fuzzy matching |

### How It Works

1. Admin goes to Promotions page and adds tracked items (by code, name, or category)
2. On the Sales page, system matches tracked items against the POS items_data extracted by Gemini
3. Each tracked item shows: QTY sold, IR% (impulse rate = qty/GC), AUV (avg unit value), Sales amount
4. Grouped display: main total card as header, variant items as horizontal-scroll cards below

### Category Matching

Uses word-root fuzzy matching to handle POS naming variations:
- "Desserts" matches "Cake / Deserts" (root "dessert" ~ "desert")
- "Beverages" matches "Beverage" (root match)
- Uses both the tracked name and the matched `category_data` name for item lookup

---

## 12. Cake Inventory System

### Real-Time Stock Tracking

Unlike ice cream (measured in inches, submitted daily), cake stock is tracked in real-time as integer quantities.

| Operation | Endpoint | Effect |
|-----------|----------|--------|
| **Sale** | `POST /stock/sale` | Decrement stock, log transaction |
| **Receive** | `POST /stock/receive` | Increment stock, log transaction |
| **Adjustment** | `POST /stock/adjustment` | Set stock to value, log difference |
| **Initialize** | `POST /stock/init` | Bulk set initial stock for all products |

### Alert System

- Each cake product has a default alert threshold (e.g., 5 units)
- Per-branch overrides possible via `cake_alert_configs`
- `GET /low-stock-alerts` returns all branches with stock below threshold
- Flavor Expert app shows alerts on the Cake Alerts page

### Transaction Log

Every stock change creates an immutable `cake_stock_logs` entry:
- `change_type`: sale, received, adjustment, wastage, initial
- `quantity_before` and `quantity_after` for audit trail
- `recorded_by_id` for accountability

---

## 13. Deployment & Hosting

### Docker Compose

```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: bruser
      POSTGRES_PASSWORD: (from .env)
      POSTGRES_DB: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build: ./apps/api
    ports: ["8000:8000"]
    depends_on: [db]
    environment: (from .env)
```

### API Dockerfile

```dockerfile
FROM python:3.11-slim
# Install: gcc, postgresql-client, curl, tesseract-ocr
# Copy requirements.txt, install deps
# Copy app code
# Health check: curl http://localhost:8000/health
# CMD: uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Infrastructure

| Component | Service | Region |
|-----------|---------|--------|
| **API Server** | AWS EC2 (Docker) | eu-north-1 |
| **Database** | AWS RDS PostgreSQL 15 | eu-north-1 |
| **Photo Storage** | AWS S3 | eu-north-1 |
| **Frontend Hosting** | Vercel or self-hosted | -- |
| **AI API** | Google Gemini (gemini-2.5-flash) | Google Cloud |

### Database Migrations

- **Tool:** Alembic (SQLAlchemy)
- **Run:** `alembic upgrade head`
- App startup also runs inline `ALTER TABLE` statements for new columns
- Migration scripts in `apps/api/` directory

---

## 14. Environment Variables

```bash
# Database
DATABASE_URL=postgresql://bruser:password@host:5432/postgres

# API Security
SECRET_KEY=your-secret-key

# AWS
AWS_REGION=eu-north-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# CORS (comma-separated origins)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002

# Frontend apps
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## 15. Local Development Setup

### Prerequisites

- Node.js >= 18
- Python >= 3.10
- PostgreSQL 15+ (or Docker)
- npm >= 10

### Steps

```bash
# 1. Clone repository
git clone <repo-url>
cd BR-RetailFlow

# 2. Install frontend dependencies
npm install

# 3. Install backend dependencies
cd apps/api
pip install -r requirements.txt
cd ../..

# 4. Set up environment
cp .env.example .env
# Edit .env with your database URL, Gemini API key, etc.

# 5. Start database (Docker)
docker-compose up db -d

# 6. Run migrations
cd apps/api && alembic upgrade head && cd ../..

# 7. Seed initial data
npm run db:seed

# 8. Start all services
npm run dev:api           # API on port 8000
npm run dev:flavor-expert # Flavor Expert on port 3001
npm run dev:admin         # Admin Dashboard on port 3002
```

### Default Test Accounts (After Seed)

| Role | Username | Password |
|------|----------|----------|
| Supreme Admin | supreme_admin | admin123 |
| Territory Manager | tm_dubai | admin123 |
| Area Manager | am_karama | admin123 |
| Flavor Expert | (branch login_id) | (set by admin) |

---

## Summary

BR-RetailFlow is a production-ready platform combining modern web technologies (Next.js 14, FastAPI, PostgreSQL) with AI-powered automation (Google Gemini Vision) to manage Baskin Robbins UAE operations end-to-end: from daily ice cream inventory in inches, through multi-channel sales tracking, to real-time budget monitoring with actionable advisor insights. The system serves four user roles across a territory-area-branch hierarchy, with offline-capable mobile PWA for field staff and a comprehensive admin dashboard for management.
