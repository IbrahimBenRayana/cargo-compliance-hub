# MyCargoLens — Agent Handoff Context Document

> **Date:** March 30, 2026
> **Purpose:** Complete context for continuing development of the MyCargoLens ISF compliance platform.

---

## 1. Project Overview

**MyCargoLens** is a web-based SaaS platform that helps importers manage and comply with U.S. Importer Security Filing (ISF 10+2) requirements. It allows users to create, validate, and submit shipment filings, ensuring all required data is accurate and complete before transmission to U.S. Customs and Border Protection (CBP) via the **CustomsCity API**.

---

## 2. Repository & Workspace

- **Repo:** `https://github.com/IbrahimBenRayana/cargo-compliance-hub.git`
- **Local path:** `/Users/mac/Desktop/MyCargoLens/cargo-compliance-hub`
- **Branch:** `main`

---

## 3. Current Tech Stack (Frontend Only — No Backend Yet)

| Technology | Purpose |
|-----------|---------|
| React 18 | UI framework |
| Vite | Build tool |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| shadcn/ui | Component library (49 components in `src/components/ui/`) |
| TanStack React Query | Server state (installed but using mock data) |
| React Router DOM | Routing (9 routes) |
| Recharts | Charts on dashboard |
| React Hook Form + Zod | Form handling (installed, not fully used) |
| Vitest + Playwright | Testing (placeholder only) |
| date-fns | Date formatting |
| Sonner | Toast notifications |
| Lucide React | Icons |

---

## 4. Current Project Structure

```
src/
├── App.tsx                    # Routes: /, /shipments, /shipments/new, /shipments/:id, /shipments/:id/edit, /compliance, /integrations/api, /integrations/logs, /settings
├── main.tsx
├── App.css / index.css
├── components/
│   ├── AppLayout.tsx          # Sidebar + header shell with Outlet
│   ├── AppSidebar.tsx         # Collapsible sidebar nav (Navigation + Integrations groups)
│   ├── NavLink.tsx            # React Router NavLink wrapper
│   ├── StatusBadge.tsx        # Colored badge for draft/submitted/accepted/rejected
│   └── ui/                    # 49 shadcn/ui components
├── pages/
│   ├── Dashboard.tsx          # KPI cards, recent shipments table, charts (status donut, weekly filings bar, country donut, compliance radial), activity feed, upcoming deadlines
│   ├── ShipmentsList.tsx      # Filterable/sortable table with search, status/country/date filters
│   ├── ShipmentDetails.tsx    # Timeline, data sections (Parties, Shipment Info, Product, Logistics), API response display
│   ├── ShipmentWizard.tsx     # 4-step wizard: Parties → Shipment Info → Product Info → Logistics
│   ├── CompliancePage.tsx     # Auto-validates draft filings for missing fields, severity levels
│   ├── IntegrationsApi.tsx    # API key input, sandbox/production toggle, connection status (all static)
│   ├── SubmissionLogs.tsx     # Expandable log rows with request/response JSON
│   ├── SettingsPage.tsx       # Profile form + company settings (static)
│   ├── Index.tsx              # Redirects to Dashboard
│   └── NotFound.tsx
├── data/
│   └── mock-data.ts           # 5 mock shipments, 3 submission logs, 5 activity items, weekly filings, compliance score
├── types/
│   └── shipment.ts            # TypeScript interfaces (Shipment, ShipmentParties, ShipmentInfo, ProductInfo, LogisticsInfo, SubmissionLog, ActivityItem)
├── hooks/
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts               # cn() helper
└── test/
    ├── setup.ts
    └── example.test.ts         # Placeholder test
```

---

## 5. Current Data Model (INCOMPLETE for real ISF 10+2)

