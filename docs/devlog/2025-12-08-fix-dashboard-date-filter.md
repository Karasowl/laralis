# Fix: Dashboard Date Filter Not Applied to All Components

**Date:** 2025-12-08
**PR:** N/A
**TASK:** N/A

---

## Context

The Dashboard page (`web/app/page.tsx`) has a `DateFilterBar` component with `useDateFilter` hook, but NOT ALL metrics were respecting the date filter. Some components were loading data independently without considering the selected date range.

## Problem

When a user selected a different date range (e.g., "This Week" or "This Quarter"), some metrics would update but others remained static:

**Components that DID respect the filter:**
- `useDashboard` - Revenue, expenses, treatments, patients metrics
- `useProfitAnalysis` - But was using `customRange` instead of `currentRange`
- `usePlannedVsActual` - But was using `customRange` instead of `currentRange`

**Components that did NOT respect the filter:**
- `useReports` - Always loaded default 6-month lookback
- `useServiceROI` - Always used `days: 30` fixed
- `useMarketingMetrics` - Always used `period: 30` fixed
- `useChannelROI` - Always used `period: 30` fixed

## Root Cause

1. Hooks were not receiving date range parameters
2. APIs had hardcoded date ranges
3. Dashboard page was not passing `currentRange` to hooks

## What Changed

### Modified Files

| File | Change |
|------|--------|
| `hooks/use-reports.ts` | Added `startDate` and `endDate` parameters |
| `hooks/use-service-roi.ts` | Added `startDate` and `endDate` parameters |
| `hooks/use-marketing-metrics.ts` | Added `startDate` and `endDate` parameters |
| `hooks/use-channel-roi.ts` | Added `startDate` and `endDate` parameters |
| `api/analytics/service-roi/route.ts` | Added support for `startDate` and `endDate` query params |
| `api/analytics/marketing-metrics/route.ts` | Added support for `startDate` and `endDate` query params |
| `api/analytics/channel-roi/route.ts` | Added support for `startDate` and `endDate` query params |
| `app/page.tsx` | Pass `currentRange.from` and `currentRange.to` to all affected hooks |

### Before vs After

**Before:**
```typescript
// All hooks used fixed date ranges
useReports({ clinicId: currentClinic?.id })
useServiceROI({ clinicId: currentClinic?.id, days: 30 })
useMarketingMetrics({ clinicId: currentClinic?.id, period: 30 })
useChannelROI({ clinicId: currentClinic?.id, period: 30 })
useProfitAnalysis({ clinicId, startDate: customRange?.from })
```

**After:**
```typescript
// All hooks now use currentRange from date filter
useReports({
  clinicId: currentClinic?.id,
  startDate: currentRange?.from,
  endDate: currentRange?.to
})
useServiceROI({
  clinicId: currentClinic?.id,
  startDate: currentRange?.from,
  endDate: currentRange?.to
})
useMarketingMetrics({
  clinicId: currentClinic?.id,
  startDate: currentRange?.from,
  endDate: currentRange?.to
})
useChannelROI({
  clinicId: currentClinic?.id,
  startDate: currentRange?.from,
  endDate: currentRange?.to
})
useProfitAnalysis({
  clinicId,
  startDate: currentRange?.from,
  endDate: currentRange?.to
})
```

## Components Intentionally NOT Filtered

These components should NOT be filtered by date (by design):

| Component | Hook | Reason |
|-----------|------|--------|
| Break Even Progress | `useEquilibrium` | Structural calculation for current month |
| CAC Trend Chart | `useCACTrend` | Historical 12-month trend |
| Acquisition Trends | `useAcquisitionTrends` | Historical 12-month trend |

## How to Test

1. Open the Dashboard at `/`
2. Use the date filter buttons (Today, This Week, This Month, Quarter, Year, Custom)
3. Verify all metrics update accordingly:
   - Revenue metrics cards
   - Financial metrics (Gross Profit, EBITDA, Net Profit)
   - Business Metrics Grid
   - Planned vs Actual card
   - Service ROI Analysis table
   - Marketing Metrics
   - Channel ROI Chart
4. Verify these do NOT change (intentional):
   - Break Even Progress bar
   - CAC Trend Chart (always 12 months)
   - Acquisition Trends (always 12 months)

## Risks and Rollback

**Low risk** - Changes are backward compatible:
- APIs still support the old `days`/`period` parameters
- Hooks fall back to default behavior if no dates provided

**Rollback:** Revert the changes to `page.tsx` to restore original behavior.

## Follow-ups

- [ ] Consider adding visual indicator when filter is active
- [ ] Add loading states when switching date ranges
- [ ] Consider caching API responses by date range
