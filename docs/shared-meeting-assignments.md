# Shared meeting action items

Each action item remains one task or content record. `memberIds` and `companies` store all selections. The original `memberId` relation and `company` field retain one valid value for existing integrations. API responses also return comma-separated selections for existing task and calendar editors.

Meetings and their action items save in one transaction. Editing assignments preserves the existing status, priority, links, and other task/content details. Old single-owner records remain supported.

## Database and release order

1. Apply `supabase/migrations/20261014103959_shared_task_assignments.sql` to the database used by **MKT-GFS**. This adds and backfills array fields and indexes; it does not delete records. Do this before deploying the new code. Confirm the database belongs to this app before applying it.
2. Run `npm ci` (generates Prisma Client), then `npm run test:shared-assignments`.
3. Deploy only when the user requests publishing. Keep database credentials in environment configuration.

The connected Supabase account currently exposes a different CRM database, so the migration has been verified with in-memory Postgres and has not been applied to the live MKT database.

## Validation

- `npm run test:meetings`: 9 tests cover migration/backfill, saving one shared task, editing without duplicates, preserving completion/priority/links, rejecting unrelated item IDs, transaction rollback, legacy updates, everyone, and checkbox selection.
- `npm run test:shared-assignments`: also covers dashboard totals, secondary owner/company filters, and complete shared-owner labels. Team-wide totals count each record once; per-person lists retain shared attribution. Content statistics show one row per complete owner group.
- `npm run build -- --webpack`: passed. The repository already skips TypeScript validation during builds.
- `tsc --noEmit --incremental false`: passed after adding explicit types to the affected statistics components.

## Continuing on another computer

After the user requests a GitHub push, clone or pull the repository on the other computer and configure its environment separately. The local read-only preview helper is specific to this computer and is not part of production code.
