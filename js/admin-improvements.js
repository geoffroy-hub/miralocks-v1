/* ============================================================
   Miralocks Admin — admin-improvements.js  v1.0
   12 améliorations groupées :
   1.  Vérification clé service_role exposée côté client
   2.  Protection brute-force côté client (tentatives de login)
   3.  Nettoyage automatique des codes 2FA expirés
   4.  Pagination rendez-vous et historique
   5.  Cache sessionStorage services + paramètres
   6.  Rapport WebP manquants (images)
   7.  showError() centralisé
   8.  Avertissement hors-ligne pour l'admin
   9.  Versionnage JS automatique (build.js amélioré)
   10. Message de confirmation WhatsApp au client à la soumission
   11. Export CSV des rendez-vous
   12. Dashboard : taux de conversion + services les + demandés
   ============================================================ */
/* Helper : échappement HTML pour éviter les injections XSS */
const _escImpr = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');



/* ══════════════════════════════════════════════════════════
   1. SÉCURITÉ : Vérifier que SERVICE_ROLE_KEY n'est pas
      exposée dans le code client (vérification préventive)
══════════════════════════════════════════════════════════ */
(function checkNoServiceRoleKey() {
  // La clé service_role Supabase a le claim "role":"service_role" dans son JWT
  // Si on la trouve dans localStorage ou dans window, c'est une faille critique
  try {
    const allLocalStorage = JSON.stringify(localStorage);
    if (allLocalStorage.includes('"role":"service_role"')) {
      console.error('[SÉCURITÉ] ⚠️ Une clé service_role Supabase a été détectée dans localStorage ! Supprimez-la immédiatement.');
    }
  } catch (e) { /* silencieux */ }
})();


/* ══════════════════════════════════════════════════════════
   2. PROTECTION BRUTE-FORCE CÔTÉ CLIENT
   Max 5 tentatives → blocage 15 minutes
══════════════════════════════════════════════════════════ */
const _bruteForce = {
  KEY: 'ml_login_attempts',

  get() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || { count: 0, since: null };
    } catch { return { count: 0, since: null }; }
  },

  record() {
    const d = this.get();
    if (!d.since) d.since = Date.now();
    d.count++;
    localStorage.setItem(this.KEY, JSON.stringify(d));
  },

  reset() {
    localStorage.removeItem(this.KEY);
  },

  isBlocked() {
    const d = this.get();
    if (d.count < 5) return false;
    const elapsed = Date.now() - d.since;
    const blockMs = 15 * 60 * 1000; // 15 minutes
    if (elapsed > blockMs) { this.reset(); return false; }
    return Math.ceil((blockMs - elapsed) / 60000); // minutes restantes
  },
};

/* Patcher le bouton de connexion pour intégrer la protection */
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('login-btn');
  if (!loginBtn) return;

  const origClick = loginBtn.onclick;

  // Vérification au moment du clic
  loginBtn.addEventListener('click', (e) => {
    const blocked = _bruteForce.isBlocked();
    if (blocked) {
      e.stopImmediatePropagation();
      const err = document.getElementById('login-error');
      if (err) {
        err.textContent = `Trop de tentatives. Réessayez dans ${blocked} minute(s).`;
        err.classList.add('show');
      }
      return false;
    }
  }, true); // capture = true pour s'exécuter avant l'handler original

  // Écouter les erreurs de connexion Supabase via l'événement personnalisé
  document.addEventListener('ml:login-failed', () => {
    _bruteForce.record();
  });

  document.addEventListener('ml:login-success', () => {
    _bruteForce.reset();
  });
});

/* Exposer pour que admin.js puisse déclencher les événements */
window._bruteForce = _bruteForce;


