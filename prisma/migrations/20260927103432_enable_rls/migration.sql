-- Block Supabase Data API (anon/authenticated roles) from these tables.
-- No policies = deny all. Prisma connects as `postgres`, which bypasses RLS.
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Edit" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "VocabItem" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "PhraseLookup" ENABLE ROW LEVEL SECURITY;