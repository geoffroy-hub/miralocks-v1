/* ============================================================
   MIRALOCKS — Migration v2 — Nouvelles fonctionnalités
   À exécuter sur le projet Supabase principal APRÈS miralocks-setup.sql
   Date : 2026-04-12
   ============================================================

   Modules :
   1. Bons cadeaux numériques
   2. Packs de séances prépayés
   3. Programme de parrainage
   4. Paramètres SEO blog
   ============================================================ */


-- ══════════════════════════════════════════════════════════════
-- 1. BONS CADEAUX
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.bons_cadeaux (
  id              BIGSERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,           -- code alphanum unique (8 chars)
  montant         INTEGER NOT NULL,               -- valeur en FCFA
  acheteur_nom    TEXT NOT NULL,
  acheteur_email  TEXT NOT NULL,
  acheteur_tel    TEXT,
  destinataire    TEXT,                           -- prénom du bénéficiaire (optionnel)
  message         TEXT,                           -- message personnalisé (optionnel)
  statut          TEXT DEFAULT 'actif'
                  CHECK (statut IN ('actif','utilise','expire','rembourse')),
  rdv_id          BIGINT REFERENCES public.rendezvous(id) ON DELETE SET NULL,
  transaction_id  TEXT,                           -- ID transaction CinetPay
  expires_at      DATE NOT NULL,                  -- validité 12 mois
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bons_cadeaux ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.bons_cadeaux TO anon;
GRANT USAGE, SELECT ON SEQUENCE bons_cadeaux_id_seq TO anon;
GRANT ALL ON public.bons_cadeaux TO authenticated;

DROP POLICY IF EXISTS "anon_create_bon" ON public.bons_cadeaux;
CREATE POLICY "anon_create_bon" ON public.bons_cadeaux
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_own_bon" ON public.bons_cadeaux;
CREATE POLICY "anon_read_own_bon" ON public.bons_cadeaux
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "admin_all_bons" ON public.bons_cadeaux;
CREATE POLICY "admin_all_bons" ON public.bons_cadeaux
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_bons_code    ON public.bons_cadeaux (code);
CREATE INDEX IF NOT EXISTS idx_bons_statut  ON public.bons_cadeaux (statut);
CREATE INDEX IF NOT EXISTS idx_bons_email   ON public.bons_cadeaux (acheteur_email);


-- ══════════════════════════════════════════════════════════════
-- 2. PACKS DE SÉANCES PRÉPAYÉS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.packs_seances (
  id              BIGSERIAL PRIMARY KEY,
  client_nom      TEXT NOT NULL,
  client_tel      TEXT NOT NULL,
  client_email    TEXT,
  type_pack       TEXT NOT NULL,                  -- ex: "pack_4", "pack_8"
  label_pack      TEXT NOT NULL,                  -- ex: "Pack 4 resserrages"
  prix_pack       INTEGER NOT NULL,               -- prix total payé en FCFA
  seances_total   INTEGER NOT NULL,               -- nombre total de séances
  seances_restantes INTEGER NOT NULL,             -- décrémenté à chaque RDV
  transaction_id  TEXT,
  statut          TEXT DEFAULT 'actif'
                  CHECK (statut IN ('actif','epuise','expire','rembourse')),
  expires_at      DATE,                           -- validité optionnelle
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.packs_seances ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.packs_seances TO anon;
GRANT USAGE, SELECT ON SEQUENCE packs_seances_id_seq TO anon;
GRANT ALL ON public.packs_seances TO authenticated;

DROP POLICY IF EXISTS "anon_create_pack" ON public.packs_seances;
CREATE POLICY "anon_create_pack" ON public.packs_seances
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_read_own_pack" ON public.packs_seances;
CREATE POLICY "anon_read_own_pack" ON public.packs_seances
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "admin_all_packs" ON public.packs_seances;
CREATE POLICY "admin_all_packs" ON public.packs_seances
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_packs_tel    ON public.packs_seances (client_tel);
CREATE INDEX IF NOT EXISTS idx_packs_statut ON public.packs_seances (statut);


-- ══════════════════════════════════════════════════════════════
-- 3. PROGRAMME DE PARRAINAGE
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.parrainages (
  id              BIGSERIAL PRIMARY KEY,
  parrain_tel     TEXT NOT NULL,                  -- téléphone du parrain
  parrain_nom     TEXT NOT NULL,
  filleul_nom     TEXT NOT NULL,
  filleul_tel     TEXT NOT NULL,
  rdv_id          BIGINT REFERENCES public.rendezvous(id) ON DELETE SET NULL,
  statut          TEXT DEFAULT 'en_attente'
                  CHECK (statut IN ('en_attente','valide','credit_accorde','annule')),
  credit_fcfa     INTEGER DEFAULT 0,              -- montant crédité au parrain
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  validated_at    TIMESTAMPTZ
);

ALTER TABLE public.parrainages ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.parrainages TO anon;
GRANT USAGE, SELECT ON SEQUENCE parrainages_id_seq TO anon;
GRANT ALL ON public.parrainages TO authenticated;

DROP POLICY IF EXISTS "anon_create_parrainage" ON public.parrainages;
CREATE POLICY "anon_create_parrainage" ON public.parrainages
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_parrainages" ON public.parrainages;
CREATE POLICY "admin_all_parrainages" ON public.parrainages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_parrain_tel  ON public.parrainages (parrain_tel);
CREATE INDEX IF NOT EXISTS idx_parrain_stat ON public.parrainages (statut);


-- ══════════════════════════════════════════════════════════════
-- 4. PARAMÈTRES SUPPLÉMENTAIRES v2
-- ══════════════════════════════════════════════════════════════

-- Valeur d'un bon cadeau minimum (FCFA)
INSERT INTO public.site_settings (id, valeur) VALUES ('bon_cadeau_min', '5000')
ON CONFLICT (id) DO NOTHING;

-- Montants prédéfinis pour les bons cadeaux (JSON array)
INSERT INTO public.site_settings (id, valeur)
VALUES ('bon_cadeau_montants', '[5000,10000,15000,20000,30000]')
ON CONFLICT (id) DO NOTHING;

-- Définition des packs (JSON array)
INSERT INTO public.site_settings (id, valeur)
VALUES ('packs_config', '[
  {"id":"pack_4","label":"Pack 4 resserrages","seances":4,"prix":22000,"economie":10},
  {"id":"pack_8","label":"Pack 8 resserrages","seances":8,"prix":40000,"economie":20},
  {"id":"pack_mensuel","label":"Pack mensuel illimité","seances":4,"prix":18000,"economie":15}
]')
ON CONFLICT (id) DO NOTHING;

-- Crédit de parrainage en FCFA par filleul validé
INSERT INTO public.site_settings (id, valeur) VALUES ('parrainage_credit', '2000')
ON CONFLICT (id) DO NOTHING;

-- Parrainage actif ou non
INSERT INTO public.site_settings (id, valeur) VALUES ('parrainage_actif', 'true')
ON CONFLICT (id) DO NOTHING;

-- Whitelist colonnes site_settings lisibles par anon (à étendre si la whitelist existe)
-- Note : les nouvelles clés publiques à ajouter dans site_settings_read_whitelist si elle existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='site_settings' AND column_name='public') THEN
    UPDATE public.site_settings
    SET valeur = valeur  -- no-op, juste pour vérifier que la table existe
    WHERE id = 'parrainage_actif';
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- VÉRIFICATION
-- ══════════════════════════════════════════════════════════════
/*
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('bons_cadeaux','packs_seances','parrainages');
*/
