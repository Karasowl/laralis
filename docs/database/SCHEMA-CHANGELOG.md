# Database Schema Changelog

This file tracks all changes to the database schema across versions.

---

## Version 4 (2025-12-06)

**Status:** ✅ Current
**Migration:** 50-55 (AI Assistant, Integrations & Refunds)
**File:** [SCHEMA-v4-2025-12-06.md](schemas/SCHEMA-v4-2025-12-06.md)

### AI Assistant Tables & Google Calendar Integration

This version adds tables to support Lara AI assistant conversation persistence, action auditing, and Google Calendar synchronization.

#### Added Tables

**`action_logs`** (Migration 50)
- Audit trail for all AI-executed actions
- Stores action type, params, results, and error info
- Immutable (no UPDATE/DELETE) for compliance
- RLS: Clinic membership required for access

**`clinic_google_calendar`** (Migration 52)
- Stores OAuth tokens for Google Calendar integration
- One calendar per clinic (UNIQUE constraint)
- Stores access_token, refresh_token, expiry
- RLS: Owners/admins can manage, members can view

**`chat_sessions`** (Migration 54)
- Metadata for AI conversation sessions
- Tracks mode (entry/query), message count, timestamps
- Supports soft delete via is_archived flag
- Auto-updates stats via trigger

**`chat_messages`** (Migration 54)
- Individual messages within sessions
- Stores content, thinking_process (Kimi K2), model used
- Supports action suggestions and extracted data
- Auto-generates session title from first message

**`ai_feedback`** (Migration 54)
- User feedback on AI responses (positive/negative)
- Links to specific message for context
- Tracks query type for analysis

#### Modified Tables

**`treatments`** (Migration 53)
- ➕ Added `google_event_id` (text): Google Calendar event ID for sync

**`treatments`** (Migration 55) - Refund Support
- ➕ Added `is_refunded` (boolean, DEFAULT false): Whether treatment was refunded
- ➕ Added `refunded_at` (timestamptz): When refund was processed
- ➕ Added `refund_reason` (text): Explanation for refund
- ➕ Added index `idx_treatments_is_refunded` for efficient querying

**Financial Impact of Refunds:**
- Revenue = $0 for refunded treatments (money returned to patient)
- Costs are still incurred (materials used + professional time)
- Loss = `variable_cost_cents + (fixed_cost_per_minute_cents × minutes)`

#### Added Triggers

- `trigger_update_chat_session_stats` - Updates message_count and last_message_at
- `trigger_auto_generate_session_title` - Sets title from first user message
- `update_clinic_google_calendar_updated_at` - Keeps updated_at current

#### Export/Import Updates

- Added all 5 new tables to Regular Export (backup) system
- Import handles FK dependencies: sessions → messages → feedback
- Non-fatal errors for AI tables (backup continues if AI import fails)

#### Breaking Changes

⚠️ None. This is a non-breaking additive change.

---

## Version 3 (2025-11-17)

**Status:** 📦 Archived
**Migration:** 46 (migrate_discounts_to_services)
**File:** [SCHEMA-v3-2025-11-17.md](schemas/SCHEMA-v3-2025-11-17.md)

### ⚠️ BREAKING: Tariffs Deprecation + Services Becomes Pricing Catalog

This version represents a **major architectural simplification** by deprecating the `tariffs` table and moving all pricing logic directly into the `services` table.

#### Modified Tables

**`services`** (Now the complete pricing catalog)
- ➕ Added `discount_type` (varchar): Discount type moved from tariffs (none, percentage, fixed)
- ➕ Added `discount_value` (numeric): Discount value moved from tariffs
- ➕ Added `discount_reason` (text): Optional discount justification moved from tariffs
- 🔄 Modified `price_cents` (bigint): **SEMANTIC CHANGE** - Now stores final price WITH discount applied (was base price in v2)
  - **Before**: Base price without discount
  - **After**: Final price patient pays (single source of truth)

**`tariffs`** (DEPRECATED)
- ⚠️ **Table marked as DEPRECATED** - No longer used in active code
- 🔒 RLS policies changed to **read-only** (SELECT only for audit)
- ❌ No INSERT or UPDATE allowed
- ✅ Kept for historical audit and fiscal compliance only
- 📝 Table comment added: "DEPRECATED: Use services table for pricing..."

#### Data Migration

