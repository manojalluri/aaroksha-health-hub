-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION: Add logo_url + settlement_cycle to partners table
-- Run in: Supabase → SQL Editor → New Query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add logo_url column (stores the hospital/lab/pharmacy logo image URL)
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT NULL;

-- 2. Add settlement_cycle column (daily / weekly / monthly)
ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS settlement_cycle TEXT DEFAULT 'monthly'
    CHECK (settlement_cycle IN ('today', 'daily', 'weekly', 'monthly'));

-- 3. Reload PostgREST schema cache so the new columns are immediately visible
NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY: should show logo_url and settlement_cycle in the result
-- ─────────────────────────────────────────────────────────────────────────────
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partners'
ORDER BY ordinal_position;
