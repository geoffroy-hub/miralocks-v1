#!/usr/bin/env bash
# ============================================================
#  Miralocks — deploy.sh
#  Déploiement en une commande : check → build → deploy
#
#  Usage :
#    ./deploy.sh              → déploiement production
#    ./deploy.sh --dry        → simulation sans écriture ni deploy
#    ./deploy.sh --preview    → déploiement preview (pas production)
#
#  Prérequis :
#    - Node.js ≥ 18
#    - Netlify CLI  : npm install -g netlify-cli
#    - Authentifié  : netlify login
# ============================================================

set -euo pipefail

# ── Couleurs terminal ────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}  ✓${NC}  $*"; }
warn() { echo -e "${YELLOW}  ⚠${NC}  $*"; }
err()  { echo -e "${RED}  ✗${NC}  $*"; }
step() { echo -e "\n${CYAN}${BOLD}▶ $*${NC}"; }

DRY=false
PREVIEW=false
for arg in "$@"; do
  [[ "$arg" == "--dry" ]]     && DRY=true
  [[ "$arg" == "--preview" ]] && PREVIEW=true
done

$DRY && warn "Mode dry-run — aucune modification ni déploiement"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Miralocks — Pipeline de déploiement ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"


# ══════════════════════════════════════════════════════════════
# ÉTAPE 1 — Vérifications locales
# ══════════════════════════════════════════════════════════════
step "Étape 1 — Vérifications locales"

# Node.js
if ! command -v node &>/dev/null; then
  err "Node.js introuvable. Installez Node.js ≥ 18."
  exit 1
fi
NODE_VER=$(node -e "process.exit(parseInt(process.versions.node) < 18 ? 1 : 0)" 2>/dev/null && echo "ok" || echo "old")
[[ "$NODE_VER" == "old" ]] && { err "Node.js ≥ 18 requis (actuel: $(node -v))"; exit 1; }
ok "Node.js $(node -v)"

# build.js
[[ ! -f "build.js" ]] && { err "build.js introuvable — êtes-vous dans le bon répertoire ?"; exit 1; }
ok "build.js trouvé"

# Netlify CLI (seulement si pas dry-run)
if ! $DRY; then
  if ! command -v netlify &>/dev/null; then
    err "Netlify CLI introuvable. Installez-le : npm install -g netlify-cli"
    exit 1
  fi
  ok "Netlify CLI $(netlify --version | head -1)"
fi

# Fichiers critiques présents
REQUIRED_FILES=("index.html" "admin.html" "rendezvous.html" "js/supabase.js" "css/styles.css")
ALL_OK=true
for f in "${REQUIRED_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    ok "  $f"
  else
    err "  $f MANQUANT"
    ALL_OK=false
  fi
done
$ALL_OK || { err "Fichiers critiques manquants — déploiement annulé"; exit 1; }


# ══════════════════════════════════════════════════════════════
# ÉTAPE 2 — Test de connexion Supabase
# ══════════════════════════════════════════════════════════════
step "Étape 2 — Test de connexion Supabase"

# Extraire l'URL Supabase depuis supabase.js
SUPA_URL=$(grep -oP "SUPABASE_URL = '\K[^']+" js/supabase.js 2>/dev/null || echo "")
SUPA_KEY=$(grep -oP "SUPABASE_ANON = '\K[^']+" js/supabase.js 2>/dev/null || echo "")

if [[ -z "$SUPA_URL" || -z "$SUPA_KEY" ]]; then
  warn "Impossible de lire les credentials Supabase depuis supabase.js — test ignoré"
else
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "apikey: $SUPA_KEY" \
    -H "Authorization: Bearer $SUPA_KEY" \
    "${SUPA_URL}/rest/v1/services?select=id&limit=1" \
    --max-time 8 2>/dev/null || echo "000")

  if [[ "$HTTP_STATUS" == "200" ]]; then
    ok "Supabase accessible (HTTP $HTTP_STATUS)"
  elif [[ "$HTTP_STATUS" == "000" ]]; then
    warn "Supabase injoignable (timeout) — déploiement continué quand même"
  else
    warn "Supabase réponse HTTP $HTTP_STATUS — vérifiez les credentials dans supabase.js"
  fi
fi


# ══════════════════════════════════════════════════════════════
# ÉTAPE 3 — Build (hashing CSS/JS)
# ══════════════════════════════════════════════════════════════
step "Étape 3 — Build (versionnement CSS/JS)"

if $DRY; then
  node build.js --dry
  ok "Dry-run terminé — aucun fichier modifié"
else
  node build.js
  ok "Cache-busting appliqué sur tous les HTML"
fi


# ══════════════════════════════════════════════════════════════
# ÉTAPE 4 — Vérifications rapides post-build
# ══════════════════════════════════════════════════════════════
step "Étape 4 — Vérifications post-build"

# Vérifier qu'il n'y a pas de console.log/warn résiduels dans les JS de prod
# (exclure les fichiers de dev et les commentaires)
CONSOLE_HITS=$(grep -rn "console\.log\|console\.warn" js/ \
  --include="*.js" \
  --exclude="register-sw.js" \
  2>/dev/null | grep -v "^\s*//" | wc -l || echo "0")

if [[ "$CONSOLE_HITS" -gt "0" ]]; then
  warn "$CONSOLE_HITS console.log/warn détecté(s) dans les JS"
  grep -rn "console\.log\|console\.warn" js/ --include="*.js" --exclude="register-sw.js" \
    2>/dev/null | grep -v "^\s*//" | head -5 || true
else
  ok "Aucun console.log/warn résiduel"
fi

# Vérifier la présence du sitemap
[[ -f "sitemap.xml" ]] && ok "sitemap.xml présent" || warn "sitemap.xml manquant"

# Vérifier robots.txt
[[ -f "robots.txt" ]] && ok "robots.txt présent" || warn "robots.txt manquant"

# Compter les fichiers HTML
HTML_COUNT=$(ls *.html 2>/dev/null | wc -l)
ok "$HTML_COUNT fichiers HTML prêts"


# ══════════════════════════════════════════════════════════════
# ÉTAPE 5 — Déploiement Netlify
# ══════════════════════════════════════════════════════════════
step "Étape 5 — Déploiement Netlify"

if $DRY; then
  warn "Dry-run : déploiement ignoré"
  echo ""
  echo -e "${GREEN}${BOLD}✓ Simulation terminée avec succès${NC}"
  echo ""
  exit 0
fi

if $PREVIEW; then
  echo "  Déploiement en mode preview…"
  netlify deploy --dir=.
  ok "Déploiement preview terminé"
else
  echo "  Déploiement en production…"
  netlify deploy --dir=. --prod
  ok "Déploiement production terminé"
fi


# ══════════════════════════════════════════════════════════════
# FIN
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   ✓ Déploiement terminé avec succès   ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""