**Migration 46 executed:**
```sql
-- 1. Add discount columns to services
ALTER TABLE services ADD COLUMN discount_type, discount_value, discount_reason

-- 2. Migrate active tariff data to services
UPDATE services
SET discount_type = tariffs.discount_type,
    discount_value = tariffs.discount_value,
    discount_reason = tariffs.discount_reason,
    price_cents = tariffs.final_price_with_discount_cents  -- ← Key change
FROM tariffs
WHERE tariffs.service_id = services.id AND tariffs.is_active = true

-- 3. Mark tariffs as deprecated (read-only)
```

All active pricing data successfully migrated from `tariffs` to `services`. Legacy tariff records preserved for audit.

#### Removed Functionality

- ❌ Tariff versioning system (version numbers, valid_from/valid_until)
- ❌ Separate "tariffs" page in UI (now redirects to /services)
- ❌ Tariffs table from export/import system
- ❌ `useTariffs` hook (use `useServices` instead)
- ❌ `/api/tariffs` endpoint (use `/api/services` instead)

**Rationale**: The versioning system was never used in practice. Treatments already store immutable snapshots for historical pricing.

#### Added Indexes

- `idx_services_discount_type` on `services(discount_type)` where `discount_type != 'none'`
  - Optimizes queries for services with active discounts

#### Architectural Changes

**Before (v2):**
```
services (basic catalog)
    ↓
tariffs (versioned pricing with discounts)
    ↓
treatments (snapshots)
```

**After (v3):**
```
services (complete catalog WITH pricing and discounts)
    ↓
treatments (snapshots)
```

**Benefits:**
- ✅ -50% queries for pricing operations (1 query vs 2)
- ✅ -44% code in pricing module
- ✅ Single source of truth: `services.price_cents`
- ✅ Simpler mental model for users (one page, not two)
- ✅ Faster AI assistant queries (no JOINs needed)
- ✅ No version sync issues

#### Breaking Changes

⚠️ **Code Changes Required:**

**1. Query Pattern Change**
```typescript
// ❌ OLD (v2)
const service = await supabase.from('services').select('*')
const tariff = await supabase.from('tariffs').select('*').eq('is_active', true)
const price = tariff.final_price_with_discount_cents

// ✅ NEW (v3)
const service = await supabase.from('services').select('*')
const price = service.price_cents  // Already includes discount
```

**2. Price Updates**
```typescript
// ❌ OLD (v2) - Update tariffs table
await supabase.from('tariffs').insert({ version: 2, ... })

// ✅ NEW (v3) - Update services table directly
await supabase.from('services').update({ price_cents: newPrice })
```

**3. AI Assistant Snapshots**
```typescript
// ❌ OLD (v2) - Query tariffs with JOIN
const data = await supabase.from('services')
  .select('*, tariffs!inner(*)')
  .eq('tariffs.is_active', true)

// ✅ NEW (v3) - Query services directly
const data = await supabase.from('services').select('*')
```

**4. Historical Price Queries**
```typescript
// ❌ OLD (v2) - Query tariffs.version history
SELECT * FROM tariffs WHERE service_id = X ORDER BY version

// ✅ NEW (v3) - Query treatments snapshots
SELECT DISTINCT price_cents, created_at FROM treatments WHERE service_id = X
```

#### Migration Impact

**Affected Systems:**
- ✅ Frontend: `/tariffs` page → redirects to `/services`
- ✅ API: `/api/tariffs` → deprecated, use `/api/services`
- ✅ Hooks: `useTariffs()` → deprecated, use `useServices()`
- ✅ AI Assistant: Queries updated to use services table
- ✅ Export/Import: Tariffs excluded from system
- ✅ Database: Tariffs table read-only

**User Impact:**
- ⚠️ Users will see pricing UI consolidated in Services page
- ✅ No data loss (all pricing migrated)
- ✅ Existing treatments unaffected (immutable snapshots)

#### Business Rules Changes

**Pricing Flow (Updated):**
1. Calculate base cost from supplies + time
2. Apply margin (markup over cost)
3. Apply discount if configured
4. **Store final result in `services.price_cents`** ← This is what patients pay

**Discount Priority (Unchanged):**
1. Individual service discount (services.discount_type/value)
2. Global clinic discount (clinics.global_discount_config)
3. No discount

**Historical Pricing (Changed):**
- Before: Query tariffs table with version filtering
- After: Query treatments table for historical snapshots

---

## Version 2 (2025-11-02)

**Status:** 📦 Archived
**Migration:** 45 (add_discount_system)
**File:** [SCHEMA-v2-2025-11-02.md](schemas/SCHEMA-v2-2025-11-02.md)

