-- CreateEnum
CREATE TYPE "ActivityBucket" AS ENUM ('TOMORROW', 'BACKLOG', 'PARKED');

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "bucket" "ActivityBucket" NOT NULL DEFAULT 'BACKLOG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivitySubtask" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivitySubtask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_bucket_createdAt_idx" ON "Activity"("bucket", "createdAt");

-- CreateIndex
CREATE INDEX "ActivitySubtask_activityId_createdAt_idx" ON "ActivitySubtask"("activityId", "createdAt");

-- AddForeignKey
ALTER TABLE "ActivitySubtask" ADD CONSTRAINT "ActivitySubtask_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
