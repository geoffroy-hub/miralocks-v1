/* ============================================================
   Miralocks Admin — admin-monetisation.js  v1.0
   Nouvelles fonctionnalités monétisation & croissance :
   1.  Bons cadeaux numériques (achat + PDF + validation)
   2.  Packs de séances prépayés
   3.  Programme de parrainage
   ============================================================ */

'use strict';

/* ══════════════════════════════════════════════════════════
   HELPERS COMMUNS
══════════════════════════════════════════════════════════ */

function _t() { return window.toast || window.showToast || (() => {}); }
function _esc(s) { if (!s) return ''; const m={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}; return String(s).replace(/[&<>"']/g,c=>m[c]); }

/* Génère un code alphanumérique unique (8 chars) */
function genCode(prefix = 'MRL') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  arr.forEach(b => { r += chars[b % chars.length]; });
  return prefix + r.slice(0, 5);
}

/* Formate un montant FCFA */
function fcfa(n) { return Number(n).toLocaleString('fr-TG') + ' FCFA'; }


/* ══════════════════════════════════════════════════════════
   1. BONS CADEAUX
══════════════════════════════════════════════════════════ */
window.BonsCadeaux = {

  /* Récupérer la config des montants depuis site_settings */
  async getMontants() {
    try {
      const raw = await sb.settings.get('bon_cadeau_montants');
      return raw ? JSON.parse(raw) : [5000, 10000, 15000, 20000, 30000];
    } catch { return [5000, 10000, 15000, 20000, 30000]; }
  },

  /* Créer un bon cadeau en base */
  async create(data) {
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1);
    const bon = {
      code: genCode('BON'),
      montant: data.montant,
      acheteur_nom: data.acheteur_nom,
      acheteur_email: data.acheteur_email,
      acheteur_tel: data.acheteur_tel || null,
      destinataire: data.destinataire || null,
      message: data.message || null,
      statut: 'actif',
      expires_at: expires.toISOString().slice(0, 10),
      transaction_id: data.transaction_id || null,
    };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bons_cadeaux`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'apikey':SUPABASE_ANON,
                 'Authorization':`Bearer ${SUPABASE_ANON}`, 'Prefer':'return=representation' },
      body: JSON.stringify(bon),
    });
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.message || 'Erreur création bon'); }
    const rows = await r.json();
    return rows[0] || bon;
  },

  /* Lister tous les bons (admin) */
  async list() {
    const s = await sb.getValidSession();
    if (!s) return [];
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bons_cadeaux?order=created_at.desc&limit=200`, {
      headers: sb._h(s.token),
    });
    return r.ok ? r.json() : [];
  },

  /* Valider un bon lors d'un RDV */
  async utiliser(code, rdvId) {
    const s = await sb.getValidSession();
    if (!s) throw new Error('Non authentifié');
    /* Vérifier le bon */
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/bons_cadeaux?code=eq.${encodeURIComponent(code)}&statut=eq.actif`,
      { headers: sb._h(s.token) }
    );
    const rows = await r.json();
    if (!rows?.length) throw new Error('Bon introuvable ou déjà utilisé');
    const bon = rows[0];
    if (new Date(bon.expires_at) < new Date()) throw new Error('Bon cadeau expiré');
    /* Marquer comme utilisé */
    await fetch(`${SUPABASE_URL}/rest/v1/bons_cadeaux?id=eq.${bon.id}`, {
      method: 'PATCH',
      headers: { ...sb._h(s.token), 'Prefer':'return=minimal' },
      body: JSON.stringify({ statut:'utilise', rdv_id:rdvId, used_at:new Date().toISOString() }),
    });
    return bon;
  },

  /* Générer le PDF du bon cadeau (HTML → print) */
  genererPDF(bon) {
    const win = window.open('', '_blank');
    if (!win) { _t()('Autorisez les popups', 'error'); return; }
    const expiry = new Date(bon.expires_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric'});
    const dest = bon.destinataire ? `<p style="font-size:1.1rem;color:#555">Pour : <strong>${_esc(bon.destinataire)}</strong></p>` : '';
    const msg  = bon.message ? `<blockquote style="border-left:3px solid #C9A84C;padding:.5rem 1rem;color:#555;font-style:italic;margin:1rem 0">${_esc(bon.message)}</blockquote>` : '';
    win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<title>Bon cadeau Miralocks — ${bon.code}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f8f5ef;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:2rem}
.card{background:#fff;border-radius:20px;padding:2.5rem;max-width:520px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.12);text-align:center;border:2px solid #C9A84C}
.header{background:linear-gradient(135deg,#0C3320,#1a5c38);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem}
.logo{color:#C9A84C;font-size:1.6rem;font-weight:800;letter-spacing:.03em}
.sub{color:rgba(201,168,76,.7);font-size:.85rem;margin-top:.2rem}
.montant{font-size:3rem;font-weight:800;color:#0C3320;margin:1rem 0 .3rem}
.montant-label{font-size:.8rem;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:1.25rem}
.code-box{background:#f8f5ef;border:2px dashed #C9A84C;border-radius:10px;padding:.9rem 1.5rem;margin:1.25rem 0;display:inline-block}
.code{font-family:monospace;font-size:1.5rem;font-weight:700;letter-spacing:.15em;color:#0C3320}
.validity{font-size:.78rem;color:#888;margin-top:1rem}
.footer{margin-top:1.5rem;font-size:.72rem;color:#aaa}
@media print{body{background:#fff;padding:0}.card{box-shadow:none;border:2px solid #C9A84C}}
</style></head><body>
<div class="card">
  <div class="header">
    <div class="logo">🌿 MiraLocks</div>
    <div class="sub">Institut capillaire — Lomé, Togo</div>
  </div>
  <p style="color:#888;font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.5rem">Bon cadeau</p>
  <div class="montant">${fcfa(bon.montant)}</div>
  <div class="montant-label">à valoir sur toute prestation</div>
  ${dest}
  ${msg}
  <div class="code-box">
    <div style="font-size:.7rem;color:#888;margin-bottom:.3rem;text-transform:uppercase;letter-spacing:.06em">Code unique</div>
    <div class="code">${_esc(bon.code)}</div>
  </div>
  <p class="validity">Valable jusqu'au <strong>${expiry}</strong></p>
  <p style="font-size:.78rem;color:#aaa;margin-top:.5rem">À présenter lors de votre prochain rendez-vous chez MiraLocks</p>
  <div class="footer">mira-lecks.vercel.app · +228 97 98 90 01 · Agoè Cacaveli, Lomé</div>
</div>
<script>window.print();<\/script>
</body></html>`);
    win.document.close();
  },

  /* Rendu du panel admin */
  async renderPanel(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<p style="color:var(--gris-d)"><i class="fas fa-spinner fa-spin"></i> Chargement…</p>';
    try {
      const bons = await this.list();
      const actifs   = bons.filter(b => b.statut === 'actif').length;
      const utilises = bons.filter(b => b.statut === 'utilise').length;
      const total_ca = bons.filter(b => b.statut === 'utilise').reduce((s,b) => s+b.montant, 0);

      el.innerHTML = `
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:1.5rem">
  <div class="dash-card"><div class="dash-card-icon">🎁</div><div class="dash-card-num">${actifs}</div><div class="dash-card-label">Bons actifs</div></div>
  <div class="dash-card"><div class="dash-card-icon">✅</div><div class="dash-card-num">${utilises}</div><div class="dash-card-label">Utilisés</div></div>
  <div class="dash-card"><div class="dash-card-icon">💰</div><div class="dash-card-num">${fcfa(total_ca)}</div><div class="dash-card-label">CA généré</div></div>
</div>
<div style="display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap">
  <button class="btn btn-primary btn-sm" onclick="BonsCadeaux.openCreerModal()"><i class="fas fa-plus"></i> Créer un bon cadeau</button>
  <button class="btn btn-outline btn-sm" onclick="BonsCadeaux.openValiderModal()"><i class="fas fa-check-circle"></i> Valider un bon</button>
</div>
<div style="overflow-x:auto">
<table class="admin-table">
  <thead><tr><th>Code</th><th>Montant</th><th>Acheteur</th><th>Destinataire</th><th>Statut</th><th>Expire</th><th>Actions</th></tr></thead>
  <tbody>
    ${bons.slice(0,50).map(b => `
    <tr>
      <td><code style="font-size:.82rem;letter-spacing:.05em">${_esc(b.code)}</code></td>
      <td><strong>${fcfa(b.montant)}</strong></td>
      <td>${_esc(b.acheteur_nom)}<br><small style="color:var(--gris-d)">${_esc(b.acheteur_email)}</small></td>
      <td>${_esc(b.destinataire || '—')}</td>
      <td><span class="badge badge-${b.statut==='actif'?'success':b.statut==='utilise'?'info':'warning'}">${b.statut}</span></td>
      <td style="font-size:.82rem">${new Date(b.expires_at).toLocaleDateString('fr-FR')}</td>
      <td class="table-actions">
        <button class="btn btn-sm btn-outline" onclick="BonsCadeaux.genererPDF(${JSON.stringify(b).replace(/"/g,'&quot;')})"><i class="fas fa-print"></i></button>
      </td>
    </tr>`).join('')}
    ${bons.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:var(--gris-d);padding:2rem">Aucun bon cadeau pour l\'instant</td></tr>' : ''}
  </tbody>
</table>
</div>`;
    } catch(e) {
      el.innerHTML = `<p style="color:var(--danger)">Erreur : ${_esc(e.message)}</p>`;
    }
  },

  openCreerModal() {
    const montants = [5000, 10000, 15000, 20000, 30000];
    const opts = montants.map(m => `<option value="${m}">${fcfa(m)}</option>`).join('');
    const html = `
<div id="modal-bon-creer" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem">
<div style="background:var(--bg-card,#fff);border-radius:16px;padding:1.75rem;max-width:440px;width:100%;max-height:90vh;overflow-y:auto">
  <h3 style="margin:0 0 1.25rem;font-size:1.05rem"><i class="fas fa-gift" style="color:var(--or,#C9A84C);margin-right:.4rem"></i>Créer un bon cadeau</h3>
  <div class="form-group"><label class="form-label">Montant</label>
    <select id="bc-montant" class="form-control">${opts}<option value="custom">Montant personnalisé…</option></select>
  </div>
  <div class="form-group" id="bc-custom-grp" style="display:none"><label class="form-label">Montant (FCFA)</label>
    <input type="number" id="bc-montant-custom" class="form-control" min="1000" step="500" placeholder="Ex: 12000">
  </div>
  <div class="form-group"><label class="form-label">Nom de l'acheteur *</label>
    <input type="text" id="bc-acheteur-nom" class="form-control" placeholder="Kofi Mensah">
  </div>
  <div class="form-group"><label class="form-label">Email de l'acheteur *</label>
    <input type="email" id="bc-acheteur-email" class="form-control" placeholder="kofi@email.com">
  </div>
  <div class="form-group"><label class="form-label">Prénom du bénéficiaire</label>
    <input type="text" id="bc-destinataire" class="form-control" placeholder="Pour Ama…">
  </div>
  <div class="form-group"><label class="form-label">Message personnalisé</label>
    <textarea id="bc-message" class="form-control" rows="2" placeholder="Bonne fête…"></textarea>
  </div>
  <div style="display:flex;gap:.5rem;margin-top:1.25rem">
    <button class="btn btn-primary" style="flex:1" onclick="BonsCadeaux._submitCreer()"><i class="fas fa-check"></i> Créer & imprimer</button>
    <button class="btn btn-outline" onclick="document.getElementById('modal-bon-creer').remove()">Annuler</button>
  </div>
</div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('bc-montant').addEventListener('change', function() {
      document.getElementById('bc-custom-grp').style.display = this.value === 'custom' ? '' : 'none';
    });
  },

  async _submitCreer() {
    const sel = document.getElementById('bc-montant').value;
    const montant = sel === 'custom'
      ? parseInt(document.getElementById('bc-montant-custom').value)
      : parseInt(sel);
    const nom = document.getElementById('bc-acheteur-nom').value.trim();
    const email = document.getElementById('bc-acheteur-email').value.trim();
    if (!montant || montant < 1000) { _t()('Montant invalide (min 1000 FCFA)', 'error'); return; }
    if (!nom) { _t()('Nom obligatoire', 'error'); return; }
    if (!email || !email.includes('@')) { _t()('Email invalide', 'error'); return; }
    const btn = document.querySelector('#modal-bon-creer .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création…'; }
    try {
      const bon = await this.create({
        montant, acheteur_nom: nom, acheteur_email: email,
        destinataire: document.getElementById('bc-destinataire').value.trim() || null,
        message: document.getElementById('bc-message').value.trim() || null,
      });
      document.getElementById('modal-bon-creer')?.remove();
      _t()(`Bon ${bon.code} créé !`, 'success');
      this.genererPDF(bon);
      await histLog?.('autre', 'Bon cadeau créé', `${bon.code} — ${fcfa(bon.montant)} pour ${nom}`);
      /* Rafraîchir le panel si visible */
      if (document.getElementById('bons-panel')) await this.renderPanel('bons-panel');
    } catch(e) {
      _t()('Erreur : ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Créer & imprimer'; }
    }
  },

  openValiderModal() {
    const html = `
<div id="modal-bon-valider" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem">
<div style="background:var(--bg-card,#fff);border-radius:16px;padding:1.75rem;max-width:380px;width:100%">
  <h3 style="margin:0 0 1.25rem;font-size:1.05rem"><i class="fas fa-check-circle" style="color:var(--vert,#0C3320);margin-right:.4rem"></i>Valider un bon cadeau</h3>
  <div class="form-group"><label class="form-label">Code du bon</label>
    <input type="text" id="bv-code" class="form-control" placeholder="BONXXXXX" style="text-transform:uppercase;letter-spacing:.08em">
  </div>
  <div class="form-group"><label class="form-label">ID du RDV (optionnel)</label>
    <input type="number" id="bv-rdv-id" class="form-control" placeholder="Laissez vide si pas de RDV lié">
  </div>
  <div id="bv-result" style="min-height:1.5rem;font-size:.85rem;margin:.5rem 0"></div>
  <div style="display:flex;gap:.5rem;margin-top:1rem">
    <button class="btn btn-primary" style="flex:1" onclick="BonsCadeaux._submitValider()"><i class="fas fa-check"></i> Valider</button>
    <button class="btn btn-outline" onclick="document.getElementById('modal-bon-valider').remove()">Fermer</button>
  </div>
</div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('bv-code').addEventListener('input', function() {
      this.value = this.value.toUpperCase();
    });
  },

  async _submitValider() {
    const code = document.getElementById('bv-code').value.trim().toUpperCase();
    const rdvId = document.getElementById('bv-rdv-id').value.trim() || null;
    const res = document.getElementById('bv-result');
    if (!code) { res.innerHTML = '<span style="color:var(--danger)">Entrez un code</span>'; return; }
    const btn = document.querySelector('#modal-bon-valider .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    try {
      const bon = await this.utiliser(code, rdvId ? parseInt(rdvId) : null);
      res.innerHTML = `<span style="color:var(--success)"><i class="fas fa-check-circle"></i> Bon validé — ${fcfa(bon.montant)} déduits</span>`;
      _t()(`Bon ${code} utilisé avec succès`, 'success');
      await histLog?.('paiement', 'Bon cadeau validé', `${code} — ${fcfa(bon.montant)}`);
      if (document.getElementById('bons-panel')) await this.renderPanel('bons-panel');
    } catch(e) {
      res.innerHTML = `<span style="color:var(--danger)"><i class="fas fa-times-circle"></i> ${_esc(e.message)}</span>`;
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Valider'; }
    }
  },
};