### Discount System Implementation

This version adds comprehensive support for discounts at both clinic (global) and tariff (individual service) levels.

#### Modified Tables

**`clinics`**
- ➕ Added `global_discount_config` (jsonb): Global discount configuration
  - Structure: `{enabled: bool, type: "percentage"|"fixed", value: number}`
  - Allows setting a clinic-wide default discount for all services
  - Can be overridden by individual tariff discounts

**`tariffs`**
- ➕ Added `discount_type` (varchar): Type of discount (none, percentage, fixed)
- ➕ Added `discount_value` (numeric): Discount value (% or cents)
- ➕ Added `discount_reason` (text): Optional description/justification
- ➕ Added `final_price_with_discount_cents` (integer): Final price after discount

#### Added Database Functions

**`calculate_discounted_price()`**
- Signature: `(base_price_cents INT, discount_type VARCHAR, discount_value NUMERIC) → INTEGER`
- Purpose: Calculate final price after applying discount
- Logic:
  - `none` or `value=0` → return base price
  - `percentage` → discount = base × (value/100)
  - `fixed` → discount = value (in cents)
  - Returns base - discount (never negative)

#### Added Indexes

- `idx_tariffs_discount_type` on `tariffs(discount_type)` where `discount_type != 'none'`
  - Optimizes queries for services with active discounts

#### Data Migration

- Updated existing tariffs: Set `final_price_with_discount_cents = rounded_price_cents`
- No discount applied to historical data (maintains `discount_type = 'none'`)

#### Business Rules

**Discount Priority:**
1. Individual tariff discount (if `discount_type != 'none'`)
2. Global clinic discount (if enabled)
3. No discount

**Discount Types:**
- **Percentage**: 0-100% off the rounded price
- **Fixed**: Fixed amount in cents (cannot exceed price)

**Application Point:**
- Discounts apply **after margin** is calculated
- Applied at **tariff level** (price catalog)
- **Before** treatment creation (snapshot includes discounted price)

#### Breaking Changes

⚠️ None. This is a non-breaking additive change.

---

## Version 1 (2025-10-21)

**Status:** 📦 Archived
**Migration:** Up to migration 41 (auto_create_clinic_categories)
**File:** [SCHEMA-v1-2025-10-21.md](schemas/SCHEMA-v1-2025-10-21.md)

### Initial Schema Documentation

This is the first comprehensive documentation of the database schema after 41 migrations.

#### Tables Documented (41 total)

**Organization & Multi-Tenancy (5):**
- workspaces
- clinics
- organizations
- workspace_users
- workspace_members

**Users & Access (4):**
- clinic_users
- invitations
- role_permissions
- workspace_activity

**Clinical Operations (5):**
- patients
- treatments
- services
- service_supplies
- tariffs

**Financial (2):**
- expenses
- fixed_costs

**Inventory (2):**
- supplies
- assets

**Marketing (3):**
- patient_sources
- marketing_campaigns
- marketing_campaign_status_history

**Categories (3):**
- category_types
- custom_categories
- categories

**Configuration (1):**
- settings_time

**Auth (1):**
- verification_codes

**Backup (1):**
- _backup_patient_sources

#### Key Features

✅ Multi-tenant architecture (workspaces → clinics)
✅ Comprehensive RLS (Row Level Security)
✅ Money stored as bigint cents
✅ Immutable treatment snapshots
✅ Marketing attribution tracking
✅ Flexible category system
✅ Auto-created default data for new clinics

#### Triggers & Automation

- `after_clinic_insert` → Creates default patient_sources and custom_categories

---

## Future Versions

### Version 2 (Planned)

**Expected changes:**
- TBD based on active development

---

## How to Add an Entry

When creating a new schema version:

1. Add a new section above with the format:
   ```markdown
   ## Version X (YYYY-MM-DD)

   **Status:** ✅ Current / 📦 Archived
   **Migration:** Migration number or range
   **File:** [Link to schema file]

   ### Changes

   #### Added Tables
   - table_name: description

   #### Modified Tables
   - table_name: what changed

   #### Removed Tables
   - table_name: why removed

   #### Breaking Changes
   - description of breaking changes
   ```

2. Update the previous version's status to "📦 Archived"

3. Update `SCHEMA-CURRENT.md` to reference the new version

---

## Legend

- ✅ Current - Active schema version
- 📦 Archived - Historical schema version
- 🚧 In Progress - Version being worked on
- ❌ Deprecated - No longer valid
