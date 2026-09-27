-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('FIX', 'KEYWORDS', 'DESCRIBE', 'REPLY', 'TRY_FIRST');

-- CreateEnum
CREATE TYPE "Tone" AS ENUM ('CASUAL', 'NEUTRAL', 'POLITE');

-- CreateEnum
CREATE TYPE "EditType" AS ENUM ('SPELLING', 'GRAMMAR', 'WORD_CHOICE', 'NATURALNESS');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "mode" "Mode" NOT NULL,
    "tone" "Tone" NOT NULL,
    "input" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edit" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "original" TEXT NOT NULL,
    "replacement" TEXT NOT NULL,
    "type" "EditType" NOT NULL,
    "explanation" TEXT NOT NULL,
    CONSTRAINT "Edit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabItem" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "phrase" TEXT NOT NULL,
    "context" TEXT,
    "meaning" TEXT,
    "notes" JSONB,
    "due" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" INTEGER NOT NULL DEFAULT 0,
    "lastReview" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VocabItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhraseLookup" (
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhraseLookup_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Session_userId_createdAt_idx" ON "Session" ("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Edit_userId_type_idx" ON "Edit" ("userId", "type");

-- CreateIndex
CREATE INDEX "VocabItem_userId_due_idx" ON "VocabItem" ("userId", "due");

-- CreateIndex
CREATE UNIQUE INDEX "VocabItem_userId_phrase_key" ON "VocabItem" ("userId", "phrase");

-- AddForeignKey
ALTER TABLE "Edit"
ADD CONSTRAINT "Edit_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE;