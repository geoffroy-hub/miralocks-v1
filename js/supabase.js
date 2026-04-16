/* ============================================================
   Miralocks — supabase.js  Version: 2.0 
   Gestionnaire centralisé de toutes les API Supabase
   ============================================================ */

const SUPABASE_URL = 'https://mqityrifhiaarwdcacxo.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xaXR5cmlmaGlhYXJ3ZGNhY3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMTYwMDEsImV4cCI6MjA4OTY5MjAwMX0.sYsUB9AWPXrsRDnz8YxEQiZOh7USxP2W_QNrZyU3mpE';
const SUPABASE_BUCKET = 'Miralocks-media';

/* ── SÉCURITÉ : Nettoyage auto en cas de changement de projet ── */
const _projectId = 'mqityrifhiaarwdcacxo';
if (localStorage.getItem('ml_last_pid') !== _projectId) {
  localStorage.removeItem('ml_session');
  localStorage.setItem('ml_last_pid', _projectId);
}

/* ── Client Supabase léger (sans SDK, fetch natif) ─────────── */
const sb = {

  /* headers communs */
  _h(token = null) {
    return {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${token || SUPABASE_ANON}`,
      'Prefer': 'return=representation',
    };
  },

  /* ── Générer un slug unique ──────────────────────────────── */
  _slug(titre) {
    return titre
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // enlever accents
      .replace(/[^a-z0-9\s-]/g, '')
      .trim().replace(/\s+/g, '-')
      + '-' + Date.now().toString(36);
  },

  /* ── Échapper le HTML (sécurité XSS) ─────────────────────── */
  _esc(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, m => map[m]);
  },

  /* ── AUTH ────────────────────────────────────────────────── */
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error_description || data.msg || 'Connexion échouée');
    localStorage.setItem('ml_session', JSON.stringify({
      token: data.access_token,
      refresh: data.refresh_token,
      email,
      expires: Date.now() + data.expires_in * 1000,
    }));
    return data;
  },

  async signOut() {
    const s = this.getSession();
    if (s) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: this._h(s.token),
      }).catch(() => { });
    }
    localStorage.removeItem('ml_session');
  },

  // Retourne la session actuelle (synchrone pour compatibilité UI)
  getSession() {
    try {
      const s = JSON.parse(localStorage.getItem('ml_session'));
      if (!s) return null;
      // Si expiré : ne pas supprimer — getValidSession() tentera le refresh
      // On retourne null pour signaler que le token courant n'est plus utilisable
      if (Date.now() > s.expires) return null;
      return s;
    } catch { return null; }
  },

  // Rafraîchit la session de manière asynchrone (interne)
  async _refresh() {
    try {
      const s = JSON.parse(localStorage.getItem('ml_session'));
      if (!s || !s.refresh) return null;

      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
        body: JSON.stringify({ refresh_token: s.refresh }),
      });

      if (!r.ok) throw new Error('Refresh failed');
      const data = await r.json();

      const newSession = {
        token: data.access_token,
        refresh: data.refresh_token,
        email: data.user?.email || s.email,
        expires: Date.now() + (data.expires_in * 1000),
      };
      localStorage.setItem('ml_session', JSON.stringify(newSession));
      return newSession;
    } catch (e) {
      localStorage.removeItem('ml_session');
      return null;
    }
  },

  // Récupère une session valide, rafraîchit si nécessaire (async)
  async getValidSession() {
    const s = this.getSession();
    if (s) {
      // Si la session expire dans moins de 5 minutes, on rafraîchit préventivement
      if (s.expires - Date.now() < 300000) return await this._refresh();
      return s;
    }
    // Si déjà expiré mais qu'on a un refresh token en local
    const local = JSON.parse(localStorage.getItem('ml_session') || '{}');
    if (local.refresh) return await this._refresh();
    return null;
  },

  isAdmin() { return !!this.getSession(); },

  /* ── STORAGE — upload fichier ────────────────────────────── */
  async upload(folder, file) {
    const s = await sb.getValidSession();
    if (!s) throw new Error('Non authentifié');
    const ext = file.name.split('.').pop().toLowerCase();
    const name = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    // Content-Type correct selon le type de fichier
    const ct = file.type || 'application/octet-stream';
    const r = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${name}`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${s.token}`,
          'Content-Type': ct,
          'Cache-Control': '3600',
        },
        body: file,
      }
    );
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || e.error || `Upload échoué (${r.status})`);
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${name}`;
  },

  /* ── STORAGE — upload public (sans session) ─────────── */
  async publicUpload(folder, file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const name = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const ct = file.type || 'application/octet-stream';
    const r = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${name}`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'Content-Type': ct,
        },
        body: file,
      }
    );
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || e.error || `Upload échoué (${r.status})`);
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${name}`;
  },

  async deleteFile(url) {
    const s = await sb.getValidSession();
    if (!s) return;
    const path = url.split(`/${SUPABASE_BUCKET}/`)[1];
    if (!path) return;
    await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${s.token}` },
    }).catch(() => { });
  },

  /* ── STORAGE — Admin Upload (avec session) ─────────── */
  storage: {
    async upload(file, path) {
      const s = await sb.getValidSession();
      if (!s) throw new Error("Session administrateur requise");
      
      const ct = file.type || 'application/octet-stream';
      const r = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON,
            'Authorization': `Bearer ${s.token}`,
            'Content-Type': ct,
            'x-upsert': 'true',
          },
          body: file,
        }
      );
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.message || e.error || `Upload échoué (${r.status})`);
      }
      return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
    },
 
    async delete(url) {
      return sb.deleteFile(url);
    }
  },
 
  /* ── CRUD générique ──────────────────────────────────────── */
  async _get(table, params = '') {
    const s = await sb.getValidSession();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${s?.token || SUPABASE_ANON}`,
      },
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || `Erreur lecture ${table} (${r.status})`);
    }
    return r.json();
  },

  async _post(table, body) {
    const s = await sb.getValidSession();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: sb._h(s?.token),
      body: JSON.stringify(body),
    });
    // Supabase peut renvoyer 201 (Created) ou 200
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || e.details || `Erreur création ${table} (${r.status})`);
    }
    // 201 peut avoir un body vide ou un tableau
    const text = await r.text();
    return text ? JSON.parse(text) : [];
  },

  async _patch(table, id, body) {
    const s = await sb.getValidSession();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: sb._h(s?.token),
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || e.details || `Erreur mise à jour ${table} (${r.status})`);
    }
    const text = await r.text();
    return text ? JSON.parse(text) : [];
  },

  async _delete(table, id) {
    const s = await sb.getValidSession();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${s?.token || SUPABASE_ANON}`,
        'Prefer': 'return=minimal',
      },
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || `Erreur suppression ${table} (${r.status})`);
    }
  },

  /* ══════════════════════════════════════════════════════════
     BLOG
     Table: blog_posts
     Colonnes: id, titre, extrait, contenu, photo_url,
               categorie, slug, publie, created_at
  ══════════════════════════════════════════════════════════ */
  blog: {
    async list(onlyPublished = true) {
      const filter = onlyPublished ? 'publie=eq.true&' : '';
      return sb._get('blog_posts', `${filter}order=created_at.desc`);
    },
    async get(id) {
      const rows = await sb._get('blog_posts', `id=eq.${id}`);
      return rows[0] || null;
    },
    async create(data) {
      // Générer le slug automatiquement si absent
      if (!data.slug) data.slug = sb._slug(data.titre || 'article');
      return sb._post('blog_posts', data);
    },
    async update(id, data) {
      // Mettre à jour le slug si le titre a changé et qu'aucun slug n'est fourni
      if (data.titre && !data.slug) data.slug = sb._slug(data.titre);
      return sb._patch('blog_posts', id, data);
    },
    async delete(id, photoUrl) {
      if (photoUrl) await sb.deleteFile(photoUrl).catch(() => { });
      return sb._delete('blog_posts', id);
    },
    async togglePublish(id, current) {
      return sb._patch('blog_posts', id, { publie: !current });
    },
  },

  /* ══════════════════════════════════════════════════════════
     GALERIE PHOTOS
     Table: galerie_photos
     Colonnes: id, titre, description, photo_url,
               categorie, ordre, publie, created_at
  ══════════════════════════════════════════════════════════ */
  galerie: {
    async list(onlyPublished = true) {
      const filter = onlyPublished ? 'publie=eq.true&' : '';
      return sb._get('galerie_photos', `${filter}order=ordre.asc,created_at.desc`);
    },
    async create(data) { return sb._post('galerie_photos', data); },
    async update(id, data) { return sb._patch('galerie_photos', id, data); },
    async delete(id, photoUrl) {
      if (photoUrl) await sb.deleteFile(photoUrl).catch(() => { });
      return sb._delete('galerie_photos', id);
    },
    async togglePublish(id, current) {
      return sb._patch('galerie_photos', id, { publie: !current });
    },
  },


  /* ══════════════════════════════════════════════════════════
     AVIS CLIENTS
     Table: avis_clients
     Colonnes: id, nom, localite, etoiles (1-5),
               texte, approuve, created_at
  ══════════════════════════════════════════════════════════ */
  avis: {
    async list(onlyApproved = true) {
      const filter = onlyApproved ? 'approuve=eq.true&' : '';
      return sb._get('avis_clients', `${filter}order=created_at.desc`);
    },
    // INSERT public (sans token admin) — RLS doit autoriser INSERT pour anon
    async create(data) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/avis_clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ ...data, approuve: false }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.message || e.details || `Erreur envoi avis (${r.status})`);
      }
    },
    async approve(id) { return sb._patch('avis_clients', id, { approuve: true }); },
    async reject(id) { return sb._delete('avis_clients', id); },
    async delete(id) { return sb._delete('avis_clients', id); },
  },

  /* ══════════════════════════════════════════════════════════
     PARAMÈTRES SITE
     Table: site_settings
     Colonnes: id (text PK), valeur (text), updated_at
  ══════════════════════════════════════════════════════════ */
  settings: {
    async get(key) {
      const rows = await sb._get('site_settings', `id=eq.${encodeURIComponent(key)}`);
      return rows[0]?.valeur || null;
    },
    async set(key, valeur) {
      const s = await sb.getValidSession();
      const r = await fetch(`${SUPABASE_URL}/rest/v1/site_settings`, {
        method: 'POST',
        headers: {
          ...sb._h(s?.token),
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({ id: key, valeur, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'Erreur sauvegarde'); }
      const text = await r.text();
      return text ? JSON.parse(text) : [];
    },
    async delete(key) {
      const s = await sb.getValidSession();
      await fetch(`${SUPABASE_URL}/rest/v1/site_settings?id=eq.${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${s?.token}`, 'Prefer': 'return=minimal' },
      });
    },
    async getAll() {
      return sb._get('site_settings', '');
    },
  },
};

/* Exposer globalement */
window.sb = sb;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON = SUPABASE_ANON;

/* ── Appel d'une Edge Function ──────────────────────────── */
sb.invoke = async function (fnName, body = {}) {
  const s = await sb.getValidSession();
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${s?.token || SUPABASE_ANON}`,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.message || e.error || `Edge function error (${r.status})`);
  }
  const text = await r.text();
  return text ? JSON.parse(text) : {};
};


