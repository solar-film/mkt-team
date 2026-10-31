BEGIN;

-- Member PIN hashes live apart from TeamMember so no member query can return them by accident.
CREATE TABLE IF NOT EXISTS public."MemberCredential" (
  "memberId" TEXT PRIMARY KEY REFERENCES public."TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "pinHash" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Browsers hold a random token; only its SHA-256 is stored, so a database read cannot sign anyone in.
CREATE TABLE IF NOT EXISTS public."MemberSession" (
  "id" TEXT PRIMARY KEY,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "memberId" TEXT NOT NULL REFERENCES public."TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "userAgent" TEXT
);
CREATE INDEX IF NOT EXISTS "MemberSession_memberId_idx" ON public."MemberSession" ("memberId");

-- Sign-in history and the source of lockouts; kept when a member is removed.
CREATE TABLE IF NOT EXISTS public."LoginAttempt" (
  "id" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "memberId" TEXT,
  "success" BOOLEAN NOT NULL,
  "reason" TEXT NOT NULL,
  "ip" TEXT NOT NULL DEFAULT '',
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LoginAttempt_kind_memberId_createdAt_idx" ON public."LoginAttempt" ("kind", "memberId", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginAttempt_ip_createdAt_idx" ON public."LoginAttempt" ("ip", "createdAt");
CREATE INDEX IF NOT EXISTS "LoginAttempt_createdAt_idx" ON public."LoginAttempt" ("createdAt");

-- No policies: the Supabase REST roles get nothing, while the app's owner connection is unaffected.
ALTER TABLE public."MemberCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MemberSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."LoginAttempt" ENABLE ROW LEVEL SECURITY;

COMMIT;
