-- ============================================================
--  MIRALOCKS — Configuration Assistant IA
--  À exécuter dans : Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. S'assurer que la table site_settings existe
-- (elle est déjà créée par miralocks-setup.sql)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id         TEXT PRIMARY KEY,
  valeur     TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Activer RLS si pas déjà fait
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
--  3. INSÉRER LES CLÉS API IA (valeurs vides par défaut)
--     L'admin les remplira depuis le panneau Paramètres
-- ============================================================
INSERT INTO public.site_settings (id, valeur, updated_at)
VALUES
  ('ai_apikey',    '',                      NOW()),
  ('ai_provider',  'groq',                  NOW()),
  ('ai_model',     'llama-3.3-70b-versatile', NOW()),
  ('ai_salon_name','MiraLocks',             NOW()),
  ('google_apikey', '',                     NOW()),
  ('google_model',  'gemini-2.0-flash',     NOW())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
--  4. POLITIQUE DE SÉCURITÉ — Interdire la lecture des clés
--     AI aux visiteurs anonymes (anon)
-- ============================================================

-- Supprimer l'ancienne politique anon pour la recréer
DROP POLICY IF EXISTS "anon_read_public_site_settings" ON public.site_settings;

-- Recréer avec ai_apikey dans la liste noire
CREATE POLICY "anon_read_public_site_settings" ON public.site_settings
  FOR SELECT TO anon
  USING (
    id NOT IN (
      'cinetpay_apikey',
      'cinetpay_siteid',
      'fedapay_apikey',
      'kkiapay_publickey',
      'paygate_apikey',
      'callmebot_apikey',
      'whatsapp_callmebot',
      'admin_email',
      'admin_password',
      'smtp_password',
      'smtp_user',
      -- Clés IA (sensibles — admin seulement)
      'ai_apikey',
      'google_apikey'
    )
  );

-- L'admin authentifié peut tout lire/modifier
DROP POLICY IF EXISTS "admin_all_site_settings" ON public.site_settings;
CREATE POLICY "admin_all_site_settings" ON public.site_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
--  5. VÉRIFICATION — Voir les clés AI après insertion
-- ============================================================
SELECT id, valeur, updated_at
FROM public.site_settings
WHERE id IN ('ai_apikey','ai_provider','ai_model','ai_salon_name','google_apikey','google_model')
ORDER BY id;

-- ============================================================
--  ✅ RÉSULTAT ATTENDU :
--  | id              | valeur                    |
--  |-----------------|---------------------------|
--  | ai_apikey       | (vide → à remplir admin)  |
--  | ai_model        | llama-3.3-70b-versatile   |
--  | ai_provider     | groq                      |
--  | ai_salon_name   | MiraLocks                 |
--
--  Après ça, l'admin peut sauvegarder sa config depuis
--  Paramètres → API IA et elle sera stockée dans Supabase.
-- ============================================================
