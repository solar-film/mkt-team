CREATE TABLE IF NOT EXISTS "Channel" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "platform"    TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChannelMetric" (
  "id"          TEXT NOT NULL,
  "channelId"   TEXT NOT NULL REFERENCES "Channel"("id") ON DELETE CASCADE,
  "month"       INTEGER NOT NULL,
  "year"        INTEGER NOT NULL,
  "followers"   INTEGER,
  "reach"       INTEGER,
  "messages"    INTEGER,
  "adSpend"     DOUBLE PRECISION,
  "recordedById" TEXT REFERENCES "TeamMember"("id") ON DELETE SET NULL,
  "recordedDate" TIMESTAMP(3),
  CONSTRAINT "ChannelMetric_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChannelMetric_channelId_month_year_key" UNIQUE ("channelId", "month", "year")
);
