-- AlterEnum
BEGIN;

CREATE TYPE "Mode_new" AS ENUM ('FIX', 'SUGGEST', 'WRITE');

ALTER TABLE "Session"
ALTER COLUMN "mode" TYPE "Mode_new" USING ("mode"::text::"Mode_new");

ALTER TYPE "Mode" RENAME TO "Mode_old";

ALTER TYPE "Mode_new" RENAME TO "Mode";

DROP TYPE "public"."Mode_old";

COMMIT;