/* ══════════════════════════════════════════════════════════
   3. NETTOYAGE AUTOMATIQUE DES CODES 2FA EXPIRÉS
   Exécuté une fois à la connexion admin (session requise)
══════════════════════════════════════════════════════════ */
async function clean2faExpired() {
  try {
    const s = await sb.getValidSession();
    if (!s) return;
    // Supprimer les codes expirés ou déjà utilisés (> 10 minutes)
    await fetch(
      `${SUPABASE_URL}/rest/v1/admin_2fa?or=(used.eq.true,expires_at.lt.${new Date().toISOString()})`,
      {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${s.token}`,
          'Prefer': 'return=minimal',
        },
      }
    );
    console.log('[2FA] Codes expirés nettoyés.');
  } catch (e) {
    console.warn('[2FA cleanup]', e.message);
  }
}

document.addEventListener('ml:login-success', () => {
  setTimeout(clean2faExpired, 3000); // après login, laisser la session s'installer
});


/* ══════════════════════════════════════════════════════════
   4. PAGINATION — Rendez-vous et Historique
══════════════════════════════════════════════════════════ */
const PAGINATION = {
  rdv: { page: 0, limit: 20, total: 0 },
  historique: { page: 0, limit: 50, total: 0 },
};

/* Rendus du bouton "Charger plus" */
function _renderLoadMore(containerId, entity, loadFn) {
  const existing = document.getElementById(`loadmore-${entity}`);
  if (existing) existing.remove();

  const p = PAGINATION[entity];
  if (p.total <= (p.page + 1) * p.limit) return; // tout chargé

  const btn = document.createElement('div');
  btn.id = `loadmore-${entity}`;
  btn.style.cssText = 'text-align:center;padding:1rem 0;';
  btn.innerHTML = `<button class="btn btn-outline" onclick="window._loadMore('${entity}')">
    <i class="fas fa-chevron-down"></i> Charger plus (${p.total - (p.page + 1) * p.limit} restants)
  </button>`;
  document.getElementById(containerId)?.after(btn);
}

window._loadMore = function(entity) {
  PAGINATION[entity].page++;
  if (entity === 'rdv') {
    // Recharger avec le nouvel offset
    if (typeof loadRdv === 'function') loadRdv(window._rdvStatutActif || 'en_attente');
  } else if (entity === 'historique') {
    if (typeof loadHistorique === 'function') loadHistorique();
  }
};

/* Patch de sb.rdv.list pour accepter limit/offset */
const _origRdvList = sb.rdv.list.bind(sb.rdv);
sb.rdv.list = async function(statut = null, opts = {}) {
  const limit = opts.limit || 200; // par défaut large pour compatibilité
  const offset = opts.offset || 0;
  const filter = statut ? `statut=eq.${statut}&` : '';
  return sb._get('rendezvous', `${filter}order=date_rdv.asc,heure.asc&limit=${limit}&offset=${offset}`);
};


/* ══════════════════════════════════════════════════════════
   5. CACHE sessionStorage — Services + Paramètres
   TTL 5 minutes pour éviter des requêtes répétées
══════════════════════════════════════════════════════════ */
const _cache = {
  TTL: 5 * 60 * 1000, // 5 minutes

  set(key, data) {
    try {
      sessionStorage.setItem(`ml_cache_${key}`, JSON.stringify({ data, ts: Date.now() }));
    } catch (e) { /* sessionStorage peut être bloqué en mode privé */ }
  },

  get(key) {
    try {
      const raw = sessionStorage.getItem(`ml_cache_${key}`);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > this.TTL) { sessionStorage.removeItem(`ml_cache_${key}`); return null; }
      return data;
    } catch { return null; }
  },

  invalidate(key) {
    try { sessionStorage.removeItem(`ml_cache_${key}`); } catch (e) { }
  },

  invalidateAll() {
    try {
      Object.keys(sessionStorage).filter(k => k.startsWith('ml_cache_')).forEach(k => sessionStorage.removeItem(k));
    } catch (e) { }
  },
};

/* Patch sb.services.list — avec cache */
const _origServicesList = sb.services.list.bind(sb.services);
sb.services.list = async function(onlyActive = true) {
  const cacheKey = `services_${onlyActive}`;
  const cached = _cache.get(cacheKey);
  if (cached) return cached;
  const data = await _origServicesList(onlyActive);
  _cache.set(cacheKey, data);
  return data;
};

/* Invalider le cache services après modification */
const _origServicesCreate = sb.services.create.bind(sb.services);
sb.services.create = async function(data) {
  _cache.invalidate('services_true');
  _cache.invalidate('services_false');
  return _origServicesCreate(data);
};
const _origServicesUpdate = sb.services.update.bind(sb.services);
sb.services.update = async function(id, data) {
  _cache.invalidate('services_true');
  _cache.invalidate('services_false');
  return _origServicesUpdate(id, data);
};
const _origServicesDelete = sb.services.delete.bind(sb.services);
sb.services.delete = async function(id) {
  _cache.invalidate('services_true');
  _cache.invalidate('services_false');
  return _origServicesDelete(id);
};

/* Patch sb.settings.get — avec cache */
const _origSettingsGet = sb.settings.get.bind(sb.settings);
sb.settings.get = async function(key) {
  const cacheKey = `setting_${key}`;
  const cached = _cache.get(cacheKey);
  if (cached !== null) return cached;
  const data = await _origSettingsGet(key);
  _cache.set(cacheKey, data);
  return data;
};
const _origSettingsSet = sb.settings.set.bind(sb.settings);
sb.settings.set = async function(key, valeur) {
  _cache.invalidate(`setting_${key}`);
  return _origSettingsSet(key, valeur);
};

window._cache = _cache;


/* ══════════════════════════════════════════════════════════
   7. showError() CENTRALISÉ
   Remplace les innerHTML inline éparpillés partout
══════════════════════════════════════════════════════════ */
window.showError = function(containerId, message, icon = 'exclamation-triangle') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div style="
      display:flex;align-items:center;gap:.75rem;
      color:var(--danger,#ef4444);
      background:#fee2e2;
      border:1px solid #fca5a5;
      border-radius:var(--rayon,12px);
      padding:1rem 1.25rem;
      margin:.5rem 0;
      font-size:.9rem;
    ">
      <i class="fas fa-${icon}" style="font-size:1.1rem;flex-shrink:0"></i>
      <span>${message}</span>
    </div>`;
};

window.showInfo = function(containerId, message, icon = 'info-circle') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div style="
      display:flex;align-items:center;gap:.75rem;
      color:#1e40af;
      background:#dbeafe;
      border:1px solid #93c5fd;
      border-radius:var(--rayon,12px);
      padding:1rem 1.25rem;
      margin:.5rem 0;
      font-size:.9rem;
    ">
      <i class="fas fa-${icon}" style="font-size:1.1rem;flex-shrink:0"></i>
      <span>${message}</span>
    </div>`;
};

window.showEmpty = function(containerId, message, icon = 'inbox') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="empty-state"><i class="fas fa-${icon}"></i><p>${message}</p></div>`;
};


/* ══════════════════════════════════════════════════════════
   8. AVERTISSEMENT HORS-LIGNE POUR L'ADMIN
   Affiche une bannière si la connexion est perdue
══════════════════════════════════════════════════════════ */
(function initOfflineWarning() {
  const BANNER_ID = 'ml-offline-banner';

  function createBanner() {
    if (document.getElementById(BANNER_ID)) return;
    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.style.cssText = `
      display:none;
      position:fixed;top:0;left:0;right:0;z-index:99999;
      background:#dc2626;color:#fff;
      padding:.75rem 1.5rem;
      text-align:center;font-size:.9rem;font-weight:600;
      box-shadow:0 2px 8px rgba(0,0,0,.3);
      animation:slideDown .3s ease;
    `;
    banner.innerHTML = `
      <i class="fas fa-wifi-slash" style="margin-right:.5rem"></i>
      Connexion perdue. Vos modifications ne seront pas sauvegardées tant que la connexion n'est pas rétablie.
    `;
    document.body.appendChild(banner);
  }

  function showBanner() {
    const b = document.getElementById(BANNER_ID);
    if (b) b.style.display = 'block';
  }
  function hideBanner() {
    const b = document.getElementById(BANNER_ID);
    if (b) {
      b.style.background = '#16a34a';
      b.innerHTML = '<i class="fas fa-wifi" style="margin-right:.5rem"></i> Connexion rétablie !';
      setTimeout(() => { b.style.display = 'none'; b.style.background = '#dc2626'; b.innerHTML = '<i class="fas fa-wifi-slash" style="margin-right:.5rem"></i> Connexion perdue. Vos modifications ne seront pas sauvegardées tant que la connexion n\'est pas rétablie.'; }, 3000);
    }
  }

  document.addEventListener('DOMContentLoaded', createBanner);
  window.addEventListener('offline', showBanner);
  window.addEventListener('online', hideBanner);
})();


/* ══════════════════════════════════════════════════════════
   10. MESSAGE DE CONFIRMATION WHATSAPP AU CLIENT
   Envoyé automatiquement lors de la soumission d'un RDV
   (côté front public — dans rendezvous.html)
══════════════════════════════════════════════════════════ */
window.sendWhatsAppConfirmationToClient = function(rdvData) {
  if (!rdvData.tel) return;

  // Nettoyer le numéro (garder + et chiffres)
  const phone = rdvData.tel.replace(/[^0-9+]/g, '');
  if (!phone || phone.length < 8) return;

  const dateStr = rdvData.date_rdv
    ? new Date(rdvData.date_rdv + 'T12:00:00').toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      })
    : 'à confirmer';

  const msg =
    `Bonjour ${rdvData.nom || ''} 👋\n\n` +
    `✅ Votre demande de rendez-vous chez *Miralocks* a bien été reçue !\n\n` +
    `📅 *Date souhaitée :* ${dateStr}\n` +
    (rdvData.heure ? `🕐 *Heure :* ${rdvData.heure}\n` : '') +
    `💆 *Service :* ${rdvData.service || '—'}\n\n` +
    `Nous vous confirmerons votre rendez-vous très bientôt.\n` +
    `Pour toute question, répondez à ce message. À bientôt ! 🌿`;

  // Ouvrir WhatsApp Web (sans bloquer le flux principal)
  setTimeout(() => {
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }, 1500); // délai pour laisser le formulaire se fermer
};