```typescript
// src/types/shipment.ts
export type ShipmentStatus = 'draft' | 'submitted' | 'accepted' | 'rejected';

export interface ShipmentParties {
  manufacturer: string;    // Just name, needs full address
  seller: string;          // Just name, needs full address
  buyer: string;           // Just name, needs full address
  shipToParty: string;     // Just name, needs full address
}

export interface ShipmentInfo {
  billOfLading: string;
  vesselName: string;
  voyageNumber: string;
  // MISSING: SCAC code, foreign port of unlading, place of delivery, estimated arrival, container numbers, master vs house BOL
}

export interface ProductInfo {
  htsCode: string;
  countryOfOrigin: string;
  description: string;
  // MISSING: quantity, weight, value, multiple commodity lines
}

export interface LogisticsInfo {
  containerStuffingLocation: string;  // Just name, needs full address
  consolidator: string;               // Just name, needs full address
  // MISSING: container numbers, seal numbers
}

export interface Shipment {
  id: string;
  status: ShipmentStatus;
  parties: ShipmentParties;
  shipmentInfo: ShipmentInfo;
  productInfo: ProductInfo;
  logistics: LogisticsInfo;
  importerName: string;
  departureDate: string;
  filingDeadline: string;
  createdAt: string;
  submittedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  apiResponse?: string;
  // MISSING: importerOfRecordNumber, consigneeNumber, bondType, entryType, ccFilingId, cbpTransactionId
}
```

---

## 6. What's Currently Missing (Gaps)

| Category | Gap |
|----------|-----|
| **Backend** | No backend server — everything is frontend-only with mock data |
| **Database** | No database — all data hardcoded in `mock-data.ts` |
| **Authentication** | No auth system — no login, no sessions, no roles |
| **API Integration** | No real CustomsCity API integration — settings page is static |
| **Data Persistence** | No CRUD — wizard submits to nothing, edits don't persist |
| **ISF 5 Support** | Only ISF 10+2 fields — no ISF 5 support at all |
| **File Uploads** | No document attachments |
| **Notifications** | Hardcoded "3" badge — no real notification system |
| **Error Handling** | No global error boundaries, no retry logic |
| **Testing** | Only placeholder test file |
| **Deployment** | No CI/CD, no Docker, no infrastructure |

---

## 7. CustomsCity API — What We've Discovered

### API Environments

| Environment | App URL | API Base URL |
|------------|---------|-------------|
| **Sandbox (CERT)** | `https://cert.customscity.com` | `https://api-cert.customscity.com` |
| **Production** | `https://app.customscity.com` | `https://api.customscity.com` |

### Authentication

- **Method:** Bearer token in `Authorization` header
- **Format:** `Authorization: Bearer <JWT_TOKEN>`
- **Sandbox API Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6ImFjY2VzcyJ9.eyJpYXQiOjE3NzQ4ODY2NjgsImV4cCI6MTgwNjQyMjY2OCwiYXVkIjoiaHR0cHM6Ly95b3VyZG9tYWluLmNvbSIsImlzcyI6ImZlYXRoZXJzIiwic3ViIjoiNjljNTU4Nzg0ODg4OGEyMWJmYWQxNDQ5IiwianRpIjoiYmExMjRiOTYtMTQzMS00N2U5LWI2YzgtMzA1Njg5Njc1NGFhIn0.Yl97v2hgv-A5lTzPmtM2qxDcNuq2VcL8Q7sd5qZWWFE`
- **Token type:** FeathersJS JWT (HS256, expires 2027-03-27)
- **IMPORTANT:** Using sandbox token against production API returns: `"User not found in PRODUCTION. Using token from CERT environment?"`

### Confirmed API Endpoints (from screenshots + probing)

#### documents — Core Filing CRUD
| Method | Endpoint | Description | Notes |
|--------|----------|-------------|-------|
| `GET` | `/api/documents` | Get Documents | Requires: `dateFrom`, `dateTo`, `type`, `skip`. Type can be "ISF". Returns `{total, skip, limit, data:[]}` |
| `POST` | `/api/documents` | Creates a new document | Body needs `body` array (FeathersJS pattern). Sent empty `{}` → got `"data.body is not iterable"` |
| `PUT` | `/api/documents` | Update a document | |
| `DELETE` | `/api/documents` | Delete Documents | |

#### abi/documents — ABI Document Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/abi/documents` | Get ABI Documents |
| `POST` | `/api/abi/documents` | Creates a new ABI document |
| `DELETE` | `/api/abi/documents` | Deletes ABI documents by entry number or MBOL number |

#### abi/send — Send ABI Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/abi/send` | Send ABI Documents |

#### messages — CBP Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/messages` | Get Messages (likely CBP response messages) |

#### pdf-reports — Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/pdf-reports` | Detailed Report |
| `GET` | `/api/pdf-reports/summary` | Summary Report |

