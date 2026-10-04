-- Migration Script: Content Metrics & Page Overview
-- Run this script in the Supabase SQL Editor (SQL Editor -> New Query)

-- 1. Update existing Content table
ALTER TABLE "Content"
  ADD COLUMN IF NOT EXISTS "platformPostId" TEXT,
  ADD COLUMN IF NOT EXISTS "permalink" TEXT;

-- 2. Create ContentMetric table
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

-- 3. Create Channel table (Page Overview)
CREATE TABLE IF NOT EXISTS "Channel" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "platform"    TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- 4. Create ChannelMetric table (Page Overview)
CREATE TABLE IF NOT EXISTS "ChannelMetric" (
  "id"           TEXT NOT NULL,
  "channelId"    TEXT NOT NULL REFERENCES "Channel"("id") ON DELETE CASCADE,
  "month"        INTEGER NOT NULL,
  "year"         INTEGER NOT NULL,
  "followers"    INTEGER,
  "reach"        INTEGER,
  "messages"     INTEGER,
  "adSpend"      DOUBLE PRECISION,
  "recordedById" TEXT REFERENCES "TeamMember"("id") ON DELETE SET NULL,
  "recordedDate" TIMESTAMP(3),
  CONSTRAINT "ChannelMetric_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChannelMetric_channelId_month_year_key" UNIQUE ("channelId", "month", "year")
);

-- 5. Create Summary View (Optional but useful for querying)
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
