CREATE TABLE "MeetingSeriesAudience" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingSeriesAudience_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MeetingSeriesAudience_seriesId_ministryId_key"
  ON "MeetingSeriesAudience"("seriesId", "ministryId");

CREATE INDEX "MeetingSeriesAudience_ministryId_idx"
  ON "MeetingSeriesAudience"("ministryId");

ALTER TABLE "MeetingSeriesAudience"
  ADD CONSTRAINT "MeetingSeriesAudience_seriesId_fkey"
  FOREIGN KEY ("seriesId") REFERENCES "MeetingSeries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingSeriesAudience"
  ADD CONSTRAINT "MeetingSeriesAudience_ministryId_fkey"
  FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
