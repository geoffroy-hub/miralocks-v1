/* ============================================================
   Miralocks — supabase2.js  Version: 3.0 — SPÉCIAL VIDÉOS
   ⚠️  SECONDE instance Supabase — VIDÉOS UNIQUEMENT
   ─────────────────────────────────────────────────────────────
   Cette instance est distincte de supabase.js (sb).
   Elle gère UNIQUEMENT le bucket vidéo : Miralocks-videos.

   Utilisation :
     - Upload vidéo  → sb2.upload('videos', file)
     - Suppression   → sb2.deleteFile(url)

   ⛔ Ne pas fusionner avec supabase.js
   ⛔ Ne pas déplacer les appels sb2 dans d'autres modules
   ─────────────────────────────────────────────────────────────
   Instance 1 (sb)  → mqityrifhiaarwdcacxo.supabase.co (tout)
   Instance 2 (sb2) → jihpbaeozvksgsipljsb.supabase.co (vidéos)
   ============================================================ */

// REMPLACER PAR VOS VRAIES INFOS DE LA 2ÈME INSTANCE
const SUPABASE2_URL = 'https://jihpbaeozvksgsipljsb.supabase.co';
const SUPABASE2_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppaHBiYWVvenZrc2dzaXBsanNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyOTQ3NzIsImV4cCI6MjA5MDg3MDc3Mn0.UR8k6zRoC3s2FSDvo0wplzXKbmKdV4zMmQHjg6HSS6o';
const SUPABASE2_BUCKET = 'miralocks-videos'; // Nom du bucket sur la 2ème instance (minuscules)

const sb2 = {

  /* ── AUTH ─────────────────────────────────────────────────── */

  /** Connexion sur Supabase 2 avec les mêmes identifiants que Supabase 1 */
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE2_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE2_ANON },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) {
      // Connexion sb2 non bloquante — on log mais on ne throw pas
      console.warn('[sb2] Connexion échouée (non bloquante) :', data.error_description || data.msg);
      return null;
    }
    localStorage.setItem('ml_session_sb2', JSON.stringify({
      token: data.access_token,
      refresh: data.refresh_token,
      expires: Date.now() + data.expires_in * 1000,
    }));
    return data;
  },

  /** Déconnexion de Supabase 2 */
  async signOut() {
    const s = this.getSession();
    if (s) {
      await fetch(`${SUPABASE2_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE2_ANON, 'Authorization': `Bearer ${s.token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('ml_session_sb2');
  },

  /** Session active sur Supabase 2 */
  getSession() {
    try {
      const s = JSON.parse(localStorage.getItem('ml_session_sb2'));
      if (!s || Date.now() > s.expires) return null;
      return s;
    } catch { return null; }
  },

  /** Token à utiliser : session authentifiée ou clé anon en fallback */
  _token() {
    return this.getSession()?.token || SUPABASE2_ANON;
  },

  /* ── CRUD générique — pour gérer la table galerie_videos sur le 2ème projet ── */
  async _get(table, params = '') {
    const r = await fetch(`${SUPABASE2_URL}/rest/v1/${table}?${params}`, {
      headers: {
        'apikey': SUPABASE2_ANON,
        'Authorization': `Bearer ${this._token()}`,
      },
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || `Erreur lecture ${table} (${r.status})`);
    }
    return r.json();
  },

  async _post(table, body) {
    const r = await fetch(`${SUPABASE2_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE2_ANON,
        'Authorization': `Bearer ${this._token()}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || `Erreur création ${table} (${r.status})`);
    }
    const text = await r.text();
    return text ? JSON.parse(text) : [];
  },

  async _patch(table, id, body) {
    const r = await fetch(`${SUPABASE2_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE2_ANON,
        'Authorization': `Bearer ${this._token()}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || `Erreur mise à jour ${table} (${r.status})`);
    }
    const text = await r.text();
    return text ? JSON.parse(text) : [];
  },

  async _delete(table, id) {
    const r = await fetch(`${SUPABASE2_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE2_ANON,
        'Authorization': `Bearer ${this._token()}`,
        'Prefer': 'return=minimal',
      },
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || `Erreur suppression ${table} (${r.status})`);
    }
  },

  /* ── VIDÉOS — Géré sur Supabase 2 ── */
  videos: {
    async list(onlyPublished = true) {
      const filter = onlyPublished ? 'publie=eq.true&' : '';
      return sb2._get('galerie_videos', `${filter}order=created_at.desc`);
    },
    async get(id) {
      const rows = await sb2._get('galerie_videos', `id=eq.${id}`);
      return rows[0] || null;
    },
    async create(data) { return sb2._post('galerie_videos', data); },
    async update(id, data) { return sb2._patch('galerie_videos', id, data); },
    async delete(id) { return sb2._delete('galerie_videos', id); },
    async togglePublish(id, current) {
      return sb2._patch('galerie_videos', id, { publie: !current });
    },
  },

  /* ── STORAGE — upload fichier (dossier galerie, formats vidéo uniquement) ── */
  async upload(folder, file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const name = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const ct = file.type || 'application/octet-stream';

    const r = await fetch(
      `${SUPABASE2_URL}/storage/v1/object/${SUPABASE2_BUCKET}/${name}`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE2_ANON,
          'Authorization': `Bearer ${this._token()}`,
          'Content-Type': ct,
        },
        body: file,
      }
    );

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || e.error || `Upload vidéo échoué (${r.status})`);
    }

    return `${SUPABASE2_URL}/storage/v1/object/public/${SUPABASE2_BUCKET}/${name}`;
  },

  /* ── STORAGE — suppression (token authentifié requis) ── */
  async deleteFile(url) {
    if (!url || !url.includes(SUPABASE2_URL)) return;
    const path = url.split(`/${SUPABASE2_BUCKET}/`)[1];
    if (!path) return;

    await fetch(`${SUPABASE2_URL}/storage/v1/object/${SUPABASE2_BUCKET}/${path}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE2_ANON,
        'Authorization': `Bearer ${this._token()}`,
      },
    }).catch(() => {});
  }
};

/* Exposer globalement */
window.sb2 = sb2;
window.SUPABASE2_URL = SUPABASE2_URL;
window.SUPABASE2_ANON = SUPABASE2_ANON;
