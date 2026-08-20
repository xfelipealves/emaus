-- CreateEnum
CREATE TYPE "MinistryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MinistryMembershipRole" AS ENUM ('MEMBER', 'LEADER');

-- CreateTable
CREATE TABLE "Ministry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
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
    "role" "MinistryMembershipRole" NOT NULL DEFAULT 'MEMBER',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
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

    CONSTRAINT "AccountMinistryAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinistryMembership_personId_startDate_idx" ON "MinistryMembership"("personId", "startDate");

-- CreateIndex
CREATE INDEX "MinistryMembership_ministryId_startDate_idx" ON "MinistryMembership"("ministryId", "startDate");

-- CreateIndex
CREATE INDEX "AccountMinistryAccess_ministryId_idx" ON "AccountMinistryAccess"("ministryId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMinistryAccess_accountId_ministryId_key" ON "AccountMinistryAccess"("accountId", "ministryId");

-- AddForeignKey
ALTER TABLE "MinistryMembership" ADD CONSTRAINT "MinistryMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinistryMembership" ADD CONSTRAINT "MinistryMembership_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMinistryAccess" ADD CONSTRAINT "AccountMinistryAccess_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountMinistryAccess" ADD CONSTRAINT "AccountMinistryAccess_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "Ministry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
