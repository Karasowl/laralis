# Fix: Treatment Price Recalculation Bug

**Date:** 2025-12-05
**Type:** Bug Fix (P0 Critical)
**Task ID:** N/A (User-reported production bug)

---

## Context

User reported that treatment prices were changing on their own. A treatment saved today with price $500 would show a different price ($400 or another value) after 3-4 days, despite the user never manually changing the price.

## Problem

Treatment prices should be **immutable snapshots** captured at the moment of creation. However, prices were being silently recalculated during unrelated updates (like status changes).

## Root Cause

In `web/hooks/use-treatments.ts`, the `updateTreatment` function had a logic bug in the condition that determines whether to recalculate the price.

### The Bug (Line 212 - Before)

```typescript
const price = data.sale_price
  ? Math.round(data.sale_price * 100)
  : (data.service_id !== existingTreatment.service_id || data.minutes !== undefined || data.margin_pct !== undefined)
    ? Math.round(totalCost * (1 + marginPct / 100))
    : existingTreatment.price_cents
```

The condition `data.service_id !== existingTreatment.service_id` was problematic because:

1. When updating only the status (e.g., changing from "pending" to "completed"), `data` contains only `{ status: 'completed' }`
2. `data.service_id` is `undefined`
3. `existingTreatment.service_id` is a valid UUID like `'abc-123'`
4. **`undefined !== 'abc-123'` evaluates to `true`**
5. This triggers price recalculation even though the service hasn't changed

### Bug Flow Example

1. User saves treatment with price $500 (500000 cents)
2. Days later, user changes status to "completed" via inline dropdown
3. System calls `updateTreatment(id, { status: 'completed' }, treatment)`
4. Bug: `undefined !== 'service-uuid'` is TRUE
5. Price gets recalculated using stored cost values and margin
6. Due to rounding or slight formula differences, price becomes $487 or another value
7. User sees a different price than what they originally set

## What Changed

### File: `web/hooks/use-treatments.ts`

Added explicit check that `service_id` was actually provided before comparing:

```typescript
// BUG FIX: Check if service_id was explicitly provided AND is different
// Previously: `data.service_id !== existingTreatment.service_id` was always true
// when data.service_id was undefined (e.g., status-only updates)
const serviceChanged = data.service_id !== undefined &&
                       data.service_id !== existingTreatment.service_id

const price = data.sale_price
  ? Math.round(data.sale_price * 100)
  : (serviceChanged || data.minutes !== undefined || data.margin_pct !== undefined)
    ? Math.round(totalCost * (1 + marginPct / 100))
    : existingTreatment.price_cents
```

## Files Touched

- `web/hooks/use-treatments.ts` - Fixed `updateTreatment` function (lines 206-221)

## Before vs After

### Before
| Action | Price |
|--------|-------|
| Create treatment with $500 | $500 |
| Change status to completed | $487 (recalculated!) |
| Edit notes | $487 (preserved wrong value) |

### After
| Action | Price |
|--------|-------|
| Create treatment with $500 | $500 |
| Change status to completed | $500 (preserved!) |
| Edit notes | $500 (preserved!) |
| Change service (explicitly) | Recalculated (correct) |

## How to Test

1. Create a new treatment with a specific price (e.g., $500)
2. Note the exact price shown in the table
3. Change the status from "pending" to "completed" using the inline dropdown
4. Verify the price remains $500
5. Edit the treatment, change only notes, save
6. Verify the price still remains $500
7. (Optional) Change the service - this SHOULD recalculate the price

## Risks and Rollback

**Risk Level:** Low

- The fix only affects the price preservation logic
- It does NOT affect price calculation for new treatments
- It does NOT modify any database data
- Rollback: Revert the single change in `use-treatments.ts`

**Note:** Existing treatments that were incorrectly modified cannot be automatically restored. Users will need to manually correct any affected prices.

## Follow-ups

- [ ] Consider adding a database trigger that prevents `price_cents` updates unless explicitly allowed
- [ ] Add unit tests for `updateTreatment` with various partial update scenarios
- [ ] Consider logging when prices are recalculated for debugging

## Technical Details

### Why the price changed to different values?

When recalculating, the formula uses:
```typescript
Math.round(totalCost * (1 + marginPct / 100))
```

Where:
- `totalCost = fixedCost + variableCost`
- `fixedCost = fixedPerMinuteCents * minutes`

The stored `margin_pct` might have been rounded or the user might have set a custom price that doesn't match the cost+margin formula exactly. When recalculated, the formula produces a different result.

### Similar pattern (already correct)

Line 196 in the same file already had the correct pattern:
```typescript
if (data.service_id && data.service_id !== existingTreatment.service_id) {
  variableCost = selectedService.variable_cost_cents || 0
}
```

This uses `data.service_id &&` to ensure it's truthy before comparing.
