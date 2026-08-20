-- CreateEnum
CREATE TYPE "MinistryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MinistryMembershipRole" AS ENUM ('LEADER', 'MEMBER');

-- CreateTable
CREATE TABLE "Ministry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MinistryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ministry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinistryMembership" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "role" "MinistryMembershipRole" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinistryMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountMinistryAccess" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountMinistryAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinistryMembership_personId_startDate_idx" ON "MinistryMembership"("personId", "startDate");

-- CreateIndex
CREATE INDEX "MinistryMembership_ministryId_startDate_idx" ON "MinistryMembership"("ministryId", "startDate");

-- CreateIndex
CREATE INDEX "AccountMinistryAccess_accountId_revokedAt_idx" ON "AccountMinistryAccess"("accountId", "revokedAt");

-- CreateIndex
CREATE INDEX "AccountMinistryAccess_ministryId_revokedAt_idx" ON "AccountMinistryAccess"("ministryId", "revokedAt");

-- AddForeignKey
ALTER TABLE "MinistryMembership" ADD CONSTRAINT "MinistryMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryMembership" ADD CONSTRAINT "MinistryMembership_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMinistryAccess" ADD CONSTRAINT "AccountMinistryAccess_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMinistryAccess" ADD CONSTRAINT "AccountMinistryAccess_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