/* ══════════════════════════════════════════════════════════
   2. PACKS DE SÉANCES
══════════════════════════════════════════════════════════ */
window.PacksSeances = {

  async getConfig() {
    try {
      const raw = await sb.settings.get('packs_config');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  async list() {
    const s = await sb.getValidSession();
    if (!s) return [];
    const r = await fetch(`${SUPABASE_URL}/rest/v1/packs_seances?order=created_at.desc&limit=200`, {
      headers: sb._h(s.token),
    });
    return r.ok ? r.json() : [];
  },

  async getByTel(tel) {
    const s = await sb.getValidSession();
    if (!s) return [];
    const clean = tel.replace(/\D/g, '');
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/packs_seances?client_tel=eq.${encodeURIComponent(clean)}&statut=eq.actif&order=created_at.desc`,
      { headers: sb._h(s.token) }
    );
    return r.ok ? r.json() : [];
  },

  async utiliserSeance(packId) {
    const s = await sb.getValidSession();
    if (!s) throw new Error('Non authentifié');
    const r = await fetch(`${SUPABASE_URL}/rest/v1/packs_seances?id=eq.${packId}&statut=eq.actif`,
      { headers: sb._h(s.token) });
    const rows = await r.json();
    if (!rows?.length) throw new Error('Pack introuvable ou inactif');
    const pack = rows[0];
    const restant = pack.seances_restantes - 1;
    await fetch(`${SUPABASE_URL}/rest/v1/packs_seances?id=eq.${packId}`, {
      method: 'PATCH',
      headers: { ...sb._h(s.token), 'Prefer':'return=minimal' },
      body: JSON.stringify({
        seances_restantes: restant,
        statut: restant <= 0 ? 'epuise' : 'actif',
      }),
    });
    return { ...pack, seances_restantes: restant };
  },

  async acheter(data) {
    const clean = (data.client_tel || '').replace(/\D/g, '');
    const pack = {
      client_nom: data.client_nom,
      client_tel: clean,
      client_email: data.client_email || null,
      type_pack: data.type_pack,
      label_pack: data.label_pack,
      prix_pack: data.prix_pack,
      seances_total: data.seances_total,
      seances_restantes: data.seances_total,
      transaction_id: data.transaction_id || null,
      statut: 'actif',
    };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/packs_seances`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'apikey':SUPABASE_ANON,
                 'Authorization':`Bearer ${SUPABASE_ANON}`, 'Prefer':'return=representation' },
      body: JSON.stringify(pack),
    });
    if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.message || 'Erreur création pack'); }
    const rows = await r.json();
    return rows[0] || pack;
  },

  async renderPanel(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<p style="color:var(--gris-d)"><i class="fas fa-spinner fa-spin"></i> Chargement…</p>';
    try {
      const [packs, config] = await Promise.all([this.list(), this.getConfig()]);
      const actifs  = packs.filter(p => p.statut === 'actif').length;
      const epuises = packs.filter(p => p.statut === 'epuise').length;
      const seances_consommees = packs.reduce((s,p) => s + (p.seances_total - p.seances_restantes), 0);

      el.innerHTML = `
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:1.5rem">
  <div class="dash-card"><div class="dash-card-icon">📦</div><div class="dash-card-num">${actifs}</div><div class="dash-card-label">Packs actifs</div></div>
  <div class="dash-card"><div class="dash-card-icon">🎯</div><div class="dash-card-num">${seances_consommees}</div><div class="dash-card-label">Séances utilisées</div></div>
  <div class="dash-card"><div class="dash-card-icon">✅</div><div class="dash-card-num">${epuises}</div><div class="dash-card-label">Packs épuisés</div></div>
</div>
<div style="margin-bottom:1rem">
  <button class="btn btn-primary btn-sm" onclick="PacksSeances.openAcheterModal()"><i class="fas fa-plus"></i> Enregistrer un achat</button>
</div>
<h4 style="font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;color:var(--gris-d);margin-bottom:.75rem">Offres disponibles</h4>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:1.5rem">
  ${config.map(c => `
  <div style="background:var(--bg-card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px;padding:1rem;position:relative">
    <div style="font-weight:700;font-size:.95rem">${_esc(c.label)}</div>
    <div style="font-size:.85rem;color:var(--gris-d);margin:.2rem 0">${c.seances} séances incluses</div>
    <div style="font-size:1.2rem;font-weight:800;color:var(--vert,#0C3320)">${fcfa(c.prix)}</div>
    ${c.economie ? `<div style="font-size:.75rem;color:var(--or,#C9A84C)">Économie ${c.economie}%</div>` : ''}
  </div>`).join('')}
</div>
<h4 style="font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;color:var(--gris-d);margin-bottom:.75rem">Clients ayant un pack</h4>
<div style="overflow-x:auto">
<table class="admin-table">
  <thead><tr><th>Client</th><th>Pack</th><th>Restant</th><th>Statut</th><th>Actions</th></tr></thead>
  <tbody>
    ${packs.slice(0,30).map(p => `
    <tr>
      <td>${_esc(p.client_nom)}<br><small style="color:var(--gris-d)">${_esc(p.client_tel)}</small></td>
      <td>${_esc(p.label_pack)}</td>
      <td>
        <strong>${p.seances_restantes}</strong>/<span style="color:var(--gris-d)">${p.seances_total}</span>
        <div style="background:var(--border,#e5e7eb);border-radius:4px;height:6px;margin-top:4px">
          <div style="background:var(--or,#C9A84C);height:6px;border-radius:4px;width:${Math.round(p.seances_restantes/p.seances_total*100)}%"></div>
        </div>
      </td>
      <td><span class="badge badge-${p.statut==='actif'?'success':p.statut==='epuise'?'warning':'info'}">${p.statut}</span></td>
      <td class="table-actions">
        ${p.statut === 'actif' ? `<button class="btn btn-sm btn-outline" onclick="PacksSeances._deduireSeance(${p.id})"><i class="fas fa-minus-circle"></i> -1 séance</button>` : ''}
      </td>
    </tr>`).join('')}
    ${packs.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--gris-d);padding:2rem">Aucun pack enregistré</td></tr>' : ''}
  </tbody>
</table>
</div>`;
    } catch(e) {
      el.innerHTML = `<p style="color:var(--danger)">Erreur : ${_esc(e.message)}</p>`;
    }
  },

  async _deduireSeance(packId) {
    if (!confirm('Déduire 1 séance de ce pack ?')) return;
    try {
      const updated = await this.utiliserSeance(packId);
      _t()(`Séance déduite — ${updated.seances_restantes} restante(s)`, 'success');
      await histLog?.('rdv', 'Séance pack utilisée', `Pack #${packId} — ${updated.seances_restantes} restante(s)`);
      if (document.getElementById('packs-panel')) await this.renderPanel('packs-panel');
    } catch(e) { _t()('Erreur : ' + e.message, 'error'); }
  },

  async openAcheterModal() {
    const config = await this.getConfig();
    const opts = config.map(c => `<option value="${_esc(c.id)}" data-seances="${c.seances}" data-prix="${c.prix}">${_esc(c.label)} — ${fcfa(c.prix)}</option>`).join('');
    const html = `
<div id="modal-pack-achat" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem">
<div style="background:var(--bg-card,#fff);border-radius:16px;padding:1.75rem;max-width:420px;width:100%;max-height:90vh;overflow-y:auto">
  <h3 style="margin:0 0 1.25rem;font-size:1.05rem"><i class="fas fa-box" style="color:var(--or,#C9A84C);margin-right:.4rem"></i>Enregistrer un achat de pack</h3>
  <div class="form-group"><label class="form-label">Pack *</label>
    <select id="pa-type" class="form-control">${opts}</select>
  </div>
  <div class="form-group"><label class="form-label">Nom du client *</label>
    <input type="text" id="pa-nom" class="form-control" placeholder="Ama Koffi">
  </div>
  <div class="form-group"><label class="form-label">Téléphone *</label>
    <input type="tel" id="pa-tel" class="form-control" placeholder="+22890000000">
  </div>
  <div class="form-group"><label class="form-label">Email</label>
    <input type="email" id="pa-email" class="form-control" placeholder="optionnel">
  </div>
  <div class="form-group"><label class="form-label">ID de transaction (CinetPay / reçu)</label>
    <input type="text" id="pa-txid" class="form-control" placeholder="optionnel">
  </div>
  <div style="display:flex;gap:.5rem;margin-top:1.25rem">
    <button class="btn btn-primary" style="flex:1" onclick="PacksSeances._submitAchat()"><i class="fas fa-check"></i> Enregistrer</button>
    <button class="btn btn-outline" onclick="document.getElementById('modal-pack-achat').remove()">Annuler</button>
  </div>
</div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  async _submitAchat() {
    const sel = document.getElementById('pa-type');
    const opt = sel.options[sel.selectedIndex];
    const nom = document.getElementById('pa-nom').value.trim();
    const tel = document.getElementById('pa-tel').value.trim();
    if (!nom || !tel) { _t()('Nom et téléphone obligatoires', 'error'); return; }
    const btn = document.querySelector('#modal-pack-achat .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    try {
      const pack = await this.acheter({
        client_nom: nom, client_tel: tel,
        client_email: document.getElementById('pa-email').value.trim() || null,
        type_pack: sel.value, label_pack: opt.text.split('—')[0].trim(),
        prix_pack: parseInt(opt.dataset.prix),
        seances_total: parseInt(opt.dataset.seances),
        transaction_id: document.getElementById('pa-txid').value.trim() || null,
      });
      document.getElementById('modal-pack-achat')?.remove();
      _t()(`Pack "${pack.label_pack}" enregistré pour ${nom}`, 'success');
      await histLog?.('paiement', 'Pack séances acheté', `${pack.label_pack} — ${fcfa(pack.prix_pack)} — ${nom}`);
      if (document.getElementById('packs-panel')) await this.renderPanel('packs-panel');
    } catch(e) {
      _t()('Erreur : ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Enregistrer'; }
    }
  },
};


/* ══════════════════════════════════════════════════════════
   3. PROGRAMME DE PARRAINAGE
══════════════════════════════════════════════════════════ */
window.Parrainage = {

  async getCredit() {
    try {
      const v = await sb.settings.get('parrainage_credit');
      return parseInt(v) || 2000;
    } catch { return 2000; }
  },

  async isActif() {
    try {
      const v = await sb.settings.get('parrainage_actif');
      return v !== 'false';
    } catch { return true; }
  },

  async list() {
    const s = await sb.getValidSession();
    if (!s) return [];
    const r = await fetch(`${SUPABASE_URL}/rest/v1/parrainages?order=created_at.desc&limit=200`, {
      headers: sb._h(s.token),
    });
    return r.ok ? r.json() : [];
  },

  async valider(id, crediter = true) {
    const s = await sb.getValidSession();
    if (!s) throw new Error('Non authentifié');
    const credit = crediter ? await this.getCredit() : 0;
    await fetch(`${SUPABASE_URL}/rest/v1/parrainages?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...sb._h(s.token), 'Prefer':'return=minimal' },
      body: JSON.stringify({
        statut: crediter ? 'credit_accorde' : 'valide',
        credit_fcfa: credit,
        validated_at: new Date().toISOString(),
      }),
    });
    return credit;
  },

  async creerDepuisRdv(data) {
    const p = {
      parrain_tel: (data.parrain_tel || '').replace(/\D/g, ''),
      parrain_nom: data.parrain_nom || 'Inconnu',
      filleul_nom: data.filleul_nom,
      filleul_tel: (data.filleul_tel || '').replace(/\D/g, ''),
      rdv_id: data.rdv_id || null,
      statut: 'en_attente',
    };
    await fetch(`${SUPABASE_URL}/rest/v1/parrainages`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'apikey':SUPABASE_ANON,
                 'Authorization':`Bearer ${SUPABASE_ANON}`, 'Prefer':'return=minimal' },
      body: JSON.stringify(p),
    });
  },

  async renderPanel(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<p style="color:var(--gris-d)"><i class="fas fa-spinner fa-spin"></i> Chargement…</p>';
    try {
      const [parrainages, credit, actif] = await Promise.all([
        this.list(), this.getCredit(), this.isActif()
      ]);
      const enAttente = parrainages.filter(p => p.statut === 'en_attente').length;
      const valides   = parrainages.filter(p => p.statut !== 'en_attente' && p.statut !== 'annule').length;
      const total_credits = parrainages.reduce((s,p) => s + (p.credit_fcfa || 0), 0);

      /* Grouper par parrain */
      const byParrain = {};
      parrainages.forEach(p => {
        if (!byParrain[p.parrain_tel]) byParrain[p.parrain_tel] = { nom: p.parrain_nom, tel: p.parrain_tel, count: 0, credits: 0 };
        byParrain[p.parrain_tel].count++;
        byParrain[p.parrain_tel].credits += (p.credit_fcfa || 0);
      });
      const top = Object.values(byParrain).sort((a,b) => b.count - a.count).slice(0, 5);

      el.innerHTML = `
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:1.5rem">
  <div class="dash-card"><div class="dash-card-icon">🤝</div><div class="dash-card-num">${parrainages.length}</div><div class="dash-card-label">Parrainages total</div></div>
  <div class="dash-card"><div class="dash-card-icon">⏳</div><div class="dash-card-num">${enAttente}</div><div class="dash-card-label">En attente</div></div>
  <div class="dash-card"><div class="dash-card-icon">💸</div><div class="dash-card-num">${fcfa(total_credits)}</div><div class="dash-card-label">Crédits accordés</div></div>
</div>

<div style="display:flex;gap:.5rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap">
  <button class="btn btn-primary btn-sm" onclick="Parrainage.openAjouterModal()"><i class="fas fa-plus"></i> Enregistrer un parrainage</button>
  <div style="margin-left:auto;display:flex;align-items:center;gap:.5rem;font-size:.85rem">
    <span>Programme actif :</span>
    <label class="toggle" style="display:flex;align-items:center;gap:.4rem;cursor:pointer">
      <input type="checkbox" ${actif ? 'checked' : ''} onchange="Parrainage._toggleActif(this.checked)" style="width:auto">
      <span>${actif ? 'Oui' : 'Non'}</span>
    </label>
  </div>
  <div style="font-size:.82rem;color:var(--gris-d)">Crédit par filleul : <strong>${fcfa(credit)}</strong>
    <button class="btn btn-sm btn-outline" style="margin-left:.5rem;font-size:.75rem" onclick="Parrainage.openCreditModal()"><i class="fas fa-edit"></i></button>
  </div>
</div>

${top.length ? `
<h4 style="font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;color:var(--gris-d);margin-bottom:.75rem">Top parrains</h4>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:1.5rem">
  ${top.map((p,i) => `
  <div style="background:var(--bg-card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:.75rem 1rem;display:flex;align-items:center;gap.5rem">
    <div style="width:32px;height:32px;border-radius:50%;background:var(--vert-clair,#e7f5ef);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--vert,#0C3320);font-size:.9rem;flex-shrink:0">${i+1}</div>
    <div style="margin-left:.6rem;flex:1;min-width:0">
      <div style="font-weight:600;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_esc(p.nom)}</div>
      <div style="font-size:.78rem;color:var(--gris-d)">${p.count} filleul(s) · ${fcfa(p.credits)} crédités</div>
    </div>
  </div>`).join('')}
</div>` : ''}

<h4 style="font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;color:var(--gris-d);margin-bottom:.75rem">Liste des parrainages</h4>
<div style="overflow-x:auto">
<table class="admin-table">
  <thead><tr><th>Parrain</th><th>Filleul</th><th>Statut</th><th>Crédit</th><th>Date</th><th>Actions</th></tr></thead>
  <tbody>
    ${parrainages.slice(0,40).map(p => `
    <tr>
      <td>${_esc(p.parrain_nom)}<br><small style="color:var(--gris-d)">${_esc(p.parrain_tel)}</small></td>
      <td>${_esc(p.filleul_nom)}<br><small style="color:var(--gris-d)">${_esc(p.filleul_tel)}</small></td>
      <td><span class="badge badge-${p.statut==='credit_accorde'?'success':p.statut==='valide'?'info':p.statut==='annule'?'danger':'warning'}">${p.statut.replace('_',' ')}</span></td>
      <td>${p.credit_fcfa ? fcfa(p.credit_fcfa) : '—'}</td>
      <td style="font-size:.8rem">${new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
      <td class="table-actions">
        ${p.statut === 'en_attente' ? `
        <button class="btn btn-sm btn-primary" onclick="Parrainage._valider(${p.id}, true)" title="Valider et créditer le parrain"><i class="fas fa-check"></i> Créditer</button>
        <button class="btn btn-sm btn-outline" onclick="Parrainage._valider(${p.id}, false)" title="Valider sans crédit"><i class="fas fa-check-circle"></i></button>` : ''}
      </td>
    </tr>`).join('')}
    ${parrainages.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--gris-d);padding:2rem">Aucun parrainage enregistré</td></tr>' : ''}
  </tbody>
</table>
</div>`;
    } catch(e) {
      el.innerHTML = `<p style="color:var(--danger)">Erreur : ${_esc(e.message)}</p>`;
    }
  },

  async _valider(id, crediter) {
    const msg = crediter ? 'Valider et créditer le parrain ?' : 'Valider sans crédit ?';
    if (!confirm(msg)) return;
    try {
      const credit = await this.valider(id, crediter);
      _t()(crediter ? `Parrainage validé — ${fcfa(credit)} crédités` : 'Parrainage validé', 'success');
      await histLog?.('autre', 'Parrainage validé', crediter ? `Crédit ${fcfa(credit)}` : 'Sans crédit');
      if (document.getElementById('parrainage-panel')) await this.renderPanel('parrainage-panel');
    } catch(e) { _t()('Erreur : ' + e.message, 'error'); }
  },

  async _toggleActif(val) {
    try {
      await sb.settings.set('parrainage_actif', val ? 'true' : 'false');
      _t()(val ? 'Programme parrainage activé' : 'Programme parrainage désactivé', 'success');
    } catch(e) { _t()('Erreur : ' + e.message, 'error'); }
  },

  openCreditModal() {
    const html = `
<div id="modal-parrain-credit" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem">
<div style="background:var(--bg-card,#fff);border-radius:16px;padding:1.5rem;max-width:340px;width:100%">
  <h3 style="margin:0 0 1rem;font-size:1rem"><i class="fas fa-coins" style="color:var(--or,#C9A84C);margin-right:.4rem"></i>Crédit de parrainage</h3>
  <div class="form-group"><label class="form-label">Montant crédit par filleul (FCFA)</label>
    <input type="number" id="pc-credit" class="form-control" value="2000" min="500" step="500">
  </div>
  <div style="display:flex;gap:.5rem;margin-top:1rem">
    <button class="btn btn-primary" style="flex:1" onclick="Parrainage._saveCredit()"><i class="fas fa-save"></i> Enregistrer</button>
    <button class="btn btn-outline" onclick="document.getElementById('modal-parrain-credit').remove()">Annuler</button>
  </div>
</div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  async _saveCredit() {
    const v = parseInt(document.getElementById('pc-credit').value);
    if (!v || v < 500) { _t()('Montant minimum 500 FCFA', 'error'); return; }
    try {
      await sb.settings.set('parrainage_credit', String(v));
      document.getElementById('modal-parrain-credit')?.remove();
      _t()(`Crédit mis à jour : ${fcfa(v)}`, 'success');
      if (document.getElementById('parrainage-panel')) await this.renderPanel('parrainage-panel');
    } catch(e) { _t()('Erreur : ' + e.message, 'error'); }
  },

  openAjouterModal() {
    const html = `
<div id="modal-parrain-ajout" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem">
<div style="background:var(--bg-card,#fff);border-radius:16px;padding:1.75rem;max-width:420px;width:100%">
  <h3 style="margin:0 0 1.25rem;font-size:1.05rem"><i class="fas fa-users" style="color:var(--or,#C9A84C);margin-right:.4rem"></i>Enregistrer un parrainage</h3>
  <p style="font-size:.83rem;color:var(--gris-d);margin-bottom:1rem">Remplissez quand un client vient sur recommandation d'un autre client.</p>
  <div class="form-group"><label class="form-label">Nom du parrain *</label>
    <input type="text" id="pp-parrain-nom" class="form-control" placeholder="Nom du client qui a recommandé">
  </div>
  <div class="form-group"><label class="form-label">Téléphone du parrain *</label>
    <input type="tel" id="pp-parrain-tel" class="form-control" placeholder="+22890000000">
  </div>
  <div class="form-group"><label class="form-label">Nom du filleul *</label>
    <input type="text" id="pp-filleul-nom" class="form-control" placeholder="Nom du nouveau client">
  </div>
  <div class="form-group"><label class="form-label">Téléphone du filleul *</label>
    <input type="tel" id="pp-filleul-tel" class="form-control" placeholder="+22890000000">
  </div>
  <div style="display:flex;gap:.5rem;margin-top:1.25rem">
    <button class="btn btn-primary" style="flex:1" onclick="Parrainage._submitAjouter()"><i class="fas fa-check"></i> Enregistrer</button>
    <button class="btn btn-outline" onclick="document.getElementById('modal-parrain-ajout').remove()">Annuler</button>
  </div>
</div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  },

  async _submitAjouter() {
    const pNom = document.getElementById('pp-parrain-nom').value.trim();
    const pTel = document.getElementById('pp-parrain-tel').value.trim();
    const fNom = document.getElementById('pp-filleul-nom').value.trim();
    const fTel = document.getElementById('pp-filleul-tel').value.trim();
    if (!pNom || !pTel || !fNom || !fTel) { _t()('Tous les champs sont obligatoires', 'error'); return; }
    const btn = document.querySelector('#modal-parrain-ajout .btn-primary');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    try {
      await this.creerDepuisRdv({ parrain_nom: pNom, parrain_tel: pTel, filleul_nom: fNom, filleul_tel: fTel });
      document.getElementById('modal-parrain-ajout')?.remove();
      _t()('Parrainage enregistré — en attente de validation', 'success');
      await histLog?.('autre', 'Parrainage enregistré', `${pNom} → ${fNom}`);
      if (document.getElementById('parrainage-panel')) await this.renderPanel('parrainage-panel');
    } catch(e) {
      _t()('Erreur : ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Enregistrer'; }
    }
  },
};


