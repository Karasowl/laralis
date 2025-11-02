# Database Schema Changelog

This file tracks all changes to the database schema across versions.

---

## Version 2 (2025-11-02)

**Status:** ✅ Current
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
