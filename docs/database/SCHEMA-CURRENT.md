# Current Database Schema

**Current Version:** v5
**Date:** 2025-12-31
**File:** [SCHEMA-v5-2025-12-31.md](schemas/SCHEMA-v5-2025-12-31.md)
**Previous Version:** [v4 (2025-12-06)](schemas/SCHEMA-v4-2025-12-06.md)

---

This file always points to the most recent schema version. When the schema changes, this file will be updated to reference the new version.

## What's New in v5

**Explicit Pending Balance System** (Migration 73):
- `treatments.pending_balance_cents` - Explicit user-marked pending balance field
- Replaces automatic `is_paid` calculation with explicit user input
- NULL = no pending balance (fully paid), >0 = pending amount in cents
- New index for optimized filtering

## What was New in v4

**AI Assistant & Integrations** (Migrations 50-54):
- `action_logs` - Audit trail of AI-executed actions
- `clinic_google_calendar` - Google Calendar OAuth integration per clinic
- `chat_sessions` - Conversation session metadata
- `chat_messages` - Individual messages within sessions
- `ai_feedback` - User feedback on AI responses
- `treatments.google_event_id` - New column for calendar sync

## What was New in v3

**BREAKING ARCHITECTURAL CHANGE** (Migration 46):
- **Tariffs table is DEPRECATED**: No longer used for active pricing
- **Services is now the pricing catalog**: All discount fields moved from tariffs to services
- **services.price_cents is single source of truth**: Final price with discount already applied
- **Simplified architecture**: `services` → `treatments` (no tariffs in between)
- **Performance improvement**: -50% queries for pricing operations
- **Better UX**: One page for services + pricing (no separate tariffs page)

## Quick Links

- 📄 [Current Schema (v5)](schemas/SCHEMA-v5-2025-12-31.md)
- 📋 [Schema Changelog](SCHEMA-CHANGELOG.md)
- 🔄 [All Schema Versions](schemas/)
- 📜 [Previous Version (v4)](schemas/SCHEMA-v4-2025-12-06.md)

## How to Update Schema

When database changes are made (migrations, new tables, etc.):

1. Create a new versioned schema file:
   ```
   docs/database/schemas/SCHEMA-vX-YYYY-MM-DD.md
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
- `SCHEMA-v3-2025-11-17.md` - After deprecating tariffs
- `SCHEMA-v4-2025-12-06.md` - After adding AI assistant tables
- `SCHEMA-v5-2025-12-31.md` - After adding explicit pending balance