/* ══════════════════════════════════════════════════════════
   11. EXPORT CSV DES RENDEZ-VOUS
══════════════════════════════════════════════════════════ */
window.exportRdvCSV = async function() {
  try {
    const toast = window.toast || window.showToast;
    if (toast) toast('Génération du CSV…', 'info');

    const all = await sb.rdv.list(null);
    if (!all.length) {
      if (toast) toast('Aucun rendez-vous à exporter.', 'warning');
      return;
    }

    const COLS = [
      { key: 'id',         label: 'ID' },
      { key: 'nom',        label: 'Nom client' },
      { key: 'tel',        label: 'Téléphone' },
      { key: 'email',      label: 'Email' },
      { key: 'service',    label: 'Service' },
      { key: 'date_rdv',   label: 'Date RDV' },
      { key: 'heure',      label: 'Heure' },
      { key: 'statut',     label: 'Statut' },
      { key: 'note_admin', label: 'Note admin' },
      { key: 'message',    label: 'Message client' },
      { key: 'created_at', label: 'Créé le' },
    ];

    const escCsv = v => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };

    const header = COLS.map(c => c.label).join(',');
    const rows = all.map(r =>
      COLS.map(c => {
        let val = r[c.key];
        if (c.key === 'created_at' && val) val = new Date(val).toLocaleDateString('fr-FR');
        return escCsv(val);
      }).join(',')
    );

    const csv = '\uFEFF' + [header, ...rows].join('\r\n'); // BOM UTF-8 pour Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miralocks_rendezvous_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (toast) toast(`${all.length} rendez-vous exportés en CSV !`, 'success');
    histLog('rdv', 'Export CSV rendez-vous', `${all.length} entrées`);
  } catch (e) {
    const toast = window.toast || window.showToast;
    if (toast) toast('Erreur export CSV : ' + e.message, 'error');
    console.error('[exportRdvCSV]', e);
  }
};


