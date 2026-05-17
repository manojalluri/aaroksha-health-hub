-- ==============================================================================
-- FIX PARTNER DELETION CONSTRAINT
-- This adds ON DELETE CASCADE to the settlements table so partners can be deleted.
-- Run this in Supabase SQL Editor
-- ==============================================================================

ALTER TABLE public.settlements
  DROP CONSTRAINT IF EXISTS settlements_partner_id_fkey;

ALTER TABLE public.settlements
  ADD CONSTRAINT settlements_partner_id_fkey
  FOREIGN KEY (partner_id)
  REFERENCES public.partners(id)
  ON DELETE CASCADE;
