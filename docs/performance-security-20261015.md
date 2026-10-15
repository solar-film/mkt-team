# Performance and security update — 15 October 2026

This release preserves normal profile selection, the existing work screens, shared assignments, and historical statistics. No production records, files, schema, billing settings, or external messages were changed by this update. Publishing remains a separate owner decision.

## Data loading

- Dashboard, task board, and calendar retain a 120-second foreground refresh. Hidden tabs stop polling; returning to stale data triggers a refresh. Scheduled refreshes cannot overlap.
- Database-backed JSON reads use a private Next Data Cache with explicit filter keys and 120-second revalidation. Successful mutations expire the shared workspace tag. The browser requests uncached reads for five seconds after saving, covering invalidation propagation and background-refresh races. Concurrent dashboard reads share a request; completed responses are never reused as an application cache.
- Cache-buster timestamps do not create new database cache entries. Error responses and payloads above 1.5 MB are returned without being stored. HTTP responses containing team information use `private, no-store`, replacing the public dashboard CDN cache.
- Idea lists contain note text and comment counts, retaining description search. Only the selected note loads checklists, comments and attachment metadata. File bodies are excluded from Prisma list/detail selections and served individually when needed. Immutable attachment IDs allow private browser caching for one hour. Existing Base64 files stay in the database; this release does not migrate or delete them.
- Repeated member avatars are excluded from content statistics and meeting action queries where the interface only displays names/roles. API routes share one Prisma client per process.

## Statistics and compatibility

- Content metrics no longer stop at 200 records. Every matching content and metric snapshot remains available, so totals can include records the old implementation silently omitted. A first request for a large history can consequently contain more records than before; completeness takes priority.
- Reopening and saving a statistic preserves numeric zero. Empty input remains null. Current D+7, D+15 and D+30 snapshot controls retain their behavior.
- Saving a page overview preserves omitted Inbox and advertising-spend values. This matters after the Inbox column was hidden. Missing values on a new month no longer produce NaN.
- One action with several companies/owners remains one Task or Content. Existing transactional assignment tests still verify counts, filters and completed-work status.
- New attachments have a 3 MB limit after image compression; streamed JSON is limited to 4.3 MB to fit the existing hosting request ceiling. Previously stored larger files remain readable. The old 5 MB document hint exceeded the hosting request ceiling once encoded as Base64. Errors now appear when upload/save fails.
- Meetings retain headings, lists, colors, links and tables. Executable HTML, event handlers and unsafe URL schemes are removed on reads and writes. Sanitizing reads protects previously stored notes without rewriting them in bulk.

## Security changes and remaining boundary

