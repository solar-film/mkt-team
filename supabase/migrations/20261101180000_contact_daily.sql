BEGIN;

-- Daily contacts per channel account: LINE/Facebook/Instagram from GOOD CRM, phone from uploaded call logs.
CREATE TABLE IF NOT EXISTS public."ContactDaily" (
  "id" TEXT PRIMARY KEY,
  "date" DATE NOT NULL,
  "month" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "account" TEXT NOT NULL,
  "contacts" INTEGER NOT NULL DEFAULT 0,
  "newContacts" INTEGER,
  "source" TEXT NOT NULL,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContactDaily_channel_company_account_date_key" ON public."ContactDaily" ("channel", "company", "account", "date");
CREATE INDEX IF NOT EXISTS "ContactDaily_month_idx" ON public."ContactDaily" ("month");

-- One row per GOOD CRM pull or call-log upload.
CREATE TABLE IF NOT EXISTS public."ContactSyncRun" (
  "id" TEXT PRIMARY KEY,
  "source" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "dateFrom" DATE NOT NULL,
  "dateTo" DATE NOT NULL,
  "ok" BOOLEAN NOT NULL DEFAULT false,
  "rows" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "ContactSyncRun_source_startedAt_idx" ON public."ContactSyncRun" ("source", "startedAt");

-- No policies: the Supabase REST roles get nothing, while the app's owner connection is unaffected.
ALTER TABLE public."ContactDaily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContactSyncRun" ENABLE ROW LEVEL SECURITY;

COMMIT;
