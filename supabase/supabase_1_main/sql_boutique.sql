-- ============================================================
-- MIRALOCKS — Boutique Table & RLS
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.boutique_articles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL,
  description TEXT,
  prix        INTEGER NOT NULL DEFAULT 0,
  image_url   TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.boutique_articles ENABLE ROW LEVEL SECURITY;

-- 3. Grants
GRANT ALL ON public.boutique_articles TO authenticated;
GRANT SELECT ON public.boutique_articles TO anon;

-- 4. Policies
DROP POLICY IF EXISTS "public_read_boutique" ON public.boutique_articles;
CREATE POLICY "public_read_boutique" ON public.boutique_articles
  FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "admin_all_boutique" ON public.boutique_articles;
CREATE POLICY "admin_all_boutique" ON public.boutique_articles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Site settings keys for boutique
INSERT INTO public.site_settings (id, valeur)
VALUES 
  ('boutique_min_order', '10000'),
  ('boutique_delivery_fee', '1500'),
  ('boutique_payment_mode', 'whatsapp')
ON CONFLICT (id) DO NOTHING;

-- 6. Add public access to boutique settings
-- We need to update the anon_read_public_site_settings policy created in sql_fix_chatbot.sql
-- If that script was run, we'll just add to it.
DROP POLICY IF EXISTS "anon_read_public_site_settings" ON public.site_settings;

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
      'ai_apikey',
      'google_apikey'
    )
    OR 
    id IN (
      'chat_public_apikey',
      'chat_public_provider',
      'chat_public_model',
      'chat_public_system_prompt',
      'boutique_min_order',
      'boutique_delivery_fee',
      'boutique_payment_mode'
    )
  );
