# Current Database Schema

**Current Version:** v3
**Date:** 2025-11-17
**File:** [SCHEMA-v3-2025-11-17.md](schemas/SCHEMA-v3-2025-11-17.md)
**Previous Version:** [v2 (2025-11-02)](schemas/SCHEMA-v2-2025-11-02.md)

---

This file always points to the most recent schema version. When the schema changes, this file will be updated to reference the new version.

## What's New in v3

⚠️ **BREAKING ARCHITECTURAL CHANGE** (Migration 46):
- **Tariffs table is DEPRECATED**: No longer used for active pricing
- **Services is now the pricing catalog**: All discount fields moved from tariffs to services
- **services.price_cents is single source of truth**: Final price with discount already applied
- **Simplified architecture**: `services` → `treatments` (no tariffs in between)
- **Performance improvement**: -50% queries for pricing operations
- **Better UX**: One page for services + pricing (no separate tariffs page)

## Quick Links

- 📄 [Current Schema (v3)](schemas/SCHEMA-v3-2025-11-17.md)
- 📋 [Schema Changelog](SCHEMA-CHANGELOG.md)
- 🔄 [All Schema Versions](schemas/)
- 📜 [Previous Version (v2)](schemas/SCHEMA-v2-2025-11-02.md)

## How to Update Schema

When database changes are made (migrations, new tables, etc.):

1. Create a new versioned schema file:
   ```
   docs/database/schemas/SCHEMA-v2-YYYY-MM-DD.md
   ```

2. Update this file (`SCHEMA-CURRENT.md`) to point to the new version

3. Update `SCHEMA-CHANGELOG.md` with the changes

4. Update `CLAUDE.md` if there are significant architectural changes

## Schema Version Naming Convention

```
SCHEMA-v{VERSION}-{YYYY-MM-DD}.md
```

Examples:
- `SCHEMA-v1-2025-10-21.md` - Initial schema
- `SCHEMA-v2-2025-10-25.md` - After adding new marketing tables
- `SCHEMA-v3-2025-11-01.md` - After restructuring categories
