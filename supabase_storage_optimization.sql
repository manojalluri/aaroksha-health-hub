-- ================================================================
-- AAROKSHA HEALTH HUB — SUPABASE STORAGE OPTIMIZATION QUERIES
-- Run these in Supabase SQL Editor (Dashboard > SQL Editor)
-- ================================================================

-- ─── 1. VIEW ALL STORAGE USAGE BY BUCKET ─────────────────────────
SELECT
  bucket_id,
  COUNT(*) AS file_count,
  ROUND(SUM((metadata->>'size')::numeric) / 1024, 1) AS total_kb,
  ROUND(SUM((metadata->>'size')::numeric) / 1024 / 1024, 3) AS total_mb,
  ROUND(AVG((metadata->>'size')::numeric) / 1024, 1) AS avg_kb_per_file,
  MIN(created_at) AS oldest_file,
  MAX(created_at) AS newest_file
FROM storage.objects
WHERE metadata IS NOT NULL
GROUP BY bucket_id
ORDER BY total_mb DESC;

-- ─── 2. TOP 20 LARGEST FILES ─────────────────────────────────────
SELECT
  bucket_id,
  name,
  ROUND((metadata->>'size')::numeric / 1024, 1) AS size_kb,
  created_at
FROM storage.objects
WHERE metadata IS NOT NULL
ORDER BY (metadata->>'size')::numeric DESC
LIMIT 20;

-- ─── 3. FIND ORPHANED PRESCRIPTION IMAGES ────────────────────────
-- Files in storage but no matching prescription record
SELECT so.name, so.bucket_id,
  ROUND((so.metadata->>'size')::numeric / 1024, 1) AS size_kb,
  so.created_at
FROM storage.objects so
WHERE so.bucket_id = 'prescriptions'
  AND NOT EXISTS (
    SELECT 1 FROM public.prescriptions p
    WHERE p.image_url LIKE '%' || split_part(so.name, '/', 2) || '%'
  )
ORDER BY so.created_at;

-- ─── 4. DELETE ORPHANED PRESCRIPTION IMAGES ──────────────────────
-- Run query #3 first to review, then run this to delete
DELETE FROM storage.objects
WHERE bucket_id = 'prescriptions'
  AND NOT EXISTS (
    SELECT 1 FROM public.prescriptions p
    WHERE p.image_url LIKE '%' || split_part(name, '/', 2) || '%'
  );

-- ─── 5. DELETE IMAGES FOR CANCELLED/REJECTED ORDERS ──────────────
DELETE FROM storage.objects so
WHERE so.bucket_id = 'prescriptions'
  AND EXISTS (
    SELECT 1 FROM public.prescriptions p
    WHERE p.status IN ('cancelled', 'rejected')
      AND p.image_url LIKE '%' || split_part(so.name, '/', 2) || '%'
  );

-- ─── 6. COUNT WASTED SPACE (CANCELLED/REJECTED ORDERS) ───────────
SELECT
  p.status,
  COUNT(*) AS orders,
  COUNT(p.image_url) AS with_images,
  ROUND(
    COALESCE(SUM((so.metadata->>'size')::numeric), 0) / 1024 / 1024, 2
  ) AS wasted_mb
FROM public.prescriptions p
LEFT JOIN storage.objects so
  ON so.bucket_id = 'prescriptions'
  AND p.image_url LIKE '%' || split_part(so.name, '/', 2) || '%'
WHERE p.status IN ('cancelled', 'rejected')
GROUP BY p.status;

-- ─── 7. STORAGE USAGE OVER TIME (MONTHLY) ────────────────────────
SELECT
  bucket_id,
  TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
  COUNT(*) AS files_uploaded,
  ROUND(SUM((metadata->>'size')::numeric) / 1024 / 1024, 2) AS mb_used
FROM storage.objects
WHERE metadata IS NOT NULL
GROUP BY bucket_id, DATE_TRUNC('month', created_at)
ORDER BY month DESC, mb_used DESC;

-- ─── 8. ENABLE RLS ON STORAGE BUCKETS (SECURITY) ─────────────────
-- Run this once to prevent unauthorized public access
UPDATE storage.buckets SET public = false WHERE id = 'prescriptions';
-- Keep doctor_profiles and banners public (needed for display):
UPDATE storage.buckets SET public = true WHERE id IN ('doctor_profiles', 'banners');

-- ─── 9. STORAGE HEALTH SUMMARY ───────────────────────────────────
SELECT
  'Total Files' AS metric,
  COUNT(*)::text AS value
FROM storage.objects
UNION ALL
SELECT 'Total Size (MB)', ROUND(SUM((metadata->>'size')::numeric)/1024/1024, 2)::text
FROM storage.objects WHERE metadata IS NOT NULL
UNION ALL
SELECT 'Free Tier Limit (MB)', '1000'
UNION ALL
SELECT '% Used', ROUND(SUM((metadata->>'size')::numeric)/1024/1024/10, 2)::text || '%'
FROM storage.objects WHERE metadata IS NOT NULL;
