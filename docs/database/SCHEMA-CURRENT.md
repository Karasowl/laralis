# Current Database Schema

**Current Version:** v1
**Date:** 2025-10-21
**File:** [SCHEMA-v1-2025-10-21.md](schemas/SCHEMA-v1-2025-10-21.md)

---

This file always points to the most recent schema version. When the schema changes, this file will be updated to reference the new version.

## Quick Links

- 📄 [Current Schema (v1)](schemas/SCHEMA-v1-2025-10-21.md)
- 📋 [Schema Changelog](SCHEMA-CHANGELOG.md)
- 🔄 [All Schema Versions](schemas/)

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
