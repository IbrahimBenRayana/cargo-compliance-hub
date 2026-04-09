# MyCargoLens — Production Roadmap & Execution Plan

> **Version:** 1.0  
> **Date:** March 30, 2026  
> **Goal:** Transform the current frontend prototype into a production-ready, secure, enterprise-grade ISF 10+2 / ISF 5 compliance SaaS platform integrated with the CustomsCity API.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [CustomsCity API Analysis](#2-customscity-api-analysis)
3. [Architecture Design](#3-architecture-design)
4. [Execution Phases](#4-execution-phases)
   - [Phase 1: Foundation & Backend Infrastructure](#phase-1-foundation--backend-infrastructure)
   - [Phase 2: Authentication & User Management](#phase-2-authentication--user-management)
   - [Phase 3: CustomsCity API Integration Layer](#phase-3-customscity-api-integration-layer)
   - [Phase 4: Core ISF Filing Workflow](#phase-4-core-isf-filing-workflow)
   - [Phase 5: Real-Time Status & Notifications](#phase-5-real-time-status--notifications)
   - [Phase 6: Frontend Upgrade & Data Layer](#phase-6-frontend-upgrade--data-layer)
   - [Phase 7: Compliance Engine & Validation](#phase-7-compliance-engine--validation)
   - [Phase 8: Security Hardening](#phase-8-security-hardening)
   - [Phase 9: Testing & Quality Assurance](#phase-9-testing--quality-assurance)
   - [Phase 10: Deployment & DevOps](#phase-10-deployment--devops)
   - [Phase 11: Monitoring, Analytics & Observability](#phase-11-monitoring-analytics--observability)
   - [Phase 12: Polish, Documentation & Launch](#phase-12-polish-documentation--launch)
5. [Tech Stack Decision](#5-tech-stack-decision)
6. [Database Schema Design](#6-database-schema-design)
7. [Security Checklist](#7-security-checklist)
8. [Action Items Before Starting](#8-action-items-before-starting)

---

## 1. Current State Analysis

### What We Have ✅

| Layer | Status | Details |
|-------|--------|---------|
| **Routing** | ✅ Complete | 9 routes with `react-router-dom` — Dashboard, Shipments (list/detail/new/edit), Compliance, API Settings, Submission Logs, Settings, 404 |
| **Layout** | ✅ Complete | Sidebar navigation with collapsible icon mode, top header bar with notification bell & user avatar |
| **Dashboard** | ✅ Complete | KPI cards (animated counters), recent shipments table, status donut chart, weekly filings bar chart, country-of-origin donut, compliance radial score, activity feed, upcoming deadlines with progress bars |
| **Shipments List** | ✅ Complete | Full-featured table with search, multi-filter (status, country, date range), sortable columns, empty states |
| **Shipment Details** | ✅ Complete | Timeline visualization, data sections (Parties, Shipment Info, Product Info, Logistics), API response display, edit/resubmit actions |
| **Shipment Wizard** | ✅ Complete | 4-step form wizard (Parties → Shipment Info → Product Info → Logistics), edit mode support |
| **Compliance Page** | ✅ Complete | Auto-validates draft filings for missing fields, severity levels (critical/warning/info), filterable & sortable table |
| **API Settings Page** | ✅ Basic | Connection status display, API key input, sandbox/production toggle |
| **Submission Logs** | ✅ Complete | Expandable log rows with request/response payloads |
| **Settings Page** | ✅ Basic | Profile form (name, email), company settings (name, IOR number) |
| **UI Components** | ✅ Complete | Full shadcn/ui component library (49 components), StatusBadge, NavLink |
| **Type System** | ✅ Basic | TypeScript interfaces for Shipment, SubmissionLog, ActivityItem |

### What's Missing ❌

| Category | Gap |
|----------|-----|
| **Backend** | No backend server — everything is frontend-only with mock data |
| **Database** | No database — all data is hardcoded in `mock-data.ts` |
| **Authentication** | No auth system — no login, no sessions, no role-based access |
| **API Integration** | No real CustomsCity API integration — settings page is static, submissions are fake |
| **Data Persistence** | No CRUD operations — wizard submits to nothing, edits don't persist |
| **Validation** | No real-time field validation — compliance page only checks empty strings |
| **ISF 5 Support** | Only ISF 10+2 fields — no ISF 5 (carrier security filing) support |
| **File Uploads** | No document attachment capability (BOL copies, commercial invoices, etc.) |
| **Multi-tenancy** | No organization/team management |
| **Audit Trail** | No change history tracking |
| **Notifications** | Hardcoded badge "3" on bell icon — no real notification system |
| **Error Handling** | No global error boundaries, no retry logic, no offline handling |
| **Testing** | Only a placeholder test file (`example.test.ts`) |
| **Environment Config** | No `.env` management, no secrets handling |
| **Deployment** | No CI/CD, no Docker, no infrastructure-as-code |

### Current Data Model Gaps

The existing `Shipment` type is **incomplete for ISF 10+2 compliance**. The real ISF 10+2 requires **10 data elements from the importer** and **2 from the carrier**:

**Importer's 10 Elements (currently partial):**
1. ✅ Manufacturer (or supplier) — `parties.manufacturer`
2. ✅ Seller — `parties.seller`
3. ✅ Buyer — `parties.buyer`
4. ✅ Ship-to party — `parties.shipToParty`
5. ✅ Container stuffing location — `logistics.containerStuffingLocation`
6. ✅ Consolidator — `logistics.consolidator`
7. ❌ **Importer of Record number** — missing (IRS/EIN/CBP assigned number)
8. ❌ **Consignee number** — missing
9. ✅ Country of origin — `productInfo.countryOfOrigin`
10. ✅ HTS code (6-digit) — `productInfo.htsCode`

**Carrier's 2 Elements (currently missing):**
1. ❌ **Vessel stow plan** — missing
2. ❌ **Container status messages** — missing

**Other Missing ISF Fields:**
- ❌ SCAC code (Standard Carrier Alpha Code)
- ❌ Foreign port of unlading
- ❌ Place of delivery
- ❌ Master/House Bill of Lading distinction
- ❌ Bond type & surety information
- ❌ Entry type code
- ❌ Estimated arrival date
- ❌ Container number(s)

---

## 2. CustomsCity API Analysis

### Overview

CustomsCity provides a REST API built on **FeathersJS** (Node.js framework) accessible at `https://api.customscity.com`. The API documentation is available at `https://app.customscity.com/api-documentation` (client-side rendered SPA).

### ⚠️ ACTION REQUIRED — API Documentation Access

The API documentation page is a fully client-side rendered application that cannot be scraped programmatically. **Before we proceed to Phase 3, we need:**

1. **Full API documentation export** — Ask CustomsCity support for a PDF/Markdown/OpenAPI spec of their ISF-related endpoints
2. **API credentials** — Sandbox API key and production API key
3. **Webhook configuration** — Confirm if they support webhook callbacks for status updates
4. **Rate limits** — Understand throttling rules

### Expected API Endpoints (Based on Industry Standard ISF APIs)

Based on the FeathersJS backend structure and standard customs filing API patterns, the CustomsCity API likely provides:

#### Authentication
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/authentication` | Authenticate and get JWT token |
| `POST` | `/authentication/refresh` | Refresh expired token |

#### ISF 10+2 Filing Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/isf-10` or `/isf` | Create a new ISF 10+2 filing |
| `GET` | `/isf-10/:id` | Get a specific ISF filing by ID |
| `GET` | `/isf-10` | List all ISF filings (with pagination/filters) |
| `PATCH` | `/isf-10/:id` | Update an existing ISF filing (amendment) |
| `DELETE` | `/isf-10/:id` | Delete/cancel a draft ISF filing |
| `POST` | `/isf-10/:id/submit` | Submit filing to CBP |
| `POST` | `/isf-10/:id/amend` | Submit amendment to a previously accepted filing |

#### ISF 5 (Carrier Security Filing) Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/isf-5` | Create a new ISF 5 filing |
| `GET` | `/isf-5/:id` | Get a specific ISF 5 filing |
| `PATCH` | `/isf-5/:id` | Update an ISF 5 filing |
| `POST` | `/isf-5/:id/submit` | Submit ISF 5 to CBP |

#### Status & Tracking
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/isf-10/:id/status` | Get current CBP processing status |
| `GET` | `/isf-10/:id/history` | Get full status history |
| `GET` | `/notifications` | Get filing notifications/alerts |

#### Reference Data
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/hts-codes` | Search/validate HTS codes |
| `GET` | `/ports` | List ports (foreign/domestic) |
| `GET` | `/carriers` | List carrier/SCAC codes |
| `GET` | `/countries` | List country codes |

#### Webhooks (if supported)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/webhooks` | Register a webhook URL for status updates |
| `GET` | `/webhooks` | List registered webhooks |
| `DELETE` | `/webhooks/:id` | Remove a webhook |

### Expected ISF 10+2 Filing Payload Structure

```json
{
  "filingType": "ISF-10",
  "bondType": "continuous",
  "importerOfRecord": {
    "name": "US Imports Inc.",
    "number": "IOR-2026-0001",
    "address": { "street": "...", "city": "...", "state": "...", "zip": "...", "country": "US" }
  },
  "consignee": {
    "name": "US Imports Warehouse",
    "number": "CON-12345",
    "address": { ... }
  },
  "seller": {
    "name": "Global Trade Ltd.",
    "address": { ... }
  },
  "buyer": {
    "name": "US Imports Inc.",
    "address": { ... }
  },
  "manufacturer": {
    "name": "Shenzhen Electronics Co.",
    "address": { ... }
  },
  "shipToParty": {
    "name": "US Imports Warehouse",
    "address": { ... }
  },
  "containerStuffingLocation": {
    "name": "Shenzhen Port",
    "address": { ... }
  },
  "consolidator": {
    "name": "Pacific Consolidators",
    "address": { ... }
  },
  "shipment": {
    "masterBillOfLading": "MAEU1234567",
    "houseBillOfLading": "",
    "scacCode": "MAEU",
    "vesselName": "MSC Carolina",
    "voyageNumber": "VY-2026-045",
    "foreignPortOfUnlading": "CNSZX",
    "placeOfDelivery": "USLAX",
    "estimatedArrivalDate": "2026-04-10",
    "estimatedDepartureDate": "2026-04-05"
  },
  "commodities": [
    {
      "htsCode": "8471.30.0100",
      "countryOfOrigin": "CN",
      "description": "Laptop computers",
      "quantity": 500,
      "weight": { "value": 2500, "unit": "KG" },
      "value": { "amount": 250000, "currency": "USD" }
    }
  ],
  "containers": [
    {
      "number": "MSKU1234567",
      "type": "40HC",
      "sealNumber": "SEAL001"
    }
  ]
}
```

### Expected ISF 5 Filing Payload Structure

ISF 5 is a simpler filing for FROB (Foreign Remaining On Board), IE (Immediate Exportation), and T&E (Transportation and Exportation) shipments:

```json
{
  "filingType": "ISF-5",
  "shipment": {
    "bookingNumber": "BK123456",
    "billOfLading": "MAEU1234567",
    "foreignPortOfUnlading": "CNSZX",
    "placeOfDelivery": "USLAX",
    "vesselName": "MSC Carolina",
    "voyageNumber": "VY-2026-045"
  },
  "commodities": [
    {
      "htsCode": "8471.30",
      "countryOfOrigin": "CN",
      "description": "Laptop computers"
    }
  ],
  "containers": [
    { "number": "MSKU1234567" }
  ]
}
```

---

## 3. Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       FRONTEND (React + Vite)               │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐  │
│  │Dashboard │ │Shipments │ │Compliance │ │  Settings    │  │
│  └────┬─────┘ └────┬─────┘ └─────┬─────┘ └──────┬───────┘  │
│       │             │             │               │          │
│  ┌────┴─────────────┴─────────────┴───────────────┴───────┐  │
│  │           TanStack Query (React Query)                 │  │
│  │     + Zustand (Global State) + Zod (Validation)        │  │
│  └────────────────────────┬───────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────┘
                            │ HTTPS (JWT Bearer)
┌───────────────────────────┼──────────────────────────────────┐
│                    API GATEWAY / BFF                          │
│              (Node.js + Express or Hono)                      │
│  ┌────────────┐ ┌────────────┐ ┌───────────┐ ┌───────────┐  │
│  │   Auth     │ │  ISF       │ │  Status   │ │  Webhook  │  │
│  │  Middleware│ │  Routes    │ │  Polling  │ │  Receiver │  │
│  └─────┬──────┘ └─────┬──────┘ └─────┬─────┘ └─────┬─────┘  │
│        │              │              │              │         │
│  ┌─────┴──────────────┴──────────────┴──────────────┴──────┐  │
│  │          CustomsCity API Service Layer                   │  │
│  │   (Encapsulates all CC API calls, retries, transforms)  │  │
│  └─────────────────────────┬───────────────────────────────┘  │
└────────────────────────────┼─────────────────────────────────┘
                             │ HTTPS
                             ▼
                ┌────────────────────────┐
                │   CustomsCity API      │
                │ api.customscity.com    │
                └────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                       DATA LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  PostgreSQL  │  │    Redis     │  │    S3 / MinIO      │  │
│  │  (Primary)   │  │  (Cache +   │  │  (File uploads)    │  │
│  │              │  │   Sessions)  │  │                    │  │
│  └──────────────┘  └──────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Why a Backend (BFF) is Required

We **must not** call the CustomsCity API directly from the frontend because:

1. **API Key Security** — CustomsCity API keys must never be exposed in client-side code
2. **Data Transformation** — We need to map our internal data model to the CC API's expected format
3. **Audit Trail** — Every API call must be logged server-side with request/response
4. **Retry Logic** — Failed submissions need automatic server-side retries with exponential backoff
5. **Rate Limiting** — We need to queue and throttle requests to respect CC API limits
6. **Webhook Reception** — Incoming status updates from CC need a server endpoint
7. **Validation** — Server-side validation before any data reaches CBP via CC
8. **Multi-tenancy** — Different organizations with different CC API keys

---

## 4. Execution Phases

### Phase 1: Foundation & Backend Infrastructure
**Priority: 🔴 CRITICAL | Duration: ~3-4 days**

#### 1.1 Initialize Backend Project
- [ ] Set up Node.js + TypeScript backend (Express or Hono framework)
- [ ] Configure project structure:
  ```
  server/
  ├── src/
  │   ├── config/          # Environment config, constants
  │   ├── controllers/     # Route handlers
  │   ├── middleware/       # Auth, error handling, rate limiting, logging
  │   ├── models/          # Database models (Drizzle ORM or Prisma)
  │   ├── routes/          # Route definitions
  │   ├── services/        # Business logic
  │   │   ├── customscity/ # CC API integration service
  │   │   ├── isf/         # ISF filing business logic
  │   │   ├── auth/        # Authentication service
  │   │   └── notification/# Notification service
  │   ├── utils/           # Helpers, validators
  │   ├── types/           # Shared TypeScript types
  │   ├── jobs/            # Background jobs (polling, reminders)
  │   └── index.ts         # Entry point
  ├── prisma/ (or drizzle/)
  │   └── schema.prisma    # Database schema
  ├── tests/
  ├── .env.example
  ├── Dockerfile
  └── package.json
  ```
- [ ] Set up environment variable management (`.env`, `dotenv`, validation with Zod)
- [ ] Configure TypeScript (`strict: true`, path aliases)

#### 1.2 Database Setup
- [ ] Set up PostgreSQL (local Docker for dev, managed for prod)
- [ ] Design and create initial schema (see [Section 6](#6-database-schema-design))
- [ ] Set up ORM (Prisma or Drizzle) with migrations
- [ ] Create seed script with sample data

#### 1.3 Redis Setup
- [ ] Set up Redis for session storage, caching, and rate limiting
- [ ] Configure connection pooling

#### 1.4 API Scaffold
- [ ] Create base Express/Hono app with:
  - CORS configuration (whitelist frontend origins)
  - Helmet.js for security headers
  - Request body parsing & size limits
  - Global error handler with proper HTTP status codes
  - Request ID tracking (correlation IDs)
  - Request logging (structured JSON with pino or winston)
  - Health check endpoint (`GET /api/health`)
  - API versioning (`/api/v1/...`)

---

### Phase 2: Authentication & User Management
**Priority: 🔴 CRITICAL | Duration: ~3-4 days**

#### 2.1 Authentication System
- [ ] Implement JWT-based authentication:
  - Access tokens (short-lived, 15 min)
  - Refresh tokens (long-lived, 7 days, stored in httpOnly cookies)
  - Token rotation on refresh
- [ ] Create auth endpoints:
  - `POST /api/v1/auth/register` — Create account (with email verification)
  - `POST /api/v1/auth/login` — Login (returns JWT)
  - `POST /api/v1/auth/logout` — Invalidate refresh token
  - `POST /api/v1/auth/refresh` — Refresh access token
  - `POST /api/v1/auth/forgot-password` — Initiate password reset
  - `POST /api/v1/auth/reset-password` — Reset password with token
- [ ] Password hashing with bcrypt (cost factor 12+)
- [ ] Account lockout after 5 failed attempts (15 min lockout)
- [ ] Auth middleware for protected routes

#### 2.2 User Management
- [ ] User CRUD API:
  - `GET /api/v1/users/me` — Get current user profile
  - `PATCH /api/v1/users/me` — Update profile
  - `PATCH /api/v1/users/me/password` — Change password
- [ ] Organization/company model:
  - Users belong to organizations
  - Organization stores CustomsCity API credentials (encrypted)
  - Organization stores IOR number, company details

#### 2.3 Role-Based Access Control (RBAC)
- [ ] Define roles:
  - **Owner** — Full access, manage billing & team
  - **Admin** — Manage team, API settings, all filings
  - **Operator** — Create, edit, submit filings
  - **Viewer** — Read-only access to filings and reports
- [ ] Implement permission middleware
- [ ] Role assignment endpoints

#### 2.4 Frontend Auth
- [ ] Create Login page (`/login`)
- [ ] Create Register page (`/register`)
- [ ] Create Forgot/Reset Password pages
- [ ] Implement auth context/store (Zustand)
- [ ] Add protected route wrapper
- [ ] Add auth interceptor to API client (auto-refresh tokens)
- [ ] Update AppLayout with real user data

---

### Phase 3: CustomsCity API Integration Layer
**Priority: 🔴 CRITICAL | Duration: ~4-5 days**

> ⚠️ **BLOCKER:** This phase requires confirmed API documentation and sandbox credentials from CustomsCity.

#### 3.1 CC API Client Service
- [ ] Create a dedicated `CustomsCityClient` class:
  ```typescript
  class CustomsCityClient {
    // Authentication
    authenticate(apiKey: string): Promise<AuthToken>
    
    // ISF 10+2
    createISF10(filing: ISF10CreatePayload): Promise<ISF10Response>
    getISF10(id: string): Promise<ISF10Response>
    updateISF10(id: string, data: ISF10UpdatePayload): Promise<ISF10Response>
    submitISF10(id: string): Promise<SubmissionResponse>
    amendISF10(id: string, data: ISF10AmendPayload): Promise<SubmissionResponse>
    deleteISF10(id: string): Promise<void>
    
    // ISF 5
    createISF5(filing: ISF5CreatePayload): Promise<ISF5Response>
    getISF5(id: string): Promise<ISF5Response>
    submitISF5(id: string): Promise<SubmissionResponse>
    
    // Status
    getFilingStatus(id: string): Promise<FilingStatus>
    getFilingHistory(id: string): Promise<StatusHistory[]>
    
    // Reference Data
    searchHTSCodes(query: string): Promise<HTSCode[]>
    getPorts(): Promise<Port[]>
    getCarriers(): Promise<Carrier[]>
  }
  ```
- [ ] Implement request/response interceptors:
  - Add Authorization headers automatically
  - Log all requests/responses to database
  - Transform errors into standardized format
- [ ] Implement retry logic with exponential backoff (3 retries, 1s → 2s → 4s)
- [ ] Implement circuit breaker pattern (prevent cascading failures)
- [ ] Handle CC API rate limits (respect `Retry-After` headers)

#### 3.2 Data Mapping Layer
- [ ] Create transformers:
  - `internalToCC(shipment: Shipment): CCPayload` — Map our model to CC API format
  - `ccToInternal(ccResponse: CCResponse): Shipment` — Map CC response to our model
- [ ] Handle field normalization (dates, country codes, HTS formatting)
- [ ] Validate payloads before sending to CC (fail fast)

#### 3.3 API Key Management
- [ ] Encrypt CC API keys at rest (AES-256)
- [ ] Store encrypted keys in database per organization
- [ ] Decrypt only in-memory when making CC API calls
- [ ] Support key rotation without downtime

#### 3.4 Webhook Receiver (if CC supports webhooks)
- [ ] Create `POST /api/v1/webhooks/customscity` endpoint
- [ ] Verify webhook signatures (HMAC validation)
- [ ] Process status update events
- [ ] Update filing status in database
- [ ] Trigger user notifications

---

### Phase 4: Core ISF Filing Workflow
**Priority: 🔴 CRITICAL | Duration: ~5-6 days**

#### 4.1 ISF 10+2 Filing API
- [ ] Create backend CRUD endpoints:
  - `POST /api/v1/filings/isf-10` — Create new ISF 10+2 filing
  - `GET /api/v1/filings/isf-10` — List filings (paginated, filterable, sortable)
  - `GET /api/v1/filings/isf-10/:id` — Get single filing with full details
  - `PATCH /api/v1/filings/isf-10/:id` — Update draft filing
  - `DELETE /api/v1/filings/isf-10/:id` — Delete draft filing
  - `POST /api/v1/filings/isf-10/:id/submit` — Submit to CC API → CBP
  - `POST /api/v1/filings/isf-10/:id/amend` — Submit amendment
  - `POST /api/v1/filings/isf-10/:id/cancel` — Cancel a submitted filing

#### 4.2 ISF 5 Filing API
- [ ] Create backend CRUD endpoints:
  - `POST /api/v1/filings/isf-5` — Create new ISF 5 filing
  - `GET /api/v1/filings/isf-5` — List ISF 5 filings
  - `GET /api/v1/filings/isf-5/:id` — Get single ISF 5 filing
  - `PATCH /api/v1/filings/isf-5/:id` — Update draft ISF 5
  - `POST /api/v1/filings/isf-5/:id/submit` — Submit ISF 5

#### 4.3 Filing Status Management
- [ ] Implement status state machine:
  ```
  draft → submitted → pending_cbp → accepted → (amended → accepted)
                    └→ rejected → (edited → resubmitted → pending_cbp)
                    └→ on_hold
  draft → cancelled
  ```
- [ ] Store full status history with timestamps
- [ ] Record CBP transaction references

#### 4.4 Submission Log Service
- [ ] Log every CC API call:
  - Request timestamp, payload (sanitized — no PII in logs)
  - Response status, body, latency
  - Correlation ID linking request → filing
- [ ] Create log query API: `GET /api/v1/submission-logs`

#### 4.5 Auto-Save & Draft Management
- [ ] Implement auto-save for in-progress filings (debounced, every 30s)
- [ ] Support filing templates (save common party/logistics info)
- [ ] Support filing duplication (clone an existing filing)

---

### Phase 5: Real-Time Status & Notifications
**Priority: 🟡 HIGH | Duration: ~3 days**

#### 5.1 Status Polling Service
- [ ] Create background job to poll CC API for status updates
  - Poll every 5 minutes for `submitted`/`pending_cbp` filings
  - Reduce polling frequency for older filings
- [ ] Use a job queue (BullMQ + Redis) for reliability
- [ ] Detect status changes and trigger events

#### 5.2 Notification System
- [ ] Create notification model and API:
  - `GET /api/v1/notifications` — List user notifications
  - `PATCH /api/v1/notifications/:id/read` — Mark as read
  - `POST /api/v1/notifications/read-all` — Mark all as read
- [ ] Notification triggers:
  - Filing accepted by CBP ✅
  - Filing rejected by CBP ❌
  - Filing deadline approaching (72h, 48h, 24h warnings) ⏰
  - Amendment required 📝
  - API connection error 🔴
- [ ] In-app notification bell (replace hardcoded "3" badge)
- [ ] Email notifications (optional, configurable per user)

#### 5.3 Real-Time Updates (Optional Enhancement)
- [ ] WebSocket or Server-Sent Events (SSE) for live dashboard updates
- [ ] Push filing status changes to connected clients instantly

---

### Phase 6: Frontend Upgrade & Data Layer
**Priority: 🔴 CRITICAL | Duration: ~5-6 days**

#### 6.1 API Client Setup
- [ ] Create typed API client with axios or fetch wrapper:
  ```typescript
  // src/api/client.ts
  const api = createApiClient({
    baseURL: import.meta.env.VITE_API_URL,
    // Auto-attach JWT, handle 401 refresh, etc.
  });
  ```
- [ ] Define all API endpoint functions with full TypeScript types
- [ ] Create React Query hooks for every endpoint:
  - `useFilings()`, `useFiling(id)`, `useCreateFiling()`, `useSubmitFiling()`, etc.
  - Proper cache invalidation on mutations
  - Optimistic updates where appropriate

#### 6.2 Replace Mock Data
- [ ] Replace `mockShipments` in Dashboard → `useFilings()` query
- [ ] Replace `mockShipments` in ShipmentsList → `useFilings()` with server-side filters
- [ ] Replace `mockShipments` in ShipmentDetails → `useFiling(id)` query
- [ ] Replace static wizard → `useCreateFiling()` / `useUpdateFiling()` mutations
- [ ] Replace `mockSubmissionLogs` → `useSubmissionLogs()` query
- [ ] Replace `mockActivity` → `useNotifications()` query
- [ ] Replace `mockComplianceScore` → computed from real data
- [ ] Replace `mockWeeklyFilings` → `useFilingStats()` analytics query

#### 6.3 Enhanced Shipment Wizard
- [ ] Expand form to include ALL ISF 10+2 fields:
  - Full address fields for all parties (not just name strings)
  - Importer of Record number
  - Consignee number
  - SCAC code with autocomplete
  - Foreign port of unlading (port selector)
  - Place of delivery (port selector)
  - Estimated arrival date
  - Container numbers (multiple, dynamic)
  - Master vs House Bill of Lading
  - Bond information
  - Multiple commodity lines
- [ ] Add ISF 5 filing wizard (simpler, fewer fields)
- [ ] Filing type selector (ISF 10+2 vs ISF 5) at wizard start
- [ ] Implement `react-hook-form` + `zod` for robust form validation
- [ ] Real-time field validation with clear error messages
- [ ] HTS code lookup/autocomplete (query CC API reference data)
- [ ] Port selector with search (query CC API reference data)
- [ ] Address autocomplete (optional, Google Places API)
- [ ] Save as template functionality

#### 6.4 Global State Management
- [ ] Set up Zustand store for:
  - Auth state (user, organization, tokens)
  - UI state (sidebar collapsed, theme)
  - Notification count
- [ ] Proper loading states (skeletons, not spinners)
- [ ] Error states with retry buttons
- [ ] Empty states with helpful CTAs

---

### Phase 7: Compliance Engine & Validation
**Priority: 🟡 HIGH | Duration: ~3 days**

#### 7.1 Server-Side Validation Engine
- [ ] Create comprehensive validation rules matching CBP requirements:
  - HTS code format validation (6+ digits, valid prefix)
  - HTS code existence check against reference data
  - Country code validation (ISO 3166-1 alpha-2)
  - Port code validation
  - SCAC code validation (4 characters)
  - Date logic (departure must be after today, arrival after departure)
  - Bill of Lading format validation
  - Required field completeness check
  - Address completeness validation
- [ ] Return structured validation errors:
  ```json
  {
    "valid": false,
    "errors": [
      { "field": "commodities[0].htsCode", "code": "INVALID_FORMAT", "message": "HTS code must be at least 6 digits", "severity": "critical" },
      { "field": "shipment.vesselName", "code": "MISSING_FIELD", "message": "Vessel name is required for submission", "severity": "warning" }
    ]
  }
  ```
- [ ] Validation endpoint: `POST /api/v1/filings/isf-10/:id/validate`

#### 7.2 Frontend Compliance Dashboard Upgrade
- [ ] Pull validation results from API instead of simple empty-field checks
- [ ] Show per-filing compliance score
- [ ] Aggregate compliance score across all filings
- [ ] Add "Fix Issues" button linking directly to the problematic field in the wizard
- [ ] Compliance trend over time chart

#### 7.3 Deadline Management
- [ ] Calculate ISF filing deadline (24 hours before vessel departure from foreign port)
- [ ] Generate automated deadline alerts
- [ ] Dashboard deadline countdown with urgency indicators
- [ ] Option to set custom reminder intervals

---

### Phase 8: Security Hardening
**Priority: 🔴 CRITICAL | Duration: ~3-4 days**

#### 8.1 Backend Security
- [ ] Input sanitization (prevent XSS, SQL injection)
- [ ] Request rate limiting per IP and per user:
  - Auth endpoints: 5 requests/min
  - Filing endpoints: 30 requests/min
  - General: 100 requests/min
- [ ] Helmet.js security headers:
  - Content-Security-Policy
  - X-Content-Type-Options
  - X-Frame-Options
  - Strict-Transport-Security
- [ ] CORS whitelist (only allow known frontend origins)
- [ ] Request body size limits (1MB default, 10MB for file uploads)
- [ ] SQL injection prevention (parameterized queries via ORM)
- [ ] API key encryption at rest (AES-256-GCM)
- [ ] Secrets management (environment variables, never hardcoded)
- [ ] Dependency vulnerability scanning (`npm audit`, Snyk, or Dependabot)

#### 8.2 Frontend Security
- [ ] Never store JWT in localStorage (use httpOnly cookies for refresh token, memory for access token)
- [ ] CSRF protection on state-changing requests
- [ ] Content Security Policy meta tags
- [ ] Sanitize all user inputs before display (DOMPurify)
- [ ] Remove all `console.log` in production builds
- [ ] Environment variable validation (fail fast on missing config)
- [ ] Source maps disabled in production

#### 8.3 Data Security
- [ ] Encrypt sensitive data at rest (PII, API keys, tax IDs)
- [ ] Enforce HTTPS everywhere (HSTS)
- [ ] Database connection SSL
- [ ] Regular automated database backups
- [ ] Data retention policy (archive filings older than 5 years per CBP requirements)
- [ ] GDPR/CCPA compliance considerations (data export, deletion rights)

#### 8.4 Audit Logging
- [ ] Log all authentication events (login, logout, failed attempts)
- [ ] Log all filing state changes with actor identity
- [ ] Log all API setting changes
- [ ] Log all role/permission changes
- [ ] Immutable audit log (append-only table)
- [ ] Audit log viewer in admin panel

---

### Phase 9: Testing & Quality Assurance
**Priority: 🟡 HIGH | Duration: ~4-5 days**

#### 9.1 Backend Unit Tests
- [ ] Service layer tests (business logic):
  - ISF 10+2 CRUD operations
  - ISF 5 CRUD operations
  - Validation engine tests (every rule)
  - Data transformation tests (internal ↔ CC format)
  - Status state machine tests
- [ ] Controller/route tests (HTTP layer)
- [ ] Auth middleware tests
- [ ] Achieve **≥80% code coverage**

#### 9.2 Backend Integration Tests
- [ ] Database integration tests (real PostgreSQL via testcontainers)
- [ ] CC API integration tests (mock server with MSW or nock)
- [ ] Auth flow end-to-end (register → login → access resource → refresh → logout)
- [ ] Filing lifecycle test (create → validate → submit → poll status → accept)

#### 9.3 Frontend Unit Tests (Vitest + Testing Library)
- [ ] Component tests:
  - StatusBadge renders correct variants
  - ShipmentWizard form validation
  - Dashboard KPI calculations
  - Compliance issue generation
- [ ] Hook tests (React Query hooks with MSW)
- [ ] Utility function tests

#### 9.4 End-to-End Tests (Playwright)
- [ ] Auth flow: Register → Login → Dashboard
- [ ] Happy path: Create filing → Fill all fields → Submit → See status update
- [ ] Error path: Submit with invalid data → See validation errors → Fix → Resubmit
- [ ] Edit flow: Open existing filing → Edit fields → Save
- [ ] Navigation: All sidebar links work, breadcrumbs, back buttons
- [ ] Responsive: Test on mobile, tablet, desktop viewports
- [ ] Accessibility: Basic a11y checks (keyboard nav, ARIA labels, contrast)

#### 9.5 Performance Testing
- [ ] Lighthouse audit (target: 90+ on all categories)
- [ ] API response time benchmarks (<200ms p95)
- [ ] Load testing with k6 or artillery (100 concurrent users)
- [ ] Database query performance (no N+1 queries, proper indexes)

---

### Phase 10: Deployment & DevOps
**Priority: 🟡 HIGH | Duration: ~3-4 days**

#### 10.1 Containerization
- [ ] Create `Dockerfile` for backend (multi-stage build)
- [ ] Create `Dockerfile` for frontend (nginx serving static build)
- [ ] Create `docker-compose.yml` for local dev (app + Postgres + Redis)
- [ ] Create `docker-compose.prod.yml` for production

#### 10.2 CI/CD Pipeline (GitHub Actions)
- [ ] **On PR:**
  - Lint (ESLint)
  - Type check (TypeScript)
  - Unit tests (Vitest, Jest)
  - Build check
  - Security audit (`npm audit`)
- [ ] **On merge to `main`:**
  - Run full test suite
  - Build Docker images
  - Push to container registry (GitHub Container Registry or AWS ECR)
  - Deploy to staging environment
- [ ] **On release tag:**
  - Deploy to production
  - Run smoke tests
  - Create GitHub release

#### 10.3 Infrastructure
- [ ] **Option A (Recommended for MVP):** Railway / Render / Fly.io
  - Managed PostgreSQL
  - Managed Redis
  - Auto-scaling, SSL, custom domains
- [ ] **Option B (Production Scale):** AWS / GCP
  - ECS/Fargate or Cloud Run for containers
  - RDS PostgreSQL
  - ElastiCache Redis
  - CloudFront CDN for frontend
  - S3 for file storage
  - Route 53 for DNS
  - ACM for SSL certificates
- [ ] Set up staging + production environments
- [ ] Configure custom domain with SSL

#### 10.4 Database Management
- [ ] Automated migration pipeline (run on deploy)
- [ ] Automated daily backups (7-day retention)
- [ ] Point-in-time recovery capability
- [ ] Database monitoring alerts

---

### Phase 11: Monitoring, Analytics & Observability
**Priority: 🟡 HIGH | Duration: ~2-3 days**

#### 11.1 Application Monitoring
- [ ] Error tracking (Sentry) — frontend + backend
- [ ] Performance monitoring (response times, slow queries)
- [ ] Uptime monitoring (external ping service)
- [ ] Alert rules:
  - Error rate > 1% → Slack/email alert
  - P95 response time > 1s → alert
  - CC API errors → immediate alert
  - Database connection failures → immediate alert

#### 11.2 Business Analytics
- [ ] Filing volume metrics (daily/weekly/monthly)
- [ ] Acceptance/rejection rates
- [ ] Average time-to-acceptance
- [ ] Compliance score trends
- [ ] User activity metrics
- [ ] API usage metrics

#### 11.3 Structured Logging
- [ ] JSON-formatted logs (pino or winston)
- [ ] Log aggregation (Datadog, Loki, or CloudWatch)
- [ ] Correlation IDs across request lifecycle
- [ ] Log levels: error, warn, info, debug
- [ ] No PII in logs (mask sensitive fields)

---

### Phase 12: Polish, Documentation & Launch
**Priority: 🟡 HIGH | Duration: ~3-4 days**

#### 12.1 Frontend Polish
- [ ] Loading skeletons for all data-driven pages
- [ ] Empty states for zero-data scenarios
- [ ] Toast notifications for all user actions
- [ ] Keyboard shortcuts (Cmd+K search, Cmd+N new filing)
- [ ] Dark/Light mode toggle (already have `next-themes`)
- [ ] Responsive design audit (mobile sidebar, table scroll)
- [ ] Page transition animations
- [ ] Favicon and meta tags for SEO

#### 12.2 User Onboarding
- [ ] Welcome wizard for new users (connect CC API → create first filing)
- [ ] Contextual help tooltips on ISF fields
- [ ] Filing field descriptions explaining CBP requirements
- [ ] Sample data option for sandbox testing

#### 12.3 Documentation
- [ ] API documentation (Swagger/OpenAPI spec)
- [ ] User guide / help center content
- [ ] Developer README with:
  - Local setup instructions
  - Environment variables reference
  - Architecture overview
  - Deployment guide
- [ ] Changelog (keep updated with each release)

#### 12.4 Legal & Compliance
- [ ] Terms of Service
- [ ] Privacy Policy
- [ ] Data Processing Agreement (DPA)
- [ ] Cookie consent banner
- [ ] Security disclosure policy

---

## 5. Tech Stack Decision

| Layer | Technology | Reason |
|-------|-----------|--------|
| **Frontend** | React 18 + Vite + TypeScript | Already in place, fast, great DX |
| **UI Components** | shadcn/ui + Tailwind CSS | Already in place, accessible, customizable |
| **State Management** | Zustand | Lightweight, TypeScript-native, simple API |
| **Server State** | TanStack React Query | Already in place, caching, optimistic updates |
| **Form Handling** | React Hook Form + Zod | Already has dependencies, best validation |
| **Backend** | Node.js + Express (or Hono) + TypeScript | Fast to build, same language as frontend |
| **ORM** | Prisma | Type-safe, great migrations, widely adopted |
| **Database** | PostgreSQL | Relational, ACID, great for transactional data |
| **Cache/Queue** | Redis + BullMQ | Session store, rate limiting, job queues |
| **Auth** | Custom JWT (or Lucia Auth) | Full control over auth flow |
| **File Storage** | AWS S3 / Cloudflare R2 | Scalable object storage for documents |
| **Email** | Resend or AWS SES | Transactional emails (password reset, alerts) |
| **Testing** | Vitest + Playwright + Jest | Already set up, comprehensive coverage |
| **Monitoring** | Sentry + Pino | Error tracking + structured logging |
| **CI/CD** | GitHub Actions | Integrated with repo, free for public repos |
| **Hosting** | Railway or AWS | Managed infra, easy scaling |

---

## 6. Database Schema Design

```sql
-- Organizations / Companies
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  ior_number      VARCHAR(100),       -- Importer of Record number
  ein_number      VARCHAR(20),        -- Encrypted
  address         JSONB,
  cc_api_key_enc  BYTEA,              -- CustomsCity API key (AES-256 encrypted)
  cc_environment  VARCHAR(20) DEFAULT 'sandbox', -- 'sandbox' | 'production'
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  role            VARCHAR(20) NOT NULL DEFAULT 'operator', -- owner, admin, operator, viewer
  is_active       BOOLEAN DEFAULT TRUE,
  email_verified  BOOLEAN DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  failed_attempts INT DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ISF Filings (supports both ISF 10+2 and ISF 5)
CREATE TABLE filings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by          UUID REFERENCES users(id),
  filing_type         VARCHAR(10) NOT NULL, -- 'ISF-10' | 'ISF-5'
  status              VARCHAR(30) NOT NULL DEFAULT 'draft',
  cc_filing_id        VARCHAR(100),         -- CustomsCity's filing ID
  cbp_transaction_id  VARCHAR(100),         -- CBP transaction reference
  
  -- Importer of Record
  importer_name       VARCHAR(255),
  importer_number     VARCHAR(100),
  
  -- Consignee
  consignee_name      VARCHAR(255),
  consignee_number    VARCHAR(100),
  consignee_address   JSONB,
  
  -- Parties (JSONB for flexibility)
  manufacturer        JSONB,  -- { name, address: { street, city, state, zip, country } }
  seller              JSONB,
  buyer               JSONB,
  ship_to_party       JSONB,
  container_stuffing_location JSONB,
  consolidator        JSONB,
  
  -- Shipment Details
  master_bol          VARCHAR(100),
  house_bol           VARCHAR(100),
  scac_code           VARCHAR(10),
  vessel_name         VARCHAR(255),
  voyage_number       VARCHAR(100),
  foreign_port_of_unlading VARCHAR(10),
  place_of_delivery   VARCHAR(10),
  estimated_departure TIMESTAMPTZ,
  estimated_arrival   TIMESTAMPTZ,
  filing_deadline     TIMESTAMPTZ,
  
  -- Bond Info
  bond_type           VARCHAR(50),
  bond_surety_code    VARCHAR(10),
  
  -- Commodities (array of items)
  commodities         JSONB NOT NULL DEFAULT '[]',
  
  -- Containers (array)
  containers          JSONB NOT NULL DEFAULT '[]',
  
  -- Timestamps
  submitted_at        TIMESTAMPTZ,
  accepted_at         TIMESTAMPTZ,
  rejected_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  amended_at          TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Filing Status History
CREATE TABLE filing_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_id   UUID REFERENCES filings(id) ON DELETE CASCADE,
  status      VARCHAR(30) NOT NULL,
  message     TEXT,
  cc_response JSONB,
  changed_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Submission Logs (API call audit trail)
CREATE TABLE submission_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  filing_id       UUID REFERENCES filings(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES users(id),
  correlation_id  VARCHAR(100),
  method          VARCHAR(10),
  url             TEXT,
  request_payload JSONB,
  response_status INT,
  response_body   JSONB,
  latency_ms      INT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  filing_id   UUID REFERENCES filings(id) ON DELETE SET NULL,
  type        VARCHAR(50) NOT NULL, -- filing_accepted, filing_rejected, deadline_warning, etc.
  title       VARCHAR(255) NOT NULL,
  message     TEXT,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log (immutable)
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id),
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,  -- 'filing.created', 'filing.submitted', 'user.login', etc.
  entity_type VARCHAR(50),
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Filing Templates
CREATE TABLE filing_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES users(id),
  name        VARCHAR(255) NOT NULL,
  filing_type VARCHAR(10) NOT NULL,
  template_data JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_filings_org_id ON filings(org_id);
CREATE INDEX idx_filings_status ON filings(status);
CREATE INDEX idx_filings_created_by ON filings(created_by);
CREATE INDEX idx_filings_filing_deadline ON filings(filing_deadline);
CREATE INDEX idx_filings_master_bol ON filings(master_bol);
CREATE INDEX idx_submission_logs_filing_id ON submission_logs(filing_id);
CREATE INDEX idx_submission_logs_org_id ON submission_logs(org_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
```

---

## 7. Security Checklist

### Pre-Launch Security Requirements

- [ ] **OWASP Top 10** — Verify protection against all categories
- [ ] **Authentication** — JWT with rotation, bcrypt, account lockout
- [ ] **Authorization** — RBAC enforced on every endpoint
- [ ] **Input Validation** — Zod schemas on every request body
- [ ] **SQL Injection** — Parameterized queries only (enforced by ORM)
- [ ] **XSS** — Content-Security-Policy headers, input sanitization
- [ ] **CSRF** — SameSite cookies, CSRF tokens on state changes
- [ ] **Rate Limiting** — Per IP and per user, stricter on auth endpoints
- [ ] **Encryption at Rest** — API keys (AES-256), database encryption
- [ ] **Encryption in Transit** — HTTPS/TLS 1.2+ everywhere
- [ ] **Secrets Management** — Environment variables, never in code
- [ ] **Dependency Security** — Automated vulnerability scanning
- [ ] **Logging** — No PII in logs, structured JSON format
- [ ] **Audit Trail** — Immutable log of all sensitive actions
- [ ] **Backup & Recovery** — Automated backups, tested restore
- [ ] **Error Handling** — No stack traces in production responses
- [ ] **Headers** — Helmet.js (HSTS, X-Content-Type, X-Frame-Options)
- [ ] **File Upload** — Type validation, size limits, virus scanning
- [ ] **Session Management** — Secure, httpOnly, SameSite cookies
- [ ] **API Versioning** — `/api/v1/` prefix for future compatibility

---

## 8. Action Items Before Starting

### 🔴 BLOCKERS (Must resolve before Phase 3)

1. **CustomsCity API Documentation**
   - [ ] Access the full API documentation at `https://app.customscity.com/api-documentation` (requires browser access — cannot be scraped)
   - [ ] Request PDF/OpenAPI export of ISF 10+2 and ISF 5 endpoints from CustomsCity support
   - [ ] Confirm exact endpoint URLs, request/response schemas, and error codes
   - [ ] Identify if webhooks are supported for status updates

2. **CustomsCity API Credentials**
   - [ ] Obtain sandbox API key for development/testing
   - [ ] Understand authentication method (API key header? OAuth? JWT?)
   - [ ] Confirm rate limits and usage quotas

3. **CustomsCity API Environment**
   - [ ] Confirm sandbox URL vs production URL
   - [ ] Understand sandbox limitations (can it simulate CBP responses?)

### 🟡 DECISIONS (Needed before Phase 1)

4. **Hosting Decision**
   - [ ] Choose between Railway (simpler) vs AWS (more control)
   - [ ] This affects Docker setup, CI/CD, and infrastructure code

5. **Domain & Branding**
   - [ ] Secure domain name (e.g., `mycargolens.com`)
   - [ ] SSL certificate plan (Let's Encrypt / ACM)

6. **Email Service**
   - [ ] Choose email provider for transactional emails (Resend recommended)
   - [ ] Set up domain email (e.g., `noreply@mycargolens.com`)

---

## Timeline Summary

| Phase | Name | Duration | Dependencies |
|-------|------|----------|-------------|
| 1 | Foundation & Backend | 3-4 days | — |
| 2 | Authentication | 3-4 days | Phase 1 |
| 3 | CustomsCity Integration | 4-5 days | Phase 1, **API Docs** |
| 4 | Core Filing Workflow | 5-6 days | Phase 2, 3 |
| 5 | Status & Notifications | 3 days | Phase 4 |
| 6 | Frontend Upgrade | 5-6 days | Phase 4 (parallel with 5) |
| 7 | Compliance Engine | 3 days | Phase 4, 6 |
| 8 | Security Hardening | 3-4 days | Phase 1-7 |
| 9 | Testing & QA | 4-5 days | Phase 1-8 |
| 10 | Deployment & DevOps | 3-4 days | Phase 1 (partial), Phase 9 |
| 11 | Monitoring & Analytics | 2-3 days | Phase 10 |
| 12 | Polish & Launch | 3-4 days | All phases |

**Estimated Total: ~42-52 working days (~8-10 weeks)**

> Phases 5 & 6 can run in parallel. Phase 10 should start partially in Phase 1 (Docker setup).

---

## Notes

- This plan assumes a single developer. With a team, phases can be further parallelized.
- The timeline is aggressive but achievable with focused execution.
- Each phase includes its own testing — don't defer all testing to Phase 9.
- Phase 3 is the critical path — getting the CC API docs and credentials should start **immediately**.
- We should aim for an MVP launch after Phase 7 (core functionality complete) and iterate from there.

---

*This is a living document. Update checkboxes as tasks are completed and add notes as decisions are made.*
