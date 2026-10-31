BEGIN;

-- Daily ad results per campaign, copied from Windsor.ai by /api/cron/ads-sync.
CREATE TABLE IF NOT EXISTS public."AdDaily" (
  "id" TEXT PRIMARY KEY,
  "platform" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "campaignName" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "month" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'THB',
  "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "impressions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "clicks" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "leads" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "messages" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdDaily_platform_accountId_campaignId_date_key" ON public."AdDaily" ("platform", "accountId", "campaignId", "date");
CREATE INDEX IF NOT EXISTS "AdDaily_platform_month_idx" ON public."AdDaily" ("platform", "month");
CREATE INDEX IF NOT EXISTS "AdDaily_month_idx" ON public."AdDaily" ("month");

-- One row per Windsor pull: freshness shown on the pages, and the reason when a pull fails.
CREATE TABLE IF NOT EXISTS public."AdSyncRun" (
  "id" TEXT PRIMARY KEY,
  "platform" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "dateFrom" DATE NOT NULL,
  "dateTo" DATE NOT NULL,
  "ok" BOOLEAN NOT NULL DEFAULT false,
  "rows" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "AdSyncRun_platform_startedAt_idx" ON public."AdSyncRun" ("platform", "startedAt");

-- No policies: the Supabase REST roles get nothing, while the app's owner connection is unaffected.
ALTER TABLE public."AdDaily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdSyncRun" ENABLE ROW LEVEL SECURITY;

COMMIT;