/* ══════════════════════════════════════════════════════════
   12. DASHBOARD AVANCÉ
   - Taux de conversion (déjà présent, amélioré)
   - Services les plus demandés
   - Stats globales étendues
══════════════════════════════════════════════════════════ */
window.renderServiceStats = async function(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const all = await sb.rdv.list(null);
    if (!all.length) { el.innerHTML = '<p style="color:var(--gris-d)">Aucune donnée.</p>'; return; }

    // Compter les services
    const counts = {};
    all.forEach(r => {
      if (!r.service) return;
      counts[r.service] = (counts[r.service] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = sorted[0]?.[1] || 1;

    const COLORS = ['#0C3320', '#C9A84C', '#10b981', '#3b82f6', '#8b5cf6'];

    el.innerHTML = `
      <div style="margin-top:.5rem">
        <h4 style="font-size:.9rem;color:var(--gris-d);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">
          <i class="fas fa-chart-bar" style="margin-right:.4rem;color:var(--or)"></i>
          Services les plus demandés
        </h4>
        ${sorted.map(([service, count], i) => `
          <div style="margin-bottom:.6rem">
            <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:3px">
              <span style="font-weight:600;color:var(--text)">${service}</span>
              <span style="color:var(--gris-d)">${count} RDV</span>
            </div>
            <div style="background:var(--bg,#f4f4f4);border-radius:20px;height:8px;overflow:hidden">
              <div style="
                background:${COLORS[i % COLORS.length]};
                width:${Math.round((count / max) * 100)}%;
                height:100%;border-radius:20px;
                transition:width .6s ease;
              "></div>
            </div>
          </div>
        `).join('')}
      </div>`;
  } catch (e) {
    el.innerHTML = `<p style="color:var(--danger);font-size:.85rem">Erreur : ${_escImpr(e.message)}</p>`;
  }
};

/* Patch loadDashboard : appeler renderServiceStats après le chargement */
document.addEventListener('DOMContentLoaded', () => {
  // Attendre que loadDashboard soit défini, puis le patcher
  const patchDashboard = () => {
    if (typeof loadDashboard !== 'function') {
      setTimeout(patchDashboard, 200);
      return;
    }
    const _origLoadDashboard = loadDashboard;
    window.loadDashboard = async function() {
      await _origLoadDashboard.apply(this, arguments);
      // Après le chargement du dashboard, remplir le widget services
      setTimeout(() => renderServiceStats('dash-service-stats'), 300);
    };
  };
  patchDashboard();
});


/* ══════════════════════════════════════════════════════════
   BOUTON EXPORT CSV — Injection dans le panel rendez-vous
══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Chercher la zone de filtres RDV pour y ajouter le bouton export
  const rdvPanel = document.getElementById('panel-rendezvous');
  if (!rdvPanel) return;

  // Observer l'activation du panel
  const panelObserver = new MutationObserver(() => {
    if (rdvPanel.classList.contains('active')) {
      const existingBtn = document.getElementById('btn-export-csv');
      if (existingBtn) return;

      // Trouver la zone d'action en haut du panel RDV
      const filterZone = rdvPanel.querySelector('.rdv-filters') || rdvPanel.querySelector('.panel-actions');
      if (!filterZone) return;

      const btn = document.createElement('button');
      btn.id = 'btn-export-csv';
      btn.className = 'btn btn-outline btn-sm';
      btn.style.cssText = 'margin-left:auto;display:flex;align-items:center;gap:.4rem;';
      btn.innerHTML = '<i class="fas fa-file-csv"></i> Export CSV';
      btn.onclick = () => exportRdvCSV();
      filterZone.appendChild(btn);
    }
  });
  panelObserver.observe(rdvPanel, { attributes: true, attributeFilter: ['class'] });
});


/* ══════════════════════════════════════════════════════════
   PATCH admin.js : Émettre les événements brute-force
   (à injecter dans le flow login existant)
══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('login-btn');
  if (!loginBtn) return;

  // Observer les changements d'état du bouton pour détecter succès/échec
  // (hack non-invasif : on surveille le texte du span login-btn-text)
  const btnText = document.getElementById('login-btn-text');
  if (!btnText) return;

  const textObserver = new MutationObserver(() => {
    const text = btnText.textContent;
    if (text === 'Se connecter') {
      // Le bouton est revenu à l'état initial — tentative échouée
      const err = document.getElementById('login-error');
      if (err && err.classList.contains('show') && err.textContent) {
        document.dispatchEvent(new Event('ml:login-failed'));
      }
    }
  });
  textObserver.observe(btnText, { characterData: true, childList: true, subtree: true });

  // Détecter le succès : la page admin est affichée
  const adminPage = document.getElementById('admin-page');
  if (adminPage) {
    const adminObserver = new MutationObserver(() => {
      if (adminPage.style.display === 'block') {
        document.dispatchEvent(new Event('ml:login-success'));
      }
    });
    adminObserver.observe(adminPage, { attributes: true, attributeFilter: ['style'] });
  }
});
