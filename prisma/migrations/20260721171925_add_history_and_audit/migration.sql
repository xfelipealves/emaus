-- CreateEnum
CREATE TYPE "TimelineEventCategory" AS ENUM ('STATUS', 'MINISTRY', 'ATTENDANCE', 'CORRECTION', 'NOTE');

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "authorId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteVersion" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "authorId" TEXT,
    "content" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "actorId" TEXT,
    "category" "TimelineEventCategory" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_personId_archivedAt_idx" ON "Note"("personId", "archivedAt");

-- CreateIndex
CREATE INDEX "NoteVersion_noteId_createdAt_idx" ON "NoteVersion"("noteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NoteVersion_noteId_sequence_key" ON "NoteVersion"("noteId", "sequence");

-- CreateIndex
CREATE INDEX "TimelineEvent_personId_occurredAt_idx" ON "TimelineEvent"("personId", "occurredAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_personId_category_occurredAt_idx" ON "TimelineEvent"("personId", "category", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_targetType_targetId_createdAt_idx" ON "AuditEvent"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_createdAt_idx" ON "AuditEvent"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteVersion" ADD CONSTRAINT "NoteVersion_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteVersion" ADD CONSTRAINT "NoteVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
