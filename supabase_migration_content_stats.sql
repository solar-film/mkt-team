-- This is the SQL migration for Supabase / PostgreSQL based on your request.
-- Note: The table names have been adjusted to match the existing Prisma schema in the application ("Content" table).
-- If your actual Supabase tables are named differently (e.g. lowercase), please adjust before running.

ALTER TABLE "Content"
  ADD COLUMN IF NOT EXISTS "platformPostId" TEXT,
  ADD COLUMN IF NOT EXISTS "permalink" TEXT;

CREATE TABLE IF NOT EXISTS "ContentMetric" (
  "id"              TEXT NOT NULL,
  "contentId"       TEXT NOT NULL REFERENCES "Content"("id") ON DELETE CASCADE,
  "snapshot"        TEXT NOT NULL CHECK ("snapshot" IN ('D+7','D+15','D+30')),
  "recordedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "views"           INTEGER, 
  "reach"           INTEGER,
  "likes"           INTEGER, 
  "comments"        INTEGER, 
  "shares"          INTEGER, 
  "saves"           INTEGER,
  "follows"         INTEGER, 
  "linkClicks"      INTEGER, 
  "profileVisits"   INTEGER, 
  "messages"        INTEGER,
  "avgWatchSec"     DOUBLE PRECISION,
  "adSpend"         DOUBLE PRECISION DEFAULT 0,
  "source"          TEXT DEFAULT 'manual' CHECK ("source" IN ('manual','import','api')),
  "recordedById"    TEXT REFERENCES "TeamMember"("id") ON DELETE SET NULL,
  "note"            TEXT,
  CONSTRAINT "ContentMetric_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContentMetric_contentId_snapshot_key" UNIQUE ("contentId", "snapshot")
);

-- Note: The view for summary is optional if you aggregate via API/Next.js directly, 
-- but here is the adjusted view matching your schema:
CREATE OR REPLACE VIEW "person_content_summary" AS
SELECT c."memberId", date_trunc('month', c."publishDate") as month,
       count(*)                          as pieces,
       sum(m.views)                      as views,
       round(avg(m.views))               as avg_views,
       sum(m.follows)                    as follows,
       sum(m."linkClicks")               as clicks,
       sum(m.shares)                     as shares,
       round(sum(coalesce(m.likes,0)+coalesce(m.comments,0)+coalesce(m.shares,0)+coalesce(m.saves,0))::numeric
             / nullif(sum(m.reach),0), 4) as engagement_rate
FROM "Content" c
JOIN "ContentMetric" m ON m."contentId" = c."id" AND m."snapshot" = 'D+7'
GROUP BY c."memberId", date_trunc('month', c."publishDate");
