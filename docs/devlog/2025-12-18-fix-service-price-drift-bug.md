# Fix: Service prices changing unexpectedly over time

**Date**: 2025-12-18
**PR**: TBD
**TASK**: TASK-20251218-fix-price-drift

## Context

Users reported that service prices (the "Precio con Utilidad" column in the services table) were changing by themselves over time. For example, "Prótesis total" was saved with a price of $2,250.00 but later appeared as $2,250.60.

## Problem

The `price_cents` field in services was being recalculated automatically by a database trigger whenever any service field was updated, even if the price wasn't explicitly changed.

## Root Cause

The trigger `services_calculate_final_price_trigger` (defined in migration 49) was designed to:

1. Calculate `total_cost_cents` from `fixed_cost_per_minute_cents * est_minutes + variable_cost_cents`
2. Calculate `original_price` as `cost * (1 + margin_pct / 100)`
3. Apply discounts to get `price_cents`

**The problem**: Steps 1-2 would recalculate the price based on cost fields stored in the `services` table. These fields (`fixed_cost_per_minute_cents`, `variable_cost_cents`) were:

- Not updated when editing a service (API didn't send them)
- Potentially stale or null
- Different from the dynamically calculated costs shown in the UI

**The trigger fired when**: `est_minutes`, `margin_pct`, `discount_type`, or `discount_value` changed. Since the API always sent these fields in updates, the trigger would fire on ANY edit (even just changing the name), recalculating and overwriting the user's price.

## What Changed

### 1. Added `original_price_cents` column to services

This stores the price BEFORE any discount is applied. It's the "base price" the user sets, and discounts are calculated from this value.

```sql
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS original_price_cents BIGINT;
```

### 2. Rewrote the trigger function

The new trigger:
- **NEVER recalculates price** from costs (that's done dynamically by the frontend)
- **ONLY applies discounts** to `original_price_cents`
- **Only fires** on changes to `original_price_cents`, `discount_type`, or `discount_value`

```sql
CREATE TRIGGER services_calculate_final_price_trigger
  BEFORE INSERT OR UPDATE OF original_price_cents, discount_type, discount_value
  ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION calculate_service_final_price();
```

### 3. Updated API to use `original_price_cents`

- POST `/api/services` now saves `original_price_cents` instead of `price_cents`
- PUT `/api/services/[id]` now sends `original_price_cents`
- The trigger calculates `price_cents` automatically from `original_price_cents + discount`

### 4. Updated frontend discount modals

- `SingleDiscountModal` now uses `original_price_cents` as the base price
- `BulkDiscountModal` now uses `original_price_cents` as the base price
- Both fall back to `price_cents` for backwards compatibility

## Files Touched

| File | Change |
|------|--------|
| `supabase/migrations/68_fix_price_recalculation_bug.sql` | New migration: adds column, migrates data, rewrites trigger |
| `web/app/api/services/route.ts` | POST uses `original_price_cents` |
| `web/app/api/services/[id]/route.ts` | PUT uses `original_price_cents` |
| `web/app/services/page.tsx` | Discount handlers send `original_price_cents` |
| `web/app/services/components/SingleDiscountModal.tsx` | Uses `original_price_cents` for preview |
| `web/app/services/components/BulkDiscountModal.tsx` | Uses `original_price_cents` for preview |

## Before vs After

### Before
```
User saves service with price $2,250.00
       ↓
Days later, edits the service name
       ↓
Trigger fires because est_minutes/margin_pct are in the UPDATE
       ↓
Trigger recalculates: cost * (1 + margin) using stale cost fields
       ↓
Price changes to $2,250.60 (or any other unexpected value)
```

### After
```
User saves service with price $2,250.00
       ↓
original_price_cents = 225000 (stored)
price_cents = 225000 (calculated by trigger, same since no discount)
       ↓
Days later, edits the service name
       ↓
Trigger does NOT fire (name is not in the trigger column list)
       ↓
Price remains $2,250.00
       ↓
User applies 10% discount
       ↓
Trigger fires: price_cents = original_price_cents * 0.9 = $2,025.00
```

## How to Test

1. Run migration 68 in Supabase
2. Create a new service with a specific price (e.g., $1,000.00)
3. Edit the service name or description only
4. Verify price_cents did NOT change
5. Apply a 10% discount
6. Verify price_cents = $900.00 (original * 0.9)
7. Remove discount (set to 'none')
8. Verify price_cents = $1,000.00 (back to original)

## Migration to Run

```
supabase/migrations/68_fix_price_recalculation_bug.sql
```

Run this in Supabase SQL Editor.

## Risks and Rollback

**Risk**: If the migration fails mid-way, some services might have `original_price_cents` and some might not.

**Mitigation**: The migration handles NULL values gracefully:
- Services without discount: `original_price_cents = price_cents`
- Services with percentage discount: reverse-calculate original
- Services with fixed discount: add back the discount amount

**Rollback**: If needed, the old trigger can be restored from migration 49.

## Follow-ups

- [ ] Consider adding `original_price_cents` to the UI for transparency
- [ ] Update schema documentation (SCHEMA-v5)
- [ ] Add unit tests for the trigger behavior
