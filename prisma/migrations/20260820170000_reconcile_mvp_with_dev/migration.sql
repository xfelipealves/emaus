-- Preserve the migrations already published by dev and apply only the
-- additive/compatible parts of the Emaus MVP schema.

-- Add the application-level administrator name without replacing the
-- published AccountRole enum value. Prisma maps ADMINISTRATOR to ADMIN.
-- Add the new timeline category used by person registration.
ALTER TYPE "TimelineEventCategory" ADD VALUE 'REGISTRATION';

-- Whole-church meetings were represented in the dev schema by an audience
-- row with a null ministryId. The reconciled MVP represents whole church by
-- an empty audience collection, so remove only that structural sentinel.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "MeetingAudience"
    WHERE "ministryId" IS NULL
      AND "type" <> 'WHOLE_CHURCH'
  ) THEN
    RAISE EXCEPTION 'Cannot reconcile MeetingAudience: null ministryId is not a WHOLE_CHURCH audience';
  END IF;
END $$;

DELETE FROM "MeetingAudience"
WHERE "ministryId" IS NULL;

-- The application treats an account/ministry pair as one revocable scope.
-- Refuse an ambiguous historical dataset instead of silently deleting access
-- history while creating the required compound uniqueness.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "AccountMinistryAccess"
    GROUP BY "accountId", "ministryId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot reconcile AccountMinistryAccess: duplicate account/ministry scopes exist';
  END IF;
END $$;

-- MeetingAudience used SET NULL in the dev baseline. After the whole-church
-- sentinel is normalized away, the MVP can enforce a real ministry target.
ALTER TABLE "MeetingAudience" DROP CONSTRAINT "MeetingAudience_ministryId_fkey";

-- Remove the obsolete attendance status composite index and replace it with
-- the lookup used by the reconciled attendance board.
DROP INDEX "Attendance_personId_status_idx";

ALTER TABLE "Account" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "Category" ADD COLUMN "description" TEXT;

ALTER TABLE "MeetingAudience"
  ALTER COLUMN "type" SET DEFAULT 'MINISTRIES',
  ALTER COLUMN "ministryId" SET NOT NULL;

ALTER TABLE "Ministry" ADD COLUMN "description" TEXT;

ALTER TABLE "MinistryMembership" ALTER COLUMN "role" SET DEFAULT 'MEMBER';

ALTER TABLE "Note"
  ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "content" TEXT;

-- Existing note text lives in the latest NoteVersion in the dev baseline.
-- Backfill it before enforcing the MVP's non-null content contract.
UPDATE "Note" AS note
SET "content" = COALESCE(
  (
    SELECT version."content"
    FROM "NoteVersion" AS version
    WHERE version."noteId" = note."id"
    ORDER BY version."sequence" DESC, version."createdAt" DESC, version."id" DESC
    LIMIT 1
  ),
  ''
);

UPDATE "Note"
SET "archived" = ("archivedAt" IS NOT NULL);

ALTER TABLE "Note"
  ALTER COLUMN "content" SET DEFAULT '',
  ALTER COLUMN "content" SET NOT NULL;

ALTER TABLE "Person" ADD COLUMN "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- The published dev schema stores birthDate as a timestamp while the MVP
-- treats it as a calendar date. Keep the date and normalize legacy time parts.
UPDATE "Person"
SET "birthDate" = date_trunc('day', "birthDate")
WHERE "birthDate" IS NOT NULL
  AND "birthDate" <> date_trunc('day', "birthDate");

CREATE UNIQUE INDEX "AccountMinistryAccess_accountId_ministryId_key"
  ON "AccountMinistryAccess"("accountId", "ministryId");

CREATE INDEX "Attendance_personId_idx" ON "Attendance"("personId");

CREATE INDEX "Note_personId_createdAt_idx" ON "Note"("personId", "createdAt");

ALTER TABLE "MeetingAudience"
  ADD CONSTRAINT "MeetingAudience_ministryId_fkey"
  FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
