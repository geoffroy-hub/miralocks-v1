-- ============================================================
-- FIX: TABLE RENDEZ-VOUS Miralocks
-- Assure que les colonnes nécessaires existent et que les
-- permissions sont correctement configurées pour le public.
-- ============================================================

-- 1. Ajout des colonnes si manquantes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rendezvous' AND column_name='pay_acompte') THEN
    ALTER TABLE public.rendezvous ADD COLUMN pay_acompte BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rendezvous' AND column_name='acompte_montant') THEN
    ALTER TABLE public.rendezvous ADD COLUMN acompte_montant INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rendezvous' AND column_name='transaction_id') THEN
    ALTER TABLE public.rendezvous ADD COLUMN transaction_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rendezvous' AND column_name='statut_paiement') THEN
    ALTER TABLE public.rendezvous ADD COLUMN statut_paiement TEXT DEFAULT 'non_paye';
  END IF;
END $$;

-- 2. Réparation des permissions publiques (Anonyme)
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT ON public.rendezvous TO anon;
GRANT USAGE, SELECT ON SEQUENCE rendezvous_id_seq TO anon;

-- 3. Mise à jour de la Policy RLS pour l'insertion publique
DROP POLICY IF EXISTS "insert_public_rdv" ON public.rendezvous;
CREATE POLICY "insert_public_rdv" ON public.rendezvous
  FOR INSERT TO anon WITH CHECK (true);

-- 4. Assurer que le statut est 'en_attente' par défaut
ALTER TABLE public.rendezvous ALTER COLUMN statut SET DEFAULT 'en_attente';

-- 5. Notification de succès
SELECT 'Table rendezvous mise à jour avec succès !' as resultat;
