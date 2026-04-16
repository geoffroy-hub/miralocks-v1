#!/usr/bin/env node
/* ============================================================
   Miralocks — build.js
   Script de build : remplace les ?v=XX par un hash court
   basé sur le contenu des fichiers CSS/JS.

   Usage :
     node build.js          → met à jour les ?v= dans tous les HTML
     node build.js --dry    → affiche les changements sans écrire

   Ce script est à lancer avant chaque déploiement.
   ============================================================ */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const DRY   = process.argv.includes('--dry');
const CHECK = process.argv.includes('--check');

/* ── Mode --check : tester la connexion Supabase avant le build ── */
if (CHECK) {
  const https = require('https');

  /* Lire les credentials depuis supabase.js */
  let supaUrl = '', supaKey = '';
  try {
    const src = fs.readFileSync('js/supabase.js', 'utf-8');
    const urlMatch = src.match(/SUPABASE_URL\s*=\s*'([^']+)'/);
    const keyMatch = src.match(/SUPABASE_ANON\s*=\s*'([^']+)'/);
    supaUrl = urlMatch?.[1] || '';
    supaKey = keyMatch?.[1] || '';
  } catch {
    console.error('  ✗ Impossible de lire js/supabase.js');
    process.exit(1);
  }

  if (!supaUrl || !supaKey) {
    console.error('  ✗ Credentials Supabase introuvables dans js/supabase.js');
    process.exit(1);
  }

  const testUrl = `${supaUrl}/rest/v1/services?select=id&limit=1`;
  const parsed  = new URL(testUrl);

  const req = https.request({
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    method: 'GET',
    timeout: 8000,
    headers: { 'apikey': supaKey, 'Authorization': `Bearer ${supaKey}` },
  }, (res) => {
    if (res.statusCode === 200) {
      console.log(`  ✓ Supabase accessible (HTTP ${res.statusCode})`);
      process.exit(0);
    } else {
      console.error(`  ✗ Supabase HTTP ${res.statusCode} — vérifiez vos credentials`);
      process.exit(1);
    }
  });

  req.on('timeout', () => { console.error('  ✗ Supabase timeout (8s)'); req.destroy(); process.exit(1); });
  req.on('error',   (e) => { console.error('  ✗ Supabase erreur réseau :', e.message); process.exit(1); });
  req.end();

} else {

/* ── Build normal ── */
function fileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
  } catch {
    return 'xxxxxxxx';
  }
}

/* ── Fichiers à versionner ── */
const ASSETS = [
  'css/styles.css',
  'css/admin.css',
  'js/main.js',
  'js/seo-meta.js',
  'js/lang.js',
  'js/supabase.js',
  'js/supabase2.js',
  'js/admin.js',
  'js/admin-charts.js',
  'js/admin-rdv.js',
  'js/admin-galerie.js',
  'js/admin-avis.js',
  'js/admin-settings.js',
  'js/admin-services.js',
  'js/admin-improvements.js',
  'js/admin-security.js',
  'js/admin-analytics.js',
  'js/public-features.js',
  'js/admin-business.js',
  'js/admin-monetisation.js',
  'js/admin-communication.js',
  'js/seo-advanced.js',
  'js/animations.js',
  'js/admin-ai.js',
  'js/chatbot-public.js',
  'js/performance.js',
  'js/register-sw.js',
];

/* ── Construire la map asset → hash ── */
const hashes = {};
for (const asset of ASSETS) {
  if (fs.existsSync(asset)) {
    hashes[asset] = fileHash(asset);
    console.log(`  ${asset} → ?v=${hashes[asset]}`);
  }
}

/* ── Remplacer dans tous les HTML ── */
const htmlFiles = fs.readdirSync('.')
  .filter(f => f.endsWith('.html'));

let totalReplacements = 0;

for (const htmlFile of htmlFiles) {
  let content = fs.readFileSync(htmlFile, 'utf-8');
  let changed = false;

  for (const [asset, hash] of Object.entries(hashes)) {
    // Remplace tous les patterns: asset?v=xxx ou asset (sans version)
    const name = asset.replace(/\//g, '\\/');
    // Pattern : src="js/main.js?v=XX" ou href="css/styles.css?v=XX"
    const re = new RegExp(`(["'])${name}(?:\\?v=[^"']*)?(['"])`, 'g');
    const newContent = content.replace(re, (_, q1, q2) => {
      totalReplacements++;
      return `${q1}${asset}?v=${hash}${q2}`;
    });
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }

  if (changed) {
    if (!DRY) {
      fs.writeFileSync(htmlFile, content, 'utf-8');
      console.log(`  ✅ ${htmlFile} mis à jour`);
    } else {
      console.log(`  [DRY] ${htmlFile} serait mis à jour`);
    }
  }
}

/* ── Mettre à jour le numéro de cache dans sw.js ── */
if (fs.existsSync('sw.js')) {
  let sw = fs.readFileSync('sw.js', 'utf-8');
  const shortHash = crypto.createHash('md5')
    .update(Object.values(hashes).join(''))
    .digest('hex').slice(0, 6);
  const newSw = sw.replace(
    /const CACHE_V = 'Miralocks-[^']+'/,
    `const CACHE_V = 'Miralocks-${shortHash}'`
  );
  if (newSw !== sw) {
    if (!DRY) {
      fs.writeFileSync('sw.js', newSw, 'utf-8');
      console.log(`  ✅ sw.js: cache version → Miralocks-${shortHash}`);
    } else {
      console.log(`  [DRY] sw.js: cache version → Miralocks-${shortHash}`);
    }
  }
}

console.log(`\n🎉 Build ${DRY ? '(dry-run) ' : ''}terminé — ${totalReplacements} référence(s) mise(s) à jour.`);

} /* fin else --check */
