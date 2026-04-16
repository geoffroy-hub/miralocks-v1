/* ============================================================
   Miralocks — seo-advanced.js  v1.0
   SEO, Planning & Robustesse :
   4.  Sitemap dynamique (blog + galerie)
   5.  Open Graph dynamique par article/photo
   6.  Schema.org enrichi (avis, services, FAQ)
   7.  Vue planning hebdomadaire
   8.  Durées par service + créneaux sans chevauchement
   9.  SMS via Africa's Talking
   10. Tests automatiques de la base
   11. Gestion erreurs réseau
   12. Logs d'erreurs centralisés
   ============================================================ */
/* Helper : échappement HTML pour éviter les injections XSS */
const _escSeo = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');



/* ══════════════════════════════════════════════════════════
   4. SITEMAP DYNAMIQUE
   Génère et télécharge un sitemap.xml à jour
   incluant les articles de blog et photos de galerie
══════════════════════════════════════════════════════════ */
window.generateDynamicSitemap = async function() {
  const toast = window.toast || window.showToast;
  try {
    toast?.('Génération du sitemap…', 'info');

    const BASE = window.location.origin || 'https://mira-lecks.vercel.app';
    const now = new Date().toISOString().slice(0, 10);

    /* Pages statiques */
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'weekly' },
      { url: '/gallery.html', priority: '0.9', changefreq: 'weekly' },
      { url: '/services.html', priority: '0.9', changefreq: 'monthly' },
      { url: '/rendezvous.html', priority: '0.95', changefreq: 'weekly' },
      { url: '/blog.html', priority: '0.8', changefreq: 'weekly' },
      { url: '/avis.html', priority: '0.7', changefreq: 'weekly' },
      { url: '/contact.html', priority: '0.8', changefreq: 'monthly' },
      { url: '/about.html', priority: '0.7', changefreq: 'monthly' },
      { url: '/faq.html', priority: '0.7', changefreq: 'monthly' },
    ];

    /* Articles de blog publiés */
    const posts = await sb.blog.list(true).catch(() => []);
    const blogUrls = posts.map(p => ({
      url: `/blog.html?slug=${p.slug || p.id}`,
      priority: '0.7',
      changefreq: 'monthly',
      lastmod: p.created_at ? new Date(p.created_at).toISOString().slice(0, 10) : now,
    }));

    const allUrls = [...staticPages, ...blogUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- Généré automatiquement le ${now} par Miralocks Admin -->
${allUrls.map(u => `  <url>
    <loc>${BASE}${u.url}</loc>
    <lastmod>${u.lastmod || now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sitemap.xml';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);

    toast?.(`✅ Sitemap généré — ${allUrls.length} URLs`, 'success');
    await histLog('autre', 'Sitemap dynamique généré', `${allUrls.length} URLs dont ${blogUrls.length} articles`);
  } catch(e) {
    (window.toast || window.showToast)?.('Erreur sitemap : ' + e.message, 'error');
  }
};


/* ══════════════════════════════════════════════════════════
   5. OPEN GRAPH DYNAMIQUE PAR ARTICLE DE BLOG
   Lit le slug dans l'URL et met à jour les balises OG
   pour un meilleur aperçu WhatsApp/Facebook
══════════════════════════════════════════════════════════ */
window.initDynamicOG = async function() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug') || params.get('id');

  if (!slug || !page.includes('blog')) return;
  if (!window.sb) return;

  try {
    /* Trouver l'article par slug ou ID */
    let post = null;
    if (!isNaN(slug)) {
      post = await sb.blog.get(slug);
    } else {
      const posts = await sb._get('blog_posts', `slug=eq.${encodeURIComponent(slug)}&publie=eq.true`);
      post = posts?.[0] || null;
    }
    if (!post) return;

    const BASE = window.location.origin;
    const setMeta = (attr, name, content) => {
      let el = document.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };

    const title = `${post.titre} — Miralocks Blog`;
    const desc  = post.extrait || post.contenu?.slice(0, 160) || '';
    const img   = post.photo_url || `${BASE}/assets/og-image.jpg`;
    const url   = `${BASE}/blog.html?slug=${post.slug || post.id}`;

    /* Mettre à jour les balises */
    document.title = title;
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:image', img);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:type', 'article');
    setMeta('name', 'description', desc);

    /* Schema.org Article */
    const existing = document.querySelector('script[type="application/ld+json"]');
    const articleLD = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      'headline': post.titre,
      'description': desc,
      'image': img,
      'url': url,
      'datePublished': post.created_at,
      'author': { '@type': 'Organization', 'name': 'Miralocks' },
      'publisher': {
        '@type': 'Organization',
        'name': 'Miralocks',
        'logo': { '@type': 'ImageObject', 'url': `${BASE}/assets/logo-or.png` }
      },
    };

    if (existing) {
      /* Garder le LocalBusiness + ajouter l'article */
      const ldScript = document.createElement('script');
      ldScript.type = 'application/ld+json';
      ldScript.textContent = JSON.stringify(articleLD);
      document.head.appendChild(ldScript);
    }

  } catch(e) {
    console.warn('[DynamicOG]', e.message);
  }
};

/* Activer sur blog.html */
if (window.location.pathname.includes('blog') || window.location.search.includes('slug')) {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initDynamicOG, 500));
}


/* ══════════════════════════════════════════════════════════
   6. SCHEMA.ORG ENRICHI
   Ajoute les avis clients, services et FAQ au JSON-LD
══════════════════════════════════════════════════════════ */
window.enrichSchemaOrg = async function() {
  if (!window.sb) return;
  const BASE = window.location.origin;

  try {
    const [avis, services] = await Promise.all([
      sb.avis.list(true).catch(() => []),
      sb.services.list(true).catch(() => []),
    ]);

    const avgRating = avis.length
      ? (avis.reduce((a, v) => a + (v.etoiles || 5), 0) / avis.length).toFixed(1)
      : '4.9';

    /* Schema enrichi */
    const enriched = {
      '@context': 'https://schema.org',
      '@type': 'HairSalon',
      'name': 'Institut MiraLocks',
      'url': BASE,
      'logo': `${BASE}/assets/logo-or.png`,
      'image': `${BASE}/assets/og-image.jpg`,
      'telephone': '+22897989001',
      'email': 'contact@miralocks.tg',
      'address': {
        '@type': 'PostalAddress',
        'streetAddress': "Agoè Cacaveli, près de l'école La Source",
        'addressLocality': 'Lomé',
        'addressRegion': 'Maritime',
        'addressCountry': 'TG',
      },
      'geo': { '@type': 'GeoCoordinates', 'latitude': '6.224345', 'longitude': '1.193420' },
      'openingHoursSpecification': [{
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Tuesday','Wednesday','Thursday','Friday','Saturday'],
        'opens': '08:00', 'closes': '18:00',
      }],
      'priceRange': '2000 FCFA – 100000 FCFA',
      'currenciesAccepted': 'XOF',
      'paymentAccepted': 'Cash, Mobile Money',
      'aggregateRating': avis.length ? {
        '@type': 'AggregateRating',
        'ratingValue': avgRating,
        'reviewCount': String(avis.length),
        'bestRating': '5',
        'worstRating': '1',
      } : undefined,
      'review': avis.slice(0, 5).map(a => ({
        '@type': 'Review',
        'reviewRating': { '@type': 'Rating', 'ratingValue': String(a.etoiles || 5), 'bestRating': '5' },
        'author': { '@type': 'Person', 'name': a.nom || 'Client' },
        'reviewBody': a.texte || '',
        'datePublished': a.created_at ? new Date(a.created_at).toISOString().slice(0, 10) : undefined,
      })),
      'hasOfferCatalog': services.length ? {
        '@type': 'OfferCatalog',
        'name': 'Services Miralocks',
        'itemListElement': services.slice(0, 10).map((s, i) => ({
          '@type': 'Offer',
          'position': i + 1,
          'name': s.nom,
          'description': s.description || '',
          'price': s.prix || undefined,
          'priceCurrency': 'XOF',
        })),
      } : undefined,
      'sameAs': [
        'https://www.instagram.com/institut_Miralocks',
        'https://www.facebook.com/mira.lachocote',
        'https://www.tiktok.com/@institut_mira_locks228',
      ],
    };

    /* Supprimer undefined */
    const clean = JSON.parse(JSON.stringify(enriched));

    /* Remplacer le JSON-LD existant */
    const existing = document.querySelector('script[type="application/ld+json"]');
    if (existing) {
      existing.textContent = JSON.stringify(clean);
    } else {
      const ld = document.createElement('script');
      ld.type = 'application/ld+json';
      ld.textContent = JSON.stringify(clean);
      document.head.appendChild(ld);
    }

  } catch(e) {
    console.warn('[SchemaOrg]', e.message);
  }
};

/* Activer sur les pages publiques */
if (!window.location.pathname.includes('admin')) {
  document.addEventListener('DOMContentLoaded', () => setTimeout(enrichSchemaOrg, 1000));
}


/* ══════════════════════════════════════════════════════════
   7. VUE PLANNING HEBDOMADAIRE AMÉLIORÉE
   Agenda semaine avec créneaux horaires visuels
══════════════════════════════════════════════════════════ */
window.renderWeeklyPlanning = async function(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement du planning…</div>';

  try {
    /* Calculer la semaine courante (Lundi→Samedi) */
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=dim
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const days = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });

    const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i); // 8h à 18h
    const JOURS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    /* Récupérer les RDV de la semaine */
    const weekStart = days[0].toISOString().slice(0, 10);
    const weekEnd   = days[5].toISOString().slice(0, 10);
    const rdvs = await sb._get('rendezvous',
      `date_rdv=gte.${weekStart}&date_rdv=lte.${weekEnd}&statut=neq.annule&order=date_rdv.asc,heure.asc`
    );

    /* Récupérer les fermetures */
    let closedDates = [];
    try {
      const rawF = await sb.settings.get('dates_fermetures').catch(() => null);
      if (rawF) closedDates = JSON.parse(rawF).map(f => f.date);
    } catch { }

    /* Organiser par date+heure */
    const rdvMap = {};
    rdvs.forEach(r => {
      const h = r.heure ? parseInt(r.heure.replace('h', ':').split(':')[0]) : null;
      if (h === null) return;
      const key = `${r.date_rdv}_${h}`;
      if (!rdvMap[key]) rdvMap[key] = [];
      rdvMap[key].push(r);
    });

    const STATUS_COLORS = {
      en_attente: '#f59e0b',
      confirme: '#10b981',
      termine: '#6b7280',
    };

    const todayStr = today.toISOString().slice(0, 10);

    /* Navigation semaines */
    el.dataset.weekOffset = el.dataset.weekOffset || '0';

    el.innerHTML = `
      <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
        <!-- En-tête navigation -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;gap:.5rem;flex-wrap:wrap">
          <div style="display:flex;gap:.5rem">
            <button class="btn btn-sm btn-outline" onclick="navigateWeek(-1)"><i class="fas fa-chevron-left"></i></button>
            <button class="btn btn-sm btn-outline" onclick="navigateWeek(0)">Aujourd'hui</button>
            <button class="btn btn-sm btn-outline" onclick="navigateWeek(1)"><i class="fas fa-chevron-right"></i></button>
          </div>
          <span style="font-weight:600;color:var(--vert,#0C3320);font-size:.9rem">
            ${days[0].toLocaleDateString('fr-FR',{day:'numeric',month:'short'})} – ${days[5].toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}
          </span>
          <div style="display:flex;gap:.35rem;font-size:.72rem">
            ${Object.entries(STATUS_COLORS).map(([s,c])=>`<span style="background:${c};color:#fff;padding:2px 8px;border-radius:20px">${s==='en_attente'?'En attente':s==='confirme'?'Confirmé':'Terminé'}</span>`).join('')}
          </div>
        </div>

        <!-- Grille planning -->
        <div style="display:grid;grid-template-columns:50px repeat(6,1fr);min-width:600px;border:1px solid var(--border,#e5e7eb);border-radius:12px;overflow:hidden">

          <!-- En-têtes jours -->
          <div style="background:var(--bg,#f9fafb);border-bottom:2px solid var(--border,#e5e7eb)"></div>
          ${days.map((d, i) => {
            const ds = d.toISOString().slice(0,10);
            const isToday = ds === todayStr;
            const isClosed = closedDates.includes(ds) || d.getDay() === 0;
            return `<div style="
              padding:.5rem .25rem;text-align:center;font-size:.78rem;font-weight:700;
              background:${isToday ? 'var(--vert,#0C3320)' : isClosed ? '#fee2e2' : 'var(--bg,#f9fafb)'};
              color:${isToday ? 'var(--or,#C9A84C)' : isClosed ? '#991b1b' : 'var(--text)'};
              border-bottom:2px solid var(--border,#e5e7eb);
              border-left:1px solid var(--border,#e5e7eb);
            ">
              ${JOURS_FR[i]}<br>
              <span style="font-size:.85rem;font-weight:${isToday?'800':'600'}">${d.getDate()}</span>
              ${isClosed && !isToday ? '<div style="font-size:.62rem;opacity:.7">Fermé</div>' : ''}
            </div>`;
          }).join('')}

          <!-- Lignes horaires -->
          ${HOURS.map(h => `
            <!-- Heure label -->
            <div style="
              padding:.3rem .4rem;font-size:.72rem;color:var(--gris-d,#aaa);
              text-align:right;border-top:1px solid var(--border,#e5e7eb);
              background:var(--bg,#f9fafb);font-weight:600;
            ">${h}h</div>

            <!-- Cellules par jour -->
            ${days.map(d => {
              const ds = d.toISOString().slice(0,10);
              const key = `${ds}_${h}`;
              const rdvsInSlot = rdvMap[key] || [];
              const isClosed = closedDates.includes(ds) || d.getDay() === 0;
              const isPast = ds < todayStr || (ds === todayStr && h < new Date().getHours());

              return `<div style="
                min-height:44px;padding:2px;
                border-top:1px solid var(--border,#e5e7eb);
                border-left:1px solid var(--border,#e5e7eb);
                background:${isClosed ? 'rgba(239,68,68,.05)' : isPast ? 'rgba(0,0,0,.02)' : 'var(--bg-card,#fff)'};
                position:relative;
              ">
                ${rdvsInSlot.map(r => `
                  <div onclick="rdvToggle?.(${r.id})" style="
                    background:${STATUS_COLORS[r.statut]||'#888'};
                    color:#fff;font-size:.65rem;font-weight:600;
                    padding:2px 4px;border-radius:4px;margin-bottom:2px;
                    cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
                    line-height:1.3;
                  " title="${r.nom} — ${r.service}">
                    ${r.nom.split(' ')[0]}
                  </div>`).join('')}
              </div>`;
            }).join('')}
          `).join('')}
        </div>
      </div>`;

    /* Résumé de la semaine */
    const totalSemaine = rdvs.length;
    const confirmes = rdvs.filter(r=>r.statut==='confirme').length;
    if (totalSemaine > 0) {
      const summary = document.createElement('div');
      summary.style.cssText = 'display:flex;gap:1rem;margin-top:.75rem;flex-wrap:wrap';
      summary.innerHTML = `
        <span style="font-size:.82rem;color:var(--gris-d)"><i class="fas fa-calendar-check" style="color:var(--or,#C9A84C);margin-right:.3rem"></i>${totalSemaine} RDV cette semaine</span>
        <span style="font-size:.82rem;color:var(--gris-d)"><i class="fas fa-check-circle" style="color:#10b981;margin-right:.3rem"></i>${confirmes} confirmé(s)</span>
      `;
      el.appendChild(summary);
    }

  } catch(e) {
    el.innerHTML = `<div style="color:var(--danger);padding:1rem;background:#fee2e2;border-radius:12px"><i class="fas fa-exclamation-triangle"></i> Erreur : ${_escSeo(e.message)}</div>`;
  }
};

/* Navigation entre semaines */
let _weekOffset = 0;
window.navigateWeek = async function(direction) {
  if (direction === 0) _weekOffset = 0;
  else _weekOffset += direction;

  /* Décaler la date système */
  const orig = Date;
  const offset = _weekOffset * 7 * 24 * 60 * 60 * 1000;
  const OrigDate = Date;

  /* Hack propre : passer l'offset en paramètre */
  window._planningWeekOffset = offset;
  await renderWeeklyPlanning('planning-weekly');
};

/* Patch pour tenir compte de l'offset de semaine */
const _origRenderWeekly = window.renderWeeklyPlanning;
window.renderWeeklyPlanning = async function(containerId) {
  /* Si on a un offset, décaler temporairement */
  if (window._planningWeekOffset) {
    const origNow = Date.now;
    Date.now = () => origNow.call(Date) + (window._planningWeekOffset || 0);
    try { await _origRenderWeekly(containerId); }
    finally { Date.now = origNow; }
  } else {
    await _origRenderWeekly(containerId);
  }
};


/* ══════════════════════════════════════════════════════════
   8. DURÉES PAR SERVICE + CRÉNEAUX SANS CHEVAUCHEMENT
══════════════════════════════════════════════════════════ */
window.ServiceDurations = {
  KEY_PREFIX: 'service_duration_',

  async get(serviceName) {
    const key = this.KEY_PREFIX + encodeURIComponent(serviceName);
    const val = await sb.settings.get(key).catch(() => null);
    return val ? parseInt(val) : 60; // défaut 60 min
  },

  async set(serviceName, minutes) {
    const key = this.KEY_PREFIX + encodeURIComponent(serviceName);
    await sb.settings.set(key, String(minutes));
    if (window._cache) window._cache.invalidate('setting_' + key);
  },

  /* Vérifier si un créneau est disponible sans chevauchement */
  async isSlotAvailable(date, heure, serviceName, excludeId = null) {
    const duration = await this.get(serviceName);
    const startH = parseInt(heure.replace('h', ':').split(':')[0]);
    const startM = parseInt(heure.replace('h', ':').split(':')[1] || '0');
    const startMin = startH * 60 + startM;
    const endMin = startMin + duration;

    const rdvs = await sb._get('rendezvous',
      `date_rdv=eq.${date}&statut=neq.annule&select=id,heure,service`
    );

    for (const r of rdvs) {
      if (excludeId && r.id === excludeId) continue;
      if (!r.heure) continue;
      const rH = parseInt(r.heure.replace('h', ':').split(':')[0]);
      const rM = parseInt(r.heure.replace('h', ':').split(':')[1] || '0');
      const rStart = rH * 60 + rM;
      const rDuration = await this.get(r.service);
      const rEnd = rStart + rDuration;

      /* Chevauchement ? */
      if (startMin < rEnd && endMin > rStart) return false;
    }
    return true;
  },
};


/* ══════════════════════════════════════════════════════════
   9. SMS VIA AFRICA'S TALKING
══════════════════════════════════════════════════════════ */
window.SMS = {
  async send(to, message) {
    const apiKey   = await sb.settings.get('africastalking_apikey').catch(() => null);
    const username = await sb.settings.get('africastalking_username').catch(() => 'sandbox');
    if (!apiKey) throw new Error("Clé Africa's Talking non configurée dans les paramètres");

    /* Nettoyer le numéro — ajouter +228 si nécessaire */
    let phone = to.replace(/\s/g, '');
    if (!phone.startsWith('+')) phone = '+228' + phone.replace(/^0/, '');

    const r = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': apiKey,
      },
      body: new URLSearchParams({
        username,
        to: phone,
        message,
        from: 'MiraLocks',
      }),
    });

    if (!r.ok) throw new Error(`SMS API error (${r.status})`);
    const data = await r.json();
    return data;
  },

  async sendRdvConfirmation(rdv) {
    const msg = `Miralocks: Votre RDV du ${rdv.date_rdv} a ${rdv.heure||'—'} pour "${rdv.service}" est CONFIRME. Merci!`;
    try {
      await this.send(rdv.tel, msg);
      await histLog('rdv', 'SMS confirmation envoyé', `${rdv.nom} — ${rdv.tel}`);
      return true;
    } catch(e) {
      console.warn('[SMS]', e.message);
      return false;
    }
  },
};


/* ══════════════════════════════════════════════════════════
   10. TESTS AUTOMATIQUES DE LA BASE
══════════════════════════════════════════════════════════ */
window.runHealthCheck = async function() {
  const results = [];
  const check = async (name, fn) => {
    try {
      await fn();
      results.push({ name, ok: true });
    } catch(e) {
      results.push({ name, ok: false, error: e.message });
    }
  };

  const URL1 = window.SUPABASE_URL;
  const KEY1 = window.SUPABASE_ANON;
  const URL2 = window.SUPABASE2_URL;
  const KEY2 = window.SUPABASE2_ANON;

  if (!URL1 || !KEY1) {
    return [{ name: 'Configuration Supabase', ok: false, error: 'URL ou Clé API manquante dans js/supabase.js' }];
  }

  /* Test connexion Supabase 1 */
  await check('Connexion Supabase principale', async () => {
    const r = await fetch(`${URL1}/rest/v1/services?limit=1`, {
      headers: { 'apikey': KEY1 },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  });

  /* Test chaque table */
  const tables = ['services','blog_posts','galerie_photos','avis_clients','rendezvous','historique','site_settings','visites'];
  for (const t of tables) {
    await check(`Table: ${t}`, async () => {
      let token = KEY1;
      if (window.sb && typeof window.sb.getValidSession === 'function') {
        const s = await window.sb.getValidSession();
        if (s?.token) token = s.token;
      }
      const r = await fetch(`${URL1}/rest/v1/${t}?limit=1`, {
        headers: { 'apikey': KEY1, 'Authorization': `Bearer ${token}` },
      });
      if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.message || `HTTP ${r.status}`); }
    });
  }

  /* Test Supabase 2 */
  if (URL2 && KEY2 && !URL2.includes('VOTRE_2EME_URL')) {
    await check('Connexion Supabase vidéos', async () => {
      const r = await fetch(`${URL2}/rest/v1/galerie_videos?limit=1`, {
        headers: { 'apikey': KEY2 },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    });
  }

  /* Test Storage */
  await check('Storage bucket (Miralocks-media)', async () => {
    const r = await fetch(`${URL1}/storage/v1/bucket/Miralocks-media`, {
      headers: { 'apikey': KEY1 },
    });
    if (!r.ok) throw new Error(`Bucket inaccessible (${r.status})`);
  });

  return results;
};

window.showHealthCheck = async function() {
  const toast = window.toast || window.showToast;
  toast?.('Tests en cours…', 'info');

  const results = await runHealthCheck();
  const ok = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';
  modal.innerHTML = `
    <div style="background:var(--bg-card,#fff);border-radius:20px;padding:2rem;max-width:520px;width:100%;max-height:90vh;overflow-y:auto">
      <h3 style="margin:0 0 .5rem;color:var(--vert,#0C3320)">🩺 Diagnostic système</h3>
      <div style="margin-bottom:1.25rem;display:flex;gap:.75rem">
        <span style="background:#d1fae5;color:#065f46;padding:.35rem .9rem;border-radius:20px;font-weight:700;font-size:.88rem">✅ ${ok} OK</span>
        ${fail ? `<span style="background:#fee2e2;color:#991b1b;padding:.35rem .9rem;border-radius:20px;font-weight:700;font-size:.88rem">❌ ${fail} Erreur(s)</span>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:.4rem">
        ${results.map(r => `
          <div style="display:flex;align-items:flex-start;gap:.75rem;padding:.6rem .75rem;background:${r.ok?'#f0fdf4':'#fef2f2'};border-radius:8px;border-left:3px solid ${r.ok?'#10b981':'#ef4444'}">
            <span style="font-size:.9rem;flex-shrink:0">${r.ok?'✅':'❌'}</span>
            <div style="flex:1">
              <div style="font-size:.85rem;font-weight:600;color:${r.ok?'#065f46':'#991b1b'}">${r.name}</div>
              ${!r.ok ? `<div style="font-size:.75rem;color:#ef4444;margin-top:2px">${r.error}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>
      <div style="margin-top:1.25rem;display:flex;justify-content:flex-end">
        <button class="btn btn-outline btn-sm" onclick="this.closest('[style*=fixed]').remove()">Fermer</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });

  if (fail > 0) {
    await histLog('autre', `Diagnostic: ${fail} erreur(s) détectée(s)`, results.filter(r=>!r.ok).map(r=>r.name).join(', '));
  }
};


/* ══════════════════════════════════════════════════════════
   11. GESTION ERREURS RÉSEAU GLOBALE
══════════════════════════════════════════════════════════ */
(function initNetworkErrorHandling() {
  /* Patcher fetch global pour intercepter les erreurs réseau */
  const _origFetch = window.fetch;
  window.fetch = async function(...args) {
    try {
      const response = await _origFetch(...args);

      /* Détecter les erreurs Supabase courantes et enrichir le message */
      if (!response.ok && response.headers.get('content-type')?.includes('json')) {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        if (url.includes('supabase')) {
          const clone = response.clone();
          clone.json().then(data => {
            const msg = data?.message || data?.error || '';
            if (msg.includes('permission denied') || msg.includes('schema')) {
              console.error('[Supabase RLS] Erreur permission :', msg, '\nURL:', url);
              /* Log dans historique si admin connecté */
              if (sb?.getSession?.()) {
                histLog?.('autre', 'Erreur RLS Supabase', `${msg} | ${url.split('?')[0].split('/').pop()}`);
              }
            }
          }).catch(() => {});
        }
      }
      return response;
    } catch(e) {
      /* Erreur réseau pure (offline, DNS…) */
      if (e.name === 'TypeError' && e.message.includes('fetch')) {
        const banner = document.getElementById('ml-offline-banner');
        if (banner) banner.style.display = 'block';
      }
      throw e;
    }
  };
})();


/* ══════════════════════════════════════════════════════════
   12. LOGS D'ERREURS JS CENTRALISÉS
   Capture les erreurs non gérées et les stocke en base
══════════════════════════════════════════════════════════ */
(function initErrorLogger() {
  /* Erreurs JS non gérées */
  window.addEventListener('error', async (e) => {
    /* Ignorer les erreurs de ressources (images manquantes…) */
    if (e.target && e.target.tagName) return;

    const msg = `${_escSeo(e.message)} (${e.filename?.split('/').pop()}:${e.lineno})`;
    console.error('[ErrorLogger]', msg);

    try {
      if (window.sb && window.histLog && sb.getSession?.()) {
        await histLog('autre', '⚠️ Erreur JS', msg.slice(0, 200));
      }
    } catch { /* silencieux */ }
  });

  /* Promesses rejetées non gérées */
  window.addEventListener('unhandledrejection', async (e) => {
    const reason = e.reason?.message || String(e.reason || 'Promesse rejetée');
    const msg = `Unhandled: ${reason}`;
    console.error('[ErrorLogger]', msg);

    try {
      if (window.sb && window.histLog && sb.getSession?.()) {
        await histLog('autre', '⚠️ Promesse rejetée', msg.slice(0, 200));
      }
    } catch { /* silencieux */ }
  });
})();

/* ══════════════════════════════════════════════════════════
   INJECTION DANS L'ADMIN — Nouveaux panneaux paramètres
══════════════════════════════════════════════════════════ */
/* Enregistrement dans le Registry central (admin-settings.js) */
if (window.ParamRegistry) {
  window.ParamRegistry.register(async () => {
    // Ce module n'a pas de panneau d'état persistant à charger,
    // mais on peut vérifier si les fonctions sont chargées.
  });
}
