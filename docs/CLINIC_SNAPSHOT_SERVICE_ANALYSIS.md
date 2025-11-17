# ClinicSnapshotService - Schema Compatibility Analysis

**Date:** 2025-11-16  
**Service:** `web/lib/ai/ClinicSnapshotService.ts`  
**Current Schema:** v2 (2025-11-02)  
**Latest Migration:** 45 (add_discount_system)  

---

## CRITICAL FINDINGS

This service has **4 critical field name mismatches** that will cause runtime errors.

### Issue 1: `loadServices()` Line 269 - CRITICAL

**Problem:** Wrong field name
```typescript
// WRONG - 'minutes' doesn't exist
.select('id, name, minutes, variable_cost_cents, tariffs!inner(price_cents)')

// CORRECT - use 'est_minutes'
.select('id, name, est_minutes, variable_cost_cents, tariffs!inner(price_cents)')
```

**Source:** Migration 15_complete_system_setup.sql line 18
```sql
est_minutes INTEGER NOT NULL DEFAULT 60,
```

**Fix Needed:** Change `minutes` to `est_minutes` on line 269 AND line 294

---

### Issue 2: `loadAssets()` Lines 347 & 355 - CRITICAL

**Problem 1:** Wrong field name
```typescript
// WRONG - 'purchase_price_pesos' doesn't exist
.select('id, name, purchase_price_pesos, depreciation_months, purchase_date')

// CORRECT - use 'purchase_price_cents'
.select('id, name, purchase_price_cents, depreciation_months, purchase_date')
```

**Problem 2:** Wrong type conversion (line 355)
```typescript
// WRONG - field is already in cents, not pesos
const purchasePriceCents = (a.purchase_price_pesos || 0) * 100

// CORRECT - use the field directly
const purchasePriceCents = a.purchase_price_cents || 0
```

**Source:** Migration 15_complete_system_setup.sql line 187
```sql
purchase_price_cents INTEGER NOT NULL,
```

**Impact:** Without fix:
- Query fails (field doesn't exist)
- If it somehow worked, depreciation would be 100x too large

**Fix Needed:** 
- Line 347: Change field name
- Line 355: Remove `* 100` multiplication

---

### Issue 3: `loadFixedCosts()` Line 411 - CRITICAL

**Problem:** Two wrong field names
```typescript
// WRONG - 'name' doesn't exist, 'monthly_cost_cents' doesn't exist
.select('id, name, monthly_cost_cents')

// CORRECT - use 'concept' for name, 'amount_cents' for amount
.select('id, concept, amount_cents')
```

**Also fix line 419:**
```typescript
// WRONG
name: fc.name, amount_cents: fc.monthly_cost_cents,

// CORRECT
name: fc.concept, amount_cents: fc.amount_cents,
```

**Source:** Migration 15_complete_system_setup.sql lines 223-225
```sql
CREATE TABLE IF NOT EXISTS public.fixed_costs (
    ...
    category VARCHAR(100) NOT NULL,
    concept VARCHAR(255) NOT NULL,          -- THIS IS THE NAME
    amount_cents INTEGER NOT NULL,          -- THIS IS THE AMOUNT
    ...
)
```

**Fix Needed:** 
- Line 411: Change select statement
- Line 419: Update field references

---

### Issue 4: `loadPatients()` Line 178 - MEDIUM (VERIFY)

**Problem:** Field `source` may not exist
```typescript
// QUESTIONABLE - need to verify if 'source' field exists
.select('id, created_at, source')
```

**Source:** Migration 15_complete_system_setup.sql doesn't show a `source` field  
Schema v1 documentation mentions `source_id` (FK), not `source` (string)

**Recommendation:** 
1. Check if `source` field actually exists in your Supabase database
2. If YES: Continue as-is
3. If NO: Either:
   - Add `source` field via migration
   - Use `source_id` and JOIN to `patient_sources`
   - Remove source grouping from snapshot

---

## Compatibility Checklist

| Component | Table | Field | Status | Line |
|-----------|-------|-------|--------|------|
| loadClinicInfo | clinics | id, name | ✅ OK | 135-136 |
| loadClinicInfo | settings_time | * (all) | ✅ OK | 141-143 |
| loadPatients | patients | clinic_id | ✅ OK | 172-173 |
| loadPatients | patients | id, created_at, **source** | ⚠️ VERIFY | 178 |
| loadTreatments | treatments | id, treatment_date, price_cents, service_id | ✅ OK | 217-224 |
| loadTreatments | services | name (via join) | ✅ OK | 224 |
| **loadServices** | **services** | **id, name, minutes** | **❌ CRITICAL** | **269** |
| loadServices | services | variable_cost_cents | ✅ OK | 269 |
| loadServices | tariffs | price_cents (via join) | ✅ OK | 271 |
| loadServices | service_supplies | service_id (count) | ✅ OK | 279-282 |
| loadSupplies | supplies | id, name, price_cents, category | ✅ OK | 311 |
| loadSupplies | service_supplies | supply_id (count) | ✅ OK | 329-332 |
| **loadAssets** | **assets** | **id, name, purchase_price_pesos** | **❌ CRITICAL** | **347** |
| **loadAssets** | **assets** | **depreciation_months, purchase_date** | ✅ OK | 347 |
| **loadAssets** | **conversion** | **amount * 100** | **❌ CRITICAL** | **355** |
| loadExpenses | expenses | id, amount_cents, expense_date, category, description | ✅ OK | 385 |
| **loadFixedCosts** | **fixed_costs** | **id, name, monthly_cost_cents** | **❌ CRITICAL** | **411** |

---

## NO DATABASE MIGRATIONS NEEDED

The schema is **correct** and **complete**.  
All issues are in the **application code**, not the database.

---

## Deployment Status

**BLOCKED until Issues 1-3 are fixed** (Issue 4 needs verification)

---

## Fix Summary

**4 Lines to Change:**
1. Line 269: `minutes` → `est_minutes`
2. Line 347: `purchase_price_pesos` → `purchase_price_cents`
3. Line 355: Remove `* 100`
4. Line 411: `'id, name, monthly_cost_cents'` → `'id, concept, amount_cents'`
5. Line 419: Update field references

**Estimated Time:** 5-10 minutes

---

## Related Documentation

- Schema: `/docs/database/SCHEMA-CURRENT.md` - Points to v2
- Migrations: `/supabase/migrations/` - 45 total, latest is discount system
- Service: `/web/lib/ai/ClinicSnapshotService.ts` - Needs fixes above

---

## Test Plan After Fixes

1. Unit test: Verify no TypeScript errors
2. Local test: Run `npm test` successfully
3. Integration test: Test against dev Supabase with real clinic data
4. Validation: Check all fields populate correctly
   - Services show correct minutes
   - Assets show correct depreciation (not 100x inflated)
   - Fixed costs use concept names