#### reports — Duty/CBP Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reports/duty-fees` | Get Duty Fees Report |
| `GET` | `/api/reports/duty-fees-hts` | Get Duty Fees HTS Report |
| `POST` | `/api/reports/duty-fees-hts-json` | Get Duty Fees HTS JSON Report |
| `GET` | `/api/reports/7501` | Get 7501 CBP Report |
| `GET` | `/api/reports/7501/{id}` | Get Status 7501 CBP Report |

#### send — Submit Documents to CBP
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/send` | Send Documents (this is the submission endpoint) |

#### document-status — Filing Status
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/document-status` | Get document processing status |

#### document-holds — CBP Holds
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/document-holds` | Get documents on hold by CBP |

#### products — Product/HTS Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/products` | Create product |
| `PUT` | `/api/products` | Update product |

#### review-hts — HTS Review
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/review-hts` | Review HTS classification |

#### manifest-query — Manifest Queries
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/manifest-query` | Submit manifest query |
| `GET` | `/api/ManifestQueryLatestResponse` | Find latest manifest query response |
| `GET` | `/api/ManifestQueryByID/{RequestId}` | Get manifest query by request ID |

#### change-entry-number
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/change-entry-number` | Change entry number on a filing |

#### Create DIS
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/dis` | Create DIS (Document Image System) |

#### Manufacturer (MID)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/query/mid` | Get MID from CustomsCity |
| `POST` | `/api/query/mid` | Create MID |
| `PUT` | `/api/query/mid` | Update MID |
| `POST` | `/api/query/mid/retrieve` | Create MID by asking CBP |
| `GET` | `/api/query/mid/list` | Get Manufacturer list |

#### CargoReleaseMID
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cargo-release-mid` | Create CargoReleaseMID |

#### DutyCalculation
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/duty-calculation-tool` | Calculate duties |
| `POST` | `/api/duty-calculation-tool-ai` | Calculate duties using AI |

#### HTS Classifier (AI)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/hts-classifier` | Classify items by description using AI |

#### DDP
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/calculate-ddp` | Calculate DDP (Delivered Duty Paid) |

#### Webhooks — Status Callbacks
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | Webhook: AIR AMS/ACAS | Webhook for Air AMS/ACAS |
| `POST` | Webhook: ABI | Webhook for ABI |
| `POST` | Webhook: ABI Type 86 | Webhook for ABI Type 86 |
| `POST` | Webhook: Ocean AMS | Webhook for Ocean AMS |
| `POST` | Webhook: ISF | **THIS IS KEY — Webhook for ISF status updates** |

There is also a **Schemas** section at the bottom of the API docs (collapsed in screenshots) that we need to expand to see the full data models.

### Key API Findings

1. **Document-centric API:** CustomsCity uses a generic `/api/documents` endpoint for ALL filing types (ISF, ABI, etc.), distinguished by a `type` field
2. **ISF filing flow:** Create document (`POST /api/documents`) → Send to CBP (`POST /api/send`) → Check status (`GET /api/document-status`) → Receive webhook updates
3. **The `body` field is an array** — ISF document body likely contains structured line items
4. **Webhooks are supported for ISF** — We can receive real-time status updates
5. **AI-powered HTS classification** is available via `/api/hts-classifier`
6. **MID (Manufacturer ID) management** has full CRUD + CBP retrieval
7. **FeathersJS patterns** — Pagination uses `{total, skip, limit, data:[]}` format

### What We Still Need to Discover

The **critical missing piece** is the exact schema/payload for creating an ISF document via `POST /api/documents`. We need to:

1. **Expand the "Schemas" section** at the bottom of `https://cert.customscity.com/api-documentation` to see all data models
2. **Expand each endpoint** (click the chevron ▼ on each row) to see request/response bodies
3. Specifically need the ISF document `body` array structure for `POST /api/documents`
4. Need the `POST /api/send` payload structure
5. Need the `GET /api/document-status` query parameters and response format
6. Need the ISF webhook payload format

**The best approach to get these schemas:** 
- Open `https://cert.customscity.com/api-documentation` in a browser
- Click on `POST /api/documents` → expand it → look at the request body schema
- Click on the **Schemas** section at the bottom → expand all models
- Screenshot or copy those schemas

---

## 8. Hosting Decision

- **Domain:** `macargolens.com` (purchased on GoDaddy)
- **Hosting:** GoDaddy
- **Note:** Will need to determine if GoDaddy plan supports Node.js backend + PostgreSQL, or if we need to use a VPS/cloud provider and just point the GoDaddy domain DNS to it.

