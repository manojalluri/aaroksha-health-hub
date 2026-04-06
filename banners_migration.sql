-- ── BANNERS TABLE ──
CREATE TABLE IF NOT EXISTS public.platform_banners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    subtitle text,
    image_url text,
    link_to text DEFAULT '/',
    cta_text text DEFAULT 'Action',
    gradient text DEFAULT 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
    cta_color text DEFAULT '#2563eb',
    emoji text DEFAULT '✨',
    badge_text text DEFAULT 'Special',
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- DISABLE RLS for simplicity as requested per previous patterns
ALTER TABLE public.platform_banners DISABLE ROW LEVEL SECURITY;

-- ── STORAGE BUCKET ──
INSERT INTO storage.buckets (id, name, public) 
VALUES ('banners', 'banners', true) 
ON CONFLICT DO NOTHING;

-- Storage Policy
DROP POLICY IF EXISTS "Public Banner Access" ON storage.objects;
CREATE POLICY "Public Banner Access" ON storage.objects 
FOR ALL USING (bucket_id = 'banners') 
WITH CHECK (bucket_id = 'banners');
