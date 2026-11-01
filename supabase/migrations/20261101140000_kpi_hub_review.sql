BEGIN;

-- KPI กลาง: work review fields on tasks and contents (all optional, existing rows unaffected).
ALTER TABLE public."Task"
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "waitingOn" TEXT,
  ADD COLUMN IF NOT EXISTS "firstReview" TEXT,
  ADD COLUMN IF NOT EXISTS "reviseReason" TEXT;

ALTER TABLE public."Content"
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "waitingOn" TEXT,
  ADD COLUMN IF NOT EXISTS "firstReview" TEXT,
  ADD COLUMN IF NOT EXISTS "reviseReason" TEXT,
  ADD COLUMN IF NOT EXISTS "promotion" TEXT;

-- Monthly evaluation per member, drafted by มะลิ (AI).
CREATE TABLE IF NOT EXISTS public."MemberEvaluation" (
  "id" TEXT PRIMARY KEY,
  "memberId" TEXT NOT NULL REFERENCES public."TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "summary" TEXT NOT NULL,
  "strengths" TEXT,
  "improvements" TEXT,
  "nextSteps" TEXT,
  "source" TEXT NOT NULL DEFAULT 'มะลิ',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "MemberEvaluation_memberId_year_month_key" ON public."MemberEvaluation" ("memberId", "year", "month");
CREATE INDEX IF NOT EXISTS "MemberEvaluation_year_month_idx" ON public."MemberEvaluation" ("year", "month");

-- No policies: the Supabase REST roles get nothing, while the app's owner connection is unaffected.
ALTER TABLE public."MemberEvaluation" ENABLE ROW LEVEL SECURITY;

COMMIT;
