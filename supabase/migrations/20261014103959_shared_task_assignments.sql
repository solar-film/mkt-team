BEGIN;

ALTER TABLE public."Task"
  ADD COLUMN IF NOT EXISTS "memberIds" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "companies" text[] NOT NULL DEFAULT '{}';
ALTER TABLE public."Content"
  ADD COLUMN IF NOT EXISTS "memberIds" text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "companies" text[] NOT NULL DEFAULT '{}';

-- Keep existing records and their single-member relations intact.
-- Arrays carry the complete selection; backfill also handles legacy comma-separated selections.
UPDATE public."Task" SET "memberIds" = regexp_split_to_array(trim("memberId"), '\s*,\s*')
  WHERE cardinality("memberIds") = 0 AND trim("memberId") <> '';
UPDATE public."Content" SET "memberIds" = regexp_split_to_array(trim("memberId"), '\s*,\s*')
  WHERE cardinality("memberIds") = 0 AND trim("memberId") <> '';
UPDATE public."Task" SET "companies" = regexp_split_to_array(trim("company"), '\s*,\s*')
  WHERE cardinality("companies") = 0 AND trim("company") <> '';
UPDATE public."Content" SET "companies" = regexp_split_to_array(trim("company"), '\s*,\s*')
  WHERE cardinality("companies") = 0 AND trim("company") <> '';

CREATE INDEX IF NOT EXISTS "Task_memberIds_idx" ON public."Task" USING GIN ("memberIds");
CREATE INDEX IF NOT EXISTS "Content_memberIds_idx" ON public."Content" USING GIN ("memberIds");

COMMIT;