---

## 9. Detailed Project Plan

A comprehensive project plan exists at `/Users/mac/Desktop/MyCargoLens/cargo-compliance-hub/PROJECT_PLAN.md` with:

- 12 execution phases
- Full database schema (PostgreSQL)
- Architecture diagram (React frontend → Node.js BFF → CustomsCity API)
- Security checklist
- Timeline (~8-10 weeks)

### Phase Summary

| Phase | Name | Duration | Status |
|-------|------|----------|--------|
| 1 | Foundation & Backend Infrastructure | 3-4 days | Not started |
| 2 | Authentication & User Management | 3-4 days | Not started |
| 3 | CustomsCity API Integration Layer | 4-5 days | **Partially explored** — need exact schemas |
| 4 | Core ISF Filing Workflow | 5-6 days | Not started |
| 5 | Real-Time Status & Notifications | 3 days | Not started |
| 6 | Frontend Upgrade & Data Layer | 5-6 days | Not started |
| 7 | Compliance Engine & Validation | 3 days | Not started |
| 8 | Security Hardening | 3-4 days | Not started |
| 9 | Testing & Quality Assurance | 4-5 days | Not started |
| 10 | Deployment & DevOps | 3-4 days | Not started |
| 11 | Monitoring, Analytics & Observability | 2-3 days | Not started |
| 12 | Polish, Documentation & Launch | 3-4 days | Not started |

---

## 10. Immediate Next Steps

1. **Get the ISF document creation schema** — Open `https://cert.customscity.com/api-documentation` in browser, expand `POST /api/documents`, expand `POST /api/send`, and expand the **Schemas** section at the bottom. Screenshot everything.

2. **Probe the API endpoints with curl** to discover schemas by sending empty/minimal payloads and reading validation errors:
   ```bash
   # Set auth header
   AUTH="Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6ImFjY2VzcyJ9.eyJpYXQiOjE3NzQ4ODY2NjgsImV4cCI6MTgwNjQyMjY2OCwiYXVkIjoiaHR0cHM6Ly95b3VyZG9tYWluLmNvbSIsImlzcyI6ImZlYXRoZXJzIiwic3ViIjoiNjljNTU4Nzg0ODg4OGEyMWJmYWQxNDQ5IiwianRpIjoiYmExMjRiOTYtMTQzMS00N2U5LWI2YzgtMzA1Njg5Njc1NGFhIn0.Yl97v2hgv-A5lTzPmtM2qxDcNuq2VcL8Q7sd5qZWWFE"
   BASE="https://api-cert.customscity.com"
   
   # Test basic connectivity
   curl -s -H "$AUTH" "$BASE/api/documents?type=ISF&dateFrom=2025-01-01&dateTo=2026-12-31&skip=0" | python3 -m json.tool
   # Returns: {"total": 0, "skip": 0, "limit": 500, "data": []}
   
   # Probe document creation (need to discover body schema)
   curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" -d '{"body": []}' "$BASE/api/documents" | python3 -m json.tool
   
   # Probe document status
   curl -s -H "$AUTH" "$BASE/api/document-status" | python3 -m json.tool
   
   # Probe messages
   curl -s -H "$AUTH" "$BASE/api/messages" | python3 -m json.tool
   
   # Probe HTS classifier (confirmed working)
   curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" -d '{"description": "laptop computer"}' "$BASE/api/hts-classifier" | python3 -m json.tool
   
   # Probe MID list
   curl -s -H "$AUTH" "$BASE/api/query/mid/list" | python3 -m json.tool
   
   # Probe send endpoint
   curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" -d '{}' "$BASE/api/send" | python3 -m json.tool
   ```

3. **Start Phase 1** — Set up the Node.js + TypeScript backend with Express/Hono

4. **Start Phase 2** — Authentication system

---

## 11. Key Architecture Decisions Made

1. **Backend-for-Frontend (BFF) is required** — CC API keys must never be in frontend code
2. **PostgreSQL** for primary database (relational, ACID for financial/compliance data)
3. **Redis** for sessions, caching, rate limiting, and job queues
4. **JWT authentication** with access + refresh token rotation
5. **Role-Based Access Control** — Owner, Admin, Operator, Viewer roles
6. **All CC API calls proxied through our backend** — with logging, retry, circuit breaker
7. **Webhook receiver endpoint** for ISF status updates from CustomsCity

