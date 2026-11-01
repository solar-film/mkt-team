BEGIN;

-- มะลิ (AI) suggestion for the first review of tasks and contents; the Admin still decides.
ALTER TABLE public."Task"
  ADD COLUMN IF NOT EXISTS "aiReview" TEXT,
  ADD COLUMN IF NOT EXISTS "aiReviewNote" TEXT,
  ADD COLUMN IF NOT EXISTS "aiReviewedAt" TIMESTAMP(3);

ALTER TABLE public."Content"
  ADD COLUMN IF NOT EXISTS "aiReview" TEXT,
  ADD COLUMN IF NOT EXISTS "aiReviewNote" TEXT,
  ADD COLUMN IF NOT EXISTS "aiReviewedAt" TIMESTAMP(3);

COMMIT;
