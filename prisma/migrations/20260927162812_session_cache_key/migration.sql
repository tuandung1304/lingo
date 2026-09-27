/*
Warnings:

- Added the required column `cacheKey` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Session" ADD COLUMN "cacheKey" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Session_userId_cacheKey_idx" ON "Session" ("userId", "cacheKey");