- Public schema-maintenance and diagnostic URLs (`migrate*`, `setup-db*`, `test-db`) return 404 and never initialize Prisma. Schema changes belong in the guarded migration workflow.
- Browser mutations validate origin and content type. Body sizes are checked while reading streams. This is CSRF/input protection, **not authentication**.
- Checklist, comment and attachment operations include the parent note ID. Metric writes accept only known fields with valid nonnegative values; server errors no longer expose database details to callers.
- LINE webhooks verify the original request body with the channel-secret HMAC before handling events. Cron requires its bearer secret. Missing configuration fails closed. These checks follow the [LINE signature guide](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/) and [Vercel cron authentication guide](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
- The admin form retains its password entry, but validation is now on the server. The password is absent from browser code; a signed HttpOnly/SameSite cookie expires after one hour. Admin data endpoints require that session. Old `sessionStorage` flags do not authenticate.
- Next.js is updated from 16.2.9 to 16.4.1 with compatible dependency patches. Builds enforce TypeScript. The deprecated middleware entry moves to `proxy.ts`; security headers disable MIME sniffing, cross-origin framing, unused device permissions and unnecessary referrer detail.

**Accepted identity limitation:** the owner explicitly chose to retain name-only profile selection. Normal shared-work APIs therefore still lack verified user identity and per-user authorization. An outsider able to reach these APIs can read/write shared data, impersonate a profile, or bypass client role restrictions. The protected admin surface does not close alternate normal API paths. Origin/country checks do not solve this. Full access control requires real authentication, which was declined for this update. Do not describe the application as fully secured.

Production database grants/RLS, credential rotation, distributed rate limiting and infrastructure policy were not independently verified or changed in this task. An application code review cannot certify those boundaries.

Dependency audit on this checkout reports **zero production critical/high/moderate advisories**, with two low findings for Quill/react-quill-new concerning HTML export. The exported meeting HTML is sanitized before use; the advisory itself remains until an appropriate upstream fix is available. Full development audit also retains five high findings in the ESLint fast-glob/micromatch/braces chain. Do not downgrade Next/ESLint or the editor with `npm audit fix --force` merely to clear the report. See the [Quill advisory](https://github.com/advisories/GHSA-v3m3-f69x-jf25).

## Verification

- `npm run test:release`: **58 passing tests** (30 assignment/statistic regressions, 18 performance/security tests, 10 guarded migration tests).
- `npm run build -- --webpack`: production compilation and strict TypeScript pass.
- An isolated production-mode Next server verified actual cache reuse, immediate fresh reads after a fixture save, rejected cross-site writes, individual binary attachments, retired maintenance URLs and disabled unauthenticated cron access. No production database was connected.
- Browser smoke check with disposable fixtures verified profile selection, the dashboard, idea cards, selected-note text, comment counts, comments and successful image loading through the new attachment URL. No browser console errors were observed in that flow. It does not replace a post-deployment check against real configured infrastructure.
- A synthetic 100-note example with a 256 KB attachment per note reduced list JSON from **25,627,891 to 11,191 bytes**, retaining all 100 notes, search descriptions and comment counts. This isolates the file-body removal; it is not a measurement or forecast of production savings.
- The temporary fixture server/tab were closed and its ignored Next data cache removed. No fixture records were written to production.

Actual load-time and Supabase egress savings must be measured after deployment with representative usage. The already-counted 5.16 GB is historical usage and will not decrease because code changes.

## Before publishing

1. Configure production `CRON_SECRET` and `LINE_CHANNEL_SECRET`. The previously pulled environment inventory lacked both. Use the existing LINE channel's secret, and set the same cron secret in Vercel; do not send a live notification as a verification shortcut.
2. Configure a new strong `ADMIN_PASSWORD` on the server if the admin panel is used. Do not reuse the former password embedded in client code. Without configuration the admin login is disabled, while normal profile selection remains available.
3. Resolve/recheck the previously observed suspended `supabase-coral-garden` integration and Vercel provisioning failure described in `shared-meeting-assignments.md`. No paid upgrade or integration removal is authorized by this code change.
4. On the owner's explicit publishing instruction, push the saved commit, deploy only the verified MKT project, then check normal work, all statistic snapshots, page-overview saves, attachments and scheduled/webhook authentication. This update needs no additional database migration.
5. For another machine, pull the published source, run `npm ci`, supply its private environment configuration, then run the normal development command. Environment secrets and local preview helpers are deliberately excluded from Git.

Rollback restores the previous application commit without deleting data. It also restores the old performance/security weaknesses. Keep the already applied shared-assignment columns and historical metric/file records intact.

## Release follow-up — 15 October 2026

The owner authorized finishing publication, then explicitly chose to wait for the quota cycle reset on **19 October 2026** before deploying production. Live Vercel inspection still reports the linked Supabase resource as `Suspended`. No plan, billing or integration connection was changed.

Both Vercel build configurations now run `scripts/check-release-env.cjs` before building or running migrations. A production build refuses missing, blank or masked values for the database, existing LINE access token/group, LINE channel secret, cron secret and admin password. This prevents a Git-triggered release from replacing the current website with disabled notifications/admin access. Local and preview builds remain available without production secrets. The complete release suite includes four additional guard tests (62 total).

`CRON_SECRET` was generated securely and added to the verified MKT production project as a Secret. Its value was neither logged nor saved locally; read-back of the environment inventory confirms its presence. Vercel passes it to the scheduled endpoint automatically.

The live environment inventory still lacks `LINE_CHANNEL_SECRET` and `ADMIN_PASSWORD`. Configure these as production Secrets in [the MKT Vercel environment settings](https://vercel.com/goo-d-s-projects/mkt-team/settings/environment-variables), without pasting their values into chat or committing them. The LINE channel secret must match the existing Messaging API channel. Use a strong new admin password. These configuration changes apply to a new deployment rather than modifying the running deployment ([Vercel environment documentation](https://vercel.com/docs/environment-variables)).

Automatic Git deployment of `main` is temporarily disabled in `vercel.json` so this source push respects the instruction to wait. Other branches retain Vercel's default behavior. Re-enable `git.deploymentEnabled.main` only after the owner resumes publication and the readiness checks pass; manual production deployment remains a separate explicit step. This uses [Vercel's Git deployment configuration](https://vercel.com/docs/project-configuration/git-configuration).

After the reset, verify that the integration is active; the date alone is not proof of recovery. Once the missing configuration and infrastructure restriction are resolved, deploy the saved main branch and complete the production smoke checks above. This request does not authorize a paid upgrade.
