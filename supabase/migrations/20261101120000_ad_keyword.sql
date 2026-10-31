BEGIN;

-- Google Ads keywords and search terms per month, copied from Windsor.ai with the daily ad sync.
CREATE TABLE IF NOT EXISTS public."AdKeyword" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "matchType" TEXT NOT NULL DEFAULT '',
  "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "impressions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "clicks" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "conversions" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AdKeyword_kind_month_accountId_text_matchType_key" ON public."AdKeyword" ("kind", "month", "accountId", "text", "matchType");
CREATE INDEX IF NOT EXISTS "AdKeyword_month_kind_idx" ON public."AdKeyword" ("month", "kind");

-- No policies: the Supabase REST roles get nothing, while the app's owner connection is unaffected.
ALTER TABLE public."AdKeyword" ENABLE ROW LEVEL SECURITY;

COMMIT;