/* ══════════════════════════════════════════════════════════
   CHAMP PARRAINAGE DANS LE FORMULAIRE PUBLIC RDV
   Injecte un champ optionnel "Recommandé par"
══════════════════════════════════════════════════════════ */
window.initParrainageField = async function(formId) {
  try {
    const actif = await Parrainage.isActif();
    if (!actif) return;
  } catch { return; }

  const form = document.getElementById(formId);
  if (!form) return;
  const submitBtn = form.querySelector('[type="submit"], .btn-submit, button[class*="btn"]');
  if (!submitBtn) return;
  if (form.querySelector('#parrain-field-grp')) return;

  const grp = document.createElement('div');
  grp.id = 'parrain-field-grp';
  grp.style.cssText = 'margin-bottom:1rem';
  grp.innerHTML = `
    <label for="parrain-tel-input" style="display:block;margin-bottom:.35rem;font-weight:600;font-size:.88rem">
      <i class="fas fa-users" style="color:var(--or,#C9A84C);margin-right:.3rem"></i>Recommandé par (optionnel)
    </label>
    <input type="tel" id="parrain-tel-input" placeholder="Téléphone de la personne qui vous a recommandé"
      style="width:100%" maxlength="20">
    <div style="font-size:.77rem;color:var(--gris-d,#888);margin-top:.3rem">
      Votre parrain recevra un crédit sur son prochain rendez-vous 🎁
    </div>`;
  submitBtn.before(grp);
};

/* Récupérer le tel parrain saisi dans le formulaire */
window.getParrainTel = function() {
  return document.getElementById('parrain-tel-input')?.value?.trim() || null;
};


/* ══════════════════════════════════════════════════════════
   INTÉGRATION DANS LE REGISTRY ADMIN (paramètres)
══════════════════════════════════════════════════════════ */
if (window.ParamRegistry) {
  window.ParamRegistry.register(async () => {
    /* Rien à injecter dans les paramètres pour l'instant */
  });
}
