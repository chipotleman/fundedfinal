---
name: DB migration convention
description: How schema changes must be applied so dev AND prod both get them
---

When adding a column/table, two things are required, not one:

1. Edit `shared/schema.ts` (Drizzle schema) and run `npm run db:push`
   (`drizzle-kit push`) — this patches the **dev** database in place.
2. **Also** add a hand-written idempotent SQL file under `migrations/`
   (e.g. `add_<thing>.sql` using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`).

**Why:** `drizzle-kit push` only mutates the connected dev DB. The `migrations/`
*.sql files are the project's record/portable path for other environments
(prod). Shipping a schema-dependent code change without the migration file means
endpoints throw `column ... does not exist` anywhere that wasn't manually pushed.

**How to apply:** any task that touches `shared/schema.ts` must produce a matching
`migrations/*.sql` file in the same change, in addition to running db:push.
