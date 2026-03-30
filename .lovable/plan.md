

# MyCargoLens — Implementation Plan

## Overview
A modern SaaS platform for managing U.S. Importer Security Filing (ISF 10+2) compliance. Clean, professional UI with a workflow-driven approach centered around shipment filings.

## Design System
- **Style**: Clean, enterprise SaaS — think Stripe/Linear aesthetic
- **Layout**: Collapsible left sidebar + top header with user info/notifications
- **Status badges**: Draft (gray), Submitted (blue), Accepted (green), Rejected (red)
- **Alerts**: Yellow/red for urgency and deadlines
- **Typography**: Clean sans-serif, clear hierarchy

## Pages & Features (MVP)

### 1. Global Layout
- Left sidebar with navigation: Dashboard, Shipments, Compliance, Integrations, Settings
- Top header bar with notifications bell, user avatar/menu
- Collapsible sidebar with icons in mini mode

### 2. Dashboard
- KPI cards: Total Shipments, Pending Filings, Submitted Today, Rejections
- Recent activity feed (latest submissions, errors)
- Alerts panel (deadline approaching, missing data)

### 3. Shipments Module
**List Page**
- Data table with columns: Bill of Lading, Importer, Status, Departure Date, Filing Deadline, Actions
- Filters (status, date range) + search bar
- "Create New ISF" button

**Create/Edit Page — Multi-step Wizard**
- Step 1: Parties (Manufacturer, Seller, Buyer, Ship-to)
- Step 2: Shipment Info (Bill of Lading, Vessel, Voyage)
- Step 3: Product Info (HTS Code, Country of Origin)
- Step 4: Logistics (Container Stuffing Location, Consolidator)
- Progress indicator, Next/Back navigation, inline validation, auto-save draft

**Shipment Details Page**
- Structured data view with status badge
- Timeline (Created → Submitted → Accepted/Rejected)
- API response section with errors display
- Actions: Edit, Resubmit

### 4. Integrations Module
**API Settings**
- API key input for CustomsCity
- Environment toggle (Sandbox/Production)
- Connection status indicator

**Submission Logs**
- Table: Date, Shipment ID, Request Status, Response
- Expandable rows showing request payload and API response

### 5. Settings (Minimal)
- Profile page placeholder
- Company settings placeholder

## Data & State
- All data managed with React state and mock/sample data (no backend yet)
- Shipment objects with full ISF field structure and status lifecycle
- React Query ready for future API integration

## Navigation Structure
```
/ → Dashboard
/shipments → Shipments List
/shipments/new → Create ISF (Wizard)
/shipments/:id → Shipment Details
/shipments/:id/edit → Edit ISF (Wizard)
/integrations/api → API Settings
/integrations/logs → Submission Logs
/settings → Settings
```

