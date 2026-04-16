-- ============================================================
-- MIRALOCKS — Fix Chatbot Public (RLS + Initialisation)
-- ============================================================

-- 1. Insérer les clés pour le chatbot public si elles manquent
INSERT INTO public.site_settings (id, valeur, updated_at)
VALUES
  ('chat_public_apikey', '', NOW()),
  ('chat_public_provider', 'groq', NOW()),
  ('chat_public_model', 'llama-3.1-8b-instant', NOW()),
  ('chat_public_system_prompt', 'Tu es l''assistante virtuelle de l''Institut MiraLocks à Lomé. MiraLocks est spécialisé dans les locks naturels, l''entretien et la création. Adresse : Agoè Cacaveli, Lomé. WhatsApp : +228 97 98 90 01. Réponds de façon concise et chaleureuse.', NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Mettre à jour la politique RLS pour permettre à "anon" de lire les clés publiques
-- Supprimer l'ancienne politique
DROP POLICY IF EXISTS "anon_read_public_site_settings" ON public.site_settings;

-- Créer la nouvelle politique qui EXCLUT les clés sensibles mais INCLUT les clés publiques IA
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
      -- Clé IA Admin (Interdit aux visiteurs)
      'ai_apikey',
      'google_apikey'
    )
    OR 
    id IN (
      -- Clés Chatbot Public (Autorisées pour que le chatbot fonctionne sans login)
      'chat_public_apikey',
      'chat_public_provider',
      'chat_public_model',
      'chat_public_system_prompt'
    )
  );

-- Note : L'admin peut toujours tout lire/écrire
