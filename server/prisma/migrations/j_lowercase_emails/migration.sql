-- ============================================================
-- Normalize user emails to lowercase (case-insensitive login)
-- ------------------------------------------------------------
-- Login looked users up by exact-match email, and writes stored the address
-- verbatim — so an email persisted with any uppercase letters (e.g.
-- "Foo.Bar@x.com") could only be signed into with that exact capitalization; a
-- normal lowercase attempt missed the lookup and returned a generic 401.
--
-- The application now trims + lowercases every account-email input (see
-- schemas/common.ts `emailField`). This migration brings existing data in line
-- and enforces case-insensitive uniqueness so case-only duplicates can't be
-- created going forward. Fully idempotent.
-- ============================================================

-- 1. Lowercase any rows that aren't already lowercase.
--    Guarded WHERE means a re-run is a no-op. If two rows differ only by case
--    this UPDATE would collide on the existing unique(email) index and fail
--    loudly — intended: such a pair needs a manual merge before normalizing.
UPDATE users SET email = lower(email) WHERE email <> lower(email);

-- 2. Case-insensitive uniqueness guard. Complements the existing unique(email)
--    constraint; blocks "a@x.com" and "A@x.com" from coexisting even if a
--    future write path forgets to normalize.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

-- 3. Org invitations are matched against emails too — normalize them as well so
--    an invite created with mixed case still resolves at acceptance time.
--    Guarded on table existence so this migration is safe in any ordering.
DO $$
BEGIN
  IF to_regclass('public.org_invitations') IS NOT NULL THEN
    UPDATE org_invitations SET email = lower(email) WHERE email <> lower(email);
  END IF;
END $$;
