# Database Documentation

This directory contains comprehensive documentation of the Laralis database schema.

## 📁 Structure

```
docs/database/
├── README.md                    # This file
├── SCHEMA-CURRENT.md           # Always points to latest schema
├── SCHEMA-CHANGELOG.md         # Version history
└── schemas/
    ├── SCHEMA-v1-2025-10-21.md # Initial schema
    ├── SCHEMA-v2-YYYY-MM-DD.md # Future versions
    └── ...
```

## 🎯 Quick Start

**Want to know the current schema?**
→ Read [SCHEMA-CURRENT.md](SCHEMA-CURRENT.md)

**Want to see what changed?**
→ Read [SCHEMA-CHANGELOG.md](SCHEMA-CHANGELOG.md)

**Want to see a specific version?**
→ Check [schemas/](schemas/) directory

## 📋 Schema Versioning System

### How It Works

1. **Versioned Files**: Each schema snapshot is saved with version and date
   - Format: `SCHEMA-v{VERSION}-{YYYY-MM-DD}.md`
   - Example: `SCHEMA-v1-2025-10-21.md`

2. **Current Pointer**: `SCHEMA-CURRENT.md` always references the latest version
   - This is what Claude reads by default
   - Updated automatically when schema changes

3. **Changelog**: `SCHEMA-CHANGELOG.md` tracks all changes between versions
   - What was added
   - What was modified
   - What was removed
   - Breaking changes

### When Schema Updates

Schema documentation is updated when:
- New migration files are created
- Tables are added/removed/modified
- Columns are added/removed/modified
- Foreign keys or constraints change
- Triggers or functions are modified

### Automated Process

Claude Code will automatically:
1. Detect schema changes in migrations
2. Create new versioned schema file
3. Update SCHEMA-CURRENT.md
4. Update SCHEMA-CHANGELOG.md
5. Notify you with: "📊 Schema documentation updated to vX"

## 🔧 Manual Updates

If you make schema changes outside of migrations or want to update manually:

### Step 1: Create New Version
```bash
# Copy current schema
cp docs/database/schemas/SCHEMA-v1-2025-10-21.md docs/database/schemas/SCHEMA-v2-$(date +%Y-%m-%d).md

# Edit the new file with your changes
```

### Step 2: Update SCHEMA-CURRENT.md
Change the references to point to your new version:
```markdown
**Current Version:** v2
**Date:** 2025-10-XX
**File:** [SCHEMA-v2-2025-10-XX.md](schemas/SCHEMA-v2-2025-10-XX.md)
```

### Step 3: Update SCHEMA-CHANGELOG.md
Add a new entry documenting what changed:
```markdown
## Version 2 (2025-10-XX)

### Added Tables
- new_table: description

### Modified Tables
- existing_table: what changed
```

### Step 4: Tell Claude
Just say: "I updated the schema to v2" and Claude will read the new version.

## 📊 What's Documented

Each schema file contains:

### Tables
- All columns with types and constraints
- Primary keys and foreign keys
- Indexes and unique constraints
- Default values and computed columns

### Relationships
- Foreign key relationships
- Multi-tenant hierarchy
- Data flow diagrams

### Business Rules
- Money handling (cents only)
- Immutable snapshots
- Pricing formulas
- Auto-created data

### Recent Changes
- New tables
- Modified columns
- New triggers/functions
- RLS policy updates

## 🎓 Best Practices

### For Developers

1. **Always check schema before coding**
   ```markdown
   "What's the schema for the expenses table?"
   → Claude reads SCHEMA-CURRENT.md automatically
   ```

2. **Update schema after migrations**
   ```markdown
   "I just created migration 42, update the schema docs"
   → Claude creates new version automatically
   ```

3. **Reference specific versions**
   ```markdown
   "What changed between v1 and v2?"
   → Claude compares the two versions
   ```

### For Claude Code

1. **Read schema before database work**
   - Always check @docs/database/SCHEMA-CURRENT.md
   - Look up specific tables when needed

2. **Update schema after changes**
   - Detect migration files
   - Create new versioned file
   - Update pointers
   - Notify user

3. **Use schema for context**
   - When writing queries
   - When creating RLS policies
   - When debugging data issues

## 🔍 Common Queries

### "Show me the patients table structure"
```markdown
Read @docs/database/SCHEMA-CURRENT.md and search for "patients" table
```

### "What are the foreign keys on treatments?"
```markdown
Read @docs/database/SCHEMA-CURRENT.md, find treatments table,
look at foreign key constraints
```

### "How is money stored?"
```markdown
Read @docs/database/SCHEMA-CURRENT.md, check "Money Storage"
section or "Business Rules"
```

### "What changed in the last schema update?"
```markdown
Read @docs/database/SCHEMA-CHANGELOG.md, check most recent version
```

## 🚨 Important Notes

### Schema vs Migrations

- **Migrations**: Source of truth for actual database structure
  - Location: `supabase/migrations/*.sql`
  - What Supabase runs to create/modify tables

- **Schema Docs**: Human-readable documentation
  - Location: `docs/database/schemas/*.md`
  - What developers/Claude read to understand structure

**Always update both** when making database changes.

### Why Version the Schema?

1. **Track Changes**: See what changed and when
2. **Debugging**: Compare old vs new structure
3. **Rollback Reference**: Know what to revert to
4. **Team Communication**: Clear changelog of database evolution
5. **Onboarding**: New developers see full history

### Schema != DDL

These schema files are **documentation**, not executable SQL.

❌ Don't run them in database
✅ Use them as reference for writing migrations

## 📞 Need Help?

**Schema is outdated?**
→ Ask Claude: "Update the schema documentation"

**Don't know what changed?**
→ Ask Claude: "What schema changes were made?"

**Need specific table info?**
→ Ask Claude: "Show me the [table_name] structure"

**Want to compare versions?**
→ Ask Claude: "Compare schema v1 and v2"

---

Last updated: 2025-10-21
Current version: v1