---

*This document contains everything needed to continue development from this point.*

---

## 12. Background Jobs Engine (Added: Session 5)

### Files Created
- `server/src/services/backgroundJobs.ts` — Core scheduler with 3 cron jobs

### Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| **Status Polling** | Every 5 min | Queries CC `/api/document-status` + `/api/messages` for all `submitted` filings, auto-updates to accepted/rejected/on_hold, creates notifications |
| **Deadline Alerts** | Every hour (:30) | Scans filings with approaching deadlines, sends alerts at 72h/48h/24h thresholds, flags overdue drafts |
| **Stale Filing Check** | Every 6 hours | Flags filings submitted >72h ago with no CBP response |

### Key Behaviors
- **Duplicate prevention**: Uses in-memory `Set<string>` to track sent deadline alerts (keyed by `${filingId}_${threshold}h`)
- **Concurrency guard**: Boolean locks prevent overlapping runs of the same job
- **Rate limiting**: 500ms delay between CC API calls within a polling cycle
- **Max batch size**: 50 filings per poll cycle
- **Graceful shutdown**: `stopBackgroundJobs()` called on SIGTERM/SIGINT

### API Endpoints Added
- `GET /api/health` — Now includes `jobs` status object
- `GET /api/v1/jobs/status` — Returns current job state, last run times, stats
- `POST /api/v1/jobs/trigger-status-poll` — Manual trigger for testing
- `POST /api/v1/jobs/trigger-deadline-check` — Manual trigger for testing

### Modified Files
- `server/src/index.ts` — Added background job import, startup, graceful shutdown, job status endpoints

### First Run Results (Live)
- ✅ Found 2 submitted filings, polled CC API, detected `MAEU1775498031` REJECTED ("CONT BOND NOT ON FILE")
- ✅ Automatically updated filing status, created status history, logged API call, sent rejection notification
- ✅ Found 5 filings with deadline issues: 1 approaching (72h alert), 4 overdue (penalty warnings)

---

## 13. Filing Templates + Duplicate (Added: Session 5)

### Feature Overview
Importers filing the same trade lanes repeatedly can now:
1. **Save any filing as a template** (parties, ports, HTS, bond type — excludes BOL/voyage/dates/containers)
2. **Create a new filing from a template** with one click from the Shipments list
3. **Duplicate any filing** as a new draft with pre-filled data

### Backend Files Created/Modified
- `server/src/routes/templates.ts` — Full CRUD for `FilingTemplate` model
  - `GET /api/v1/templates` — List org templates (with search/filter)
  - `GET /api/v1/templates/:id` — Get single template
  - `POST /api/v1/templates` — Create template manually
  - `PATCH /api/v1/templates/:id` — Update template
  - `DELETE /api/v1/templates/:id` — Delete template
  - `POST /api/v1/templates/:id/apply` — Create new draft filing from template
- `server/src/routes/filings.ts` — Added:
  - `POST /api/v1/filings/:id/duplicate` — Clone filing as new draft (clears BOL/voyage/containers)
  - `POST /api/v1/filings/:id/save-template` — Extract reusable data from filing into template
- `server/src/index.ts` — Registered `/api/v1/templates` route

### Frontend Files Modified
- `src/api/client.ts` — Added `templatesApi` object + `filingsApi.duplicate()` + `filingsApi.saveAsTemplate()`
- `src/hooks/useFilings.ts` — Added hooks: `useTemplates`, `useTemplate`, `useCreateTemplate`, `useUpdateTemplate`, `useDeleteTemplate`, `useApplyTemplate`, `useDuplicateFiling`, `useSaveFilingAsTemplate`
- `src/pages/ShipmentDetails.tsx` — Added "⋯" More Actions dropdown menu with:
  - "Duplicate as New Draft" — clones filing and navigates to editor
  - "Save as Template" — opens dialog to name and save template
  - "Cancel Filing" — moved into dropdown for cleaner UI
- `src/pages/ShipmentsList.tsx` — Added "From Template" dropdown button next to "Create New ISF"
  - Shows all saved templates with filing type badge
  - One-click applies template and navigates to editor

### Prisma Model (already existed)
```
model FilingTemplate {
  id, orgId, createdById, name, filingType, templateData (JSON), createdAt, updatedAt
}
```
