BEGIN;

-- Facebook page posts copied from Windsor.ai (facebook_organic) to fill each content item's D+7 reach.
-- New table only; nothing existing changes.
CREATE TABLE IF NOT EXISTS public."FacebookPost" (
  "id" TEXT PRIMARY KEY,
  "pageId" TEXT NOT NULL,
  "createdTime" TIMESTAMP(3) NOT NULL,
  "message" TEXT NOT NULL DEFAULT '',
  "reach" INTEGER,
  "reactions" INTEGER,
  "comments" INTEGER,
  "contentId" TEXT,
  "matchedBy" TEXT,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FacebookPost_createdTime_idx" ON public."FacebookPost" ("createdTime");
CREATE INDEX IF NOT EXISTS "FacebookPost_contentId_idx" ON public."FacebookPost" ("contentId");

-- No policies: the Supabase REST roles get nothing, while the app's owner connection is unaffected.
ALTER TABLE public."FacebookPost" ENABLE ROW LEVEL SECURITY;

COMMIT;
