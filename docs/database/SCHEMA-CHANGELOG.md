# Database Schema Changelog

This file tracks all changes to the database schema across versions.

---

## Version 1 (2025-10-21)

**Status:** ✅ Current
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
