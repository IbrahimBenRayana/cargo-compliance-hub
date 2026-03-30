

# Dashboard Redesign — Premium, Animated, Data-Rich

## What Changes

The current dashboard is functional but plain — static KPI cards, a text-only activity list, and a deadlines list. We'll transform it into a visually stunning, animated dashboard with charts, progress indicators, and modern data visualization.

## New Dashboard Layout

```text
┌─────────────────────────────────────────────────────────┐
│  Welcome Header (greeting + date + quick action button) │
├────────┬────────┬────────┬────────┬─────────────────────┤
│ KPI 1  │ KPI 2  │ KPI 3  │ KPI 4  │  (animated cards    │
│ +trend │ +trend │ +trend │ +trend │   with counters)    │
├────────┴────────┴────────┴────────┴─────────────────────┤
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ Status Donut     │  │ Filings by Month │             │
│  │ Chart (Recharts) │  │ Bar Chart        │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ Country of Origin│  │ Compliance Score │             │
│  │ Donut Chart      │  │ Radial Progress  │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                         │
│  ┌─────────────────────┐  ┌────────────────────┐        │
│  │ Recent Activity     │  │ Upcoming Deadlines │        │
│  │ (enhanced timeline) │  │ (progress bars)    │        │
│  └─────────────────────┘  └────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

## New Components & Features

### 1. Animated KPI Cards (enhanced)
- Animated number counter (counts up on mount)
- Subtle trend indicator (+12% vs last week, mock data)
- Gradient icon backgrounds with soft glow
- Staggered fade-in animation on page load

### 2. Status Distribution — Donut Chart
- Recharts PieChart with inner radius (donut)
- Center label showing total count
- Custom colors matching status badge palette
- Hover tooltips with percentages
- Uses existing `ChartContainer` and `ChartTooltip` from `chart.tsx`

### 3. Filings Over Time — Bar Chart
- Weekly filing volume bar chart (mock data for last 8 weeks)
- Gradient-filled bars
- Clean axis labels

### 4. Country of Origin — Donut Chart
- Shows shipment distribution by origin country (CN, JP, VN, IN, DE)
- Country flag emoji or code labels

### 5. Compliance Score — Radial Progress
- A single radial/gauge showing overall compliance health (e.g., 78%)
- Color-coded (green > 80, yellow > 60, red below)
- Animated fill on mount

### 6. Enhanced Activity Feed
- Colored left border per activity type
- Relative timestamps ("2 hours ago")
- Smooth enter animations

### 7. Enhanced Deadlines
- Visual progress bar showing time remaining vs total window
- Color transitions as deadline approaches (green → yellow → red)

## Files Modified

1. **`src/pages/Dashboard.tsx`** — Complete rewrite with all new sections
2. **`src/data/mock-data.ts`** — Add `mockWeeklyFilings` and `mockComplianceScore` data
3. **`tailwind.config.ts`** — Add fade-in-up staggered keyframes and counter animation

## Technical Details

- Recharts `PieChart` (donut) and `BarChart` via existing `recharts` dependency and `chart.tsx` primitives
- CSS keyframe animations for staggered card entrances (`animation-delay` per card)
- `useEffect` + `useState` for animated number counters (requestAnimationFrame-based)
- All mock data — no backend dependency
- Fully responsive grid layout

