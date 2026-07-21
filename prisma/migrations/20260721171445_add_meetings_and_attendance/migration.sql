-- CreateEnum
CREATE TYPE "MeetingRecurrence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingAudienceType" AS ENUM ('WHOLE_CHURCH', 'MINISTRIES');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('NOT_CONFIRMED', 'PRESENT', 'ABSENT');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingSeries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "recurrence" "MeetingRecurrence" NOT NULL,
    "weekdays" INTEGER[],
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "seriesId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "status" "MeetingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAudience" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "type" "MeetingAudienceType" NOT NULL,
    "ministryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'NOT_CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingSeries_categoryId_startDate_idx" ON "MeetingSeries"("categoryId", "startDate");

-- CreateIndex
CREATE INDEX "Meeting_startsAt_status_idx" ON "Meeting"("startsAt", "status");

-- CreateIndex
CREATE INDEX "Meeting_seriesId_startsAt_idx" ON "Meeting"("seriesId", "startsAt");

-- CreateIndex
CREATE INDEX "MeetingAudience_ministryId_idx" ON "MeetingAudience"("ministryId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAudience_meetingId_ministryId_key" ON "MeetingAudience"("meetingId", "ministryId");

-- CreateIndex
CREATE INDEX "Attendance_personId_status_idx" ON "Attendance"("personId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_meetingId_personId_key" ON "Attendance"("meetingId", "personId");

-- AddForeignKey
ALTER TABLE "MeetingSeries" ADD CONSTRAINT "MeetingSeries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "MeetingSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAudience" ADD CONSTRAINT "MeetingAudience_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAudience" ADD CONSTRAINT "MeetingAudience_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
