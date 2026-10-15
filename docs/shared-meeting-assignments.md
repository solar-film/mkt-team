# Shared meeting action items

Each action item remains one task or content record. `memberIds` and `companies` store all selections. The original `memberId` relation and `company` field retain one valid value for existing integrations. API responses also return comma-separated selections for existing task and calendar editors.

Meetings and their action items save in one transaction. Editing assignments preserves the existing status, priority, links, and other task/content details. Old single-owner records remain supported.

## Database and release order

1. Run `npm ci` (generates Prisma Client), then `npm run test:release`.
2. Apply `supabase/migrations/20261014103959_shared_task_assignments.sql` to the database used by **MKT-GFS** before activating the new code. This adds and backfills array fields and indexes; it does not delete records. Confirm the database belongs to this app before applying it.
3. Deploy only when the user requests publishing. Keep database credentials in environment configuration.

For the first production release, `vercel.release.json` runs `scripts/apply-shared-assignments.cjs` inside the existing Vercel production environment, before building the app. Sensitive database credentials stay in Vercel. The runner requires the exact MKT project and production environment, checks the legacy schema, and verifies the new fields, indexes, backfill, and unchanged record counts in one transaction. A failed check rolls back and stops the build. The default `vercel.json` and normal build do not run migrations.

```sh
vercel deploy --prod --skip-domain --project prj_0BMpPn1cvL54ectUokSnERZxwNnN --scope goo-d-s-projects --local-config vercel.release.json
vercel promote <verified-deployment-url> --scope goo-d-s-projects
```

## Validation

- `npm run test:meetings`: 9 tests cover migration/backfill, saving one shared task, editing without duplicates, preserving completion/priority/links, rejecting unrelated item IDs, transaction rollback, legacy updates, everyone, and checkbox selection.
- `npm run test:shared-assignments`: also covers dashboard totals, secondary owner/company filters, complete shared-owner labels, and mocked notification payloads. Team-wide totals count each record once; per-person lists retain shared attribution. Content statistics show one row per complete owner group. Existing LINE notifications and deadline reminders name every selected owner.
- `npm run build -- --webpack`: passed. The repository already skips TypeScript validation during builds.
- `tsc --noEmit --incremental false`: passed after adding explicit types to the affected statistics components.
- `node --test tests/production-migration-runner.test.cjs`: checks production/project guards, migration idempotency, wrong-database refusal, rollback and verification failures, and secret-safe logging using isolated Postgres and mocks.

## Continuing on another computer

After the user requests a GitHub push, clone or pull the repository on the other computer and configure its environment separately. The local read-only preview helper is specific to this computer and is not part of production code.

## Production release status — 15 October 2026

The migration was applied to the verified MKT database (`xoyhctcdgxxeowchoqfr`) through the owner's authenticated SQL Editor. Preflight counts matched the production API. The transaction verified four new array fields, two GIN indexes, completed backfill, and unchanged record counts: 189 tasks and 1,001 contents. No records were deleted.

Source changes were pushed to `solar-film/mkt-team` on `main`. Activation of the new website is still blocked before build: Vercel's linked `supabase-coral-garden` integration reports live status `suspended`. The Supabase Free organization displays egress of 5.16 GB against a 5 GB allowance for the cycle ending 19 October 2026. The existing production website remains on its previous deployment. Resolve the integration restriction before deploying; changing a paid plan needs the owner's billing decision. Keep the integration and its environment variables intact.