/* ══════════════════════════════════════════════════════════
   RENDEZ-VOUS
   Table: rendezvous
   Colonnes: id, nom, tel, email, service, date_rdv, heure,
             message, statut, note_admin, photo_url, created_at
   Statuts: 'en_attente' | 'confirme' | 'annule' | 'termine'
══════════════════════════════════════════════════════════ */
sb.rdv = {
  /* Soumission publique (sans token) */
  async create(data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rendezvous`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        ...data,
        statut: 'en_attente',
        created_at: new Date().toISOString()
      }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || e.details || `Erreur envoi RDV (${r.status})`);
    }
  },

  /* Liste admin (par statut optionnel, trié par date) */
  async list(statut = null) {
    const filter = statut ? `statut=eq.${statut}&` : '';
    return sb._get('rendezvous', `${filter}order=date_rdv.asc,heure.asc`);
  },

  /* Récupérer un RDV par id */
  async get(id) {
    const rows = await sb._get('rendezvous', `id=eq.${id}`);
    return rows[0] || null;
  },

  /* Changer le statut */
  async setStatut(id, statut) {
    return sb._patch('rendezvous', id, { statut });
  },

  /* Ajouter/modifier une note admin */
  async setNote(id, note_admin) {
    return sb._patch('rendezvous', id, { note_admin });
  },

  /* Supprimer */
  async delete(id) {
    return sb._delete('rendezvous', id);
  },

  /* Comptage par statut (pour le dashboard) */
  async counts() {
    const all = await sb._get('rendezvous', 'select=statut');
    return all.reduce((acc, r) => {
      acc[r.statut] = (acc[r.statut] || 0) + 1;
      acc.total = (acc.total || 0) + 1;
      return acc;
    }, { en_attente: 0, confirme: 0, annule: 0, termine: 0, total: 0 });
  },
};

/* ── SERVICES / PRESTATIONS ──────────────────────────────── */
sb.services = {
  async list(onlyActive = true) {
    const filter = onlyActive ? 'actif=eq.true&' : '';
    return sb._get('services', `${filter}order=ordre.asc,nom.asc`);
  },
  async create(data) {
    return sb._post('services', data);
  },
  async update(id, data) {
    return sb._patch('services', id, data);
  },
  async delete(id) {
    return sb._delete('services', id);
  }
};

/* ── VISITES ─────────────────────────────────────────────── */
sb.visites = {

  /* Enregistrer une visite (appelé depuis chaque page publique) */
  async track() {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/visites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          page: window.location.protocol === 'file:' 
                ? '/' + window.location.pathname.split('/').pop() 
                : window.location.pathname,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
        }),
      });
    } catch (e) { /* silencieux */ }
  },

  /* Stats pour le dashboard admin */
  async stats() {
    const s = await sb.getValidSession();
    const headers = {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${s?.token || SUPABASE_ANON}`,
    };

    const now = new Date();

    /* Utiliser l'heure locale pour les calculs de dates, puis convertir proprement */
    const pad = n => String(n).padStart(2, '0');
    /* Formate une date locale en ISO (sans timezone, pour comparaison locale) */
    const fmtLocal = d => {
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T00:00:00`;
    };

    /* Aujourd'hui minuit heure locale */
    const todayStart = new Date(now);
    /* Début de la semaine (lundi) heure locale */
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
    /* Début du mois heure locale */
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const fmt = d => fmtLocal(d);

    const [rDay, rWeek, rMonth, rTotal, rPages] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/visites?select=id&created_at=gte.${fmt(todayStart)}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/visites?select=id&created_at=gte.${fmt(weekStart)}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/visites?select=id&created_at=gte.${fmt(monthStart)}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/visites?select=id`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/visites?select=page&created_at=gte.${fmt(monthStart)}&order=created_at.desc`, { headers }),
    ]);

    const [day_, week_, month_, total_, pages_] = await Promise.all([
      rDay.json(), rWeek.json(), rMonth.json(), rTotal.json(), rPages.json(),
    ]);

    /* Top pages du mois */
    const pageCount = {};
    (Array.isArray(pages_) ? pages_ : []).forEach(v => {
      let p = v.page || '/';
      // Nettoyage des historiques locaux et unification
      if (p.includes(':/')) p = '/' + p.split('/').pop();
      if (p === '/index.html') p = '/';
      
      pageCount[p] = (pageCount[p] || 0) + 1;
    });
    const topPages = Object.entries(pageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      jour: Array.isArray(day_) ? day_.length : 0,
      semaine: Array.isArray(week_) ? week_.length : 0,
      mois: Array.isArray(month_) ? month_.length : 0,
      total: Array.isArray(total_) ? total_.length : 0,
      topPages,
    };
  },
};

/* Visites par jour sur N jours (pour le graphique) */
sb.visites.byDay = async function (days = 30) {
  const s = await sb.getValidSession();
  const headers = {
    'apikey': SUPABASE_ANON,
    'Authorization': `Bearer ${s?.token || SUPABASE_ANON}`,
  };
  const since = new Date();
  since.setDate(since.getDate() - days);

  /* Formate en YYYY-MM-DD selon l'heure locale */
  const localKey = d => {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };
  const sinceISO = `${localKey(since)}T00:00:00`;

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/visites?select=created_at&created_at=gte.${sinceISO}&order=created_at.asc`,
    { headers }
  );
  const rows = await r.json();

  /* Construire un tableau jour par jour en heure locale */
  const map = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    map[localKey(d)] = 0;
  }
  (Array.isArray(rows) ? rows : []).forEach(v => {
    /* Convertir created_at UTC → heure locale pour grouper correctement */
    const d = new Date(v.created_at);
    const key = localKey(d);
    if (key in map) map[key]++;
  });

  return {
    labels: Object.keys(map).map(k => {
      const d = new Date(k + 'T12:00:00');
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    }),
    data: Object.values(map),
  };
};


/* ══════════════════════════════════════════════════════════
   HISTLOG — Journal d'événements admin
   Défini ici (supabase.js) pour être disponible globalement
   AVANT admin.js, admin-rdv.js et tous les autres modules.
   Table : historique (type, message, detail, created_at)
══════════════════════════════════════════════════════════ */
async function histLog(type, message, detail = '') {
  try {
    /* getValidSession() rafraîchit le token si nécessaire */
    await sb.getValidSession();
    await sb._post('historique', { type, message, detail });
  } catch (e) {
    console.warn('[histLog] Erreur :', e.message);
  }
}

/* Exposer globalement pour tous les modules admin */
window.histLog = histLog;
window.escHtml = sb._esc;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON = SUPABASE_ANON;
