/* ============================================================
   CONFIGURATION DU STOCKAGE ET DATAVIDÉO — SUPABASE 2
   À exécuter sur le DEUXIÈME projet Supabase
   Version : 3.1 — Mise à jour le 11/04/2026
   ============================================================ */

-- ──────────────────────────────────────────────────────────────
-- 0. PERMISSIONS GÉNÉRALES
-- ──────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO postgres;


-- ──────────────────────────────────────────────────────────────
-- 1. CRÉATION DE LA TABLE GALERIE_VIDEOS
--    (Elle est maintenant stockée ici pour une isolation totale)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.galerie_videos (
  id            BIGSERIAL PRIMARY KEY,
  titre         TEXT NOT NULL,
  description   TEXT,
  video_url     TEXT NOT NULL,
  thumbnail_url TEXT,
  publie        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.galerie_videos ENABLE ROW LEVEL SECURITY;

-- Permissions
GRANT SELECT ON public.galerie_videos TO anon;
GRANT ALL ON public.galerie_videos TO authenticated;
GRANT ALL ON SEQUENCE galerie_videos_id_seq TO authenticated;

-- Policies
DROP POLICY IF EXISTS "Public can view gallery" ON public.galerie_videos;
CREATE POLICY "Public can view gallery" ON public.galerie_videos
  FOR SELECT USING (publie = true);

DROP POLICY IF EXISTS "Admin full access" ON public.galerie_videos;
CREATE POLICY "Admin full access" ON public.galerie_videos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ──────────────────────────────────────────────────────────────
-- 2. CRÉATION DU BUCKET "miralocks-videos"
-- ──────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('miralocks-videos', 'miralocks-videos', true)
ON CONFLICT (id) DO NOTHING;


-- ──────────────────────────────────────────────────────────────
-- 3. POLICIES DE STOCKAGE
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Accès public en lecture"       ON storage.objects;
CREATE POLICY "Accès public en lecture"
ON storage.objects FOR SELECT
USING (bucket_id = 'miralocks-videos');

DROP POLICY IF EXISTS "Upload admin autorisé"        ON storage.objects;
CREATE POLICY "Upload admin autorisé"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'miralocks-videos'
  AND (storage.foldername(name))[1] = 'videos'
  AND storage.extension(name) IN ('mp4', 'webm', 'mov', 'avi')
);

DROP POLICY IF EXISTS "Suppression admin autorisée"  ON storage.objects;
CREATE POLICY "Suppression admin autorisée"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'miralocks-videos');

DROP POLICY IF EXISTS "Mise à jour admin autorisée"  ON storage.objects;
CREATE POLICY "Mise à jour admin autorisée"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'miralocks-videos')
WITH CHECK (bucket_id = 'miralocks-videos');
