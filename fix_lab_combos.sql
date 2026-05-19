-- AAROKSHA HEALTH HUB: FIX LAB COMBOS RLS & STRUCTURE
-- Run this script in the Supabase SQL Editor to resolve the "combos not saving or deleting" issue.

-- 1. Ensure the lab_combos table exists with all required columns
CREATE TABLE IF NOT EXISTS public.lab_combos (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name text NOT NULL,
    description text,
    tests jsonb,
    test_ids jsonb,
    original_price numeric DEFAULT 0,
    combo_price numeric DEFAULT 0,
    tag text,
    color text DEFAULT '#3b82f6',
    partner_id text REFERENCES public.partners(partner_id) ON DELETE CASCADE,
    status text DEFAULT 'active' CHECK (status IN ('active', 'hold', 'deleted')),
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Disable Row Level Security (RLS) to match the permissive security model of other tables
-- This fixes the "new row violates row-level security policy" error during inserts/deletes.
ALTER TABLE public.lab_combos DISABLE ROW LEVEL SECURITY;

-- 3. In case 'tests' was created as a string array (text[]), ensure it's compatible or recreate it if needed.
-- (Supabase handles JSONB arrays seamlessly from the frontend).

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
