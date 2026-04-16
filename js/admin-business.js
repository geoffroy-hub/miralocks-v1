/* ============================================================
   Miralocks Admin — admin-business.js  v1.0
   Fonctionnalités métier :
   1.  Factures PDF automatiques
   2.  Suivi chiffre d'affaires
   3.  Programme fidélité
   4.  Newsletter
   7.  Fiche client complète
   8.  Notes internes par service
   9.  Congés & fermetures
   13. Compression images à la volée
   14. Mode maintenance
   15. Sauvegarde JSON complète
   ============================================================ */

/* Helper : échappement HTML pour éviter les injections XSS */
const _escBiz = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

/* ══════════════════════════════════════════════════════════
   1. FACTURES PDF AUTOMATIQUES
══════════════════════════════════════════════════════════ */
window.generateFacture = async function(rdvId) {
  const toast = window.toast || window.showToast;
  try {
    const rdv = typeof rdvId === 'object' ? rdvId : await sb.rdv.get(rdvId);
    if (!rdv) { toast?.('RDV introuvable', 'error'); return; }

    const nomSalon = await sb.settings.get('salon_nom').catch(() => 'Institut MiraLocks');
    const adresse  = await sb.settings.get('salon_adresse').catch(() => 'Agoè Cacaveli, Lomé, Togo');
    const tel      = await sb.settings.get('salon_tel').catch(() => '+228 97 98 90 01');

    /* Récupérer le prix du service depuis la table services */
    let prix = '—';
    try {
      const svcs = await sb.services.list(false);
      const svc = svcs.find(s => s.nom === rdv.service || rdv.service?.includes(s.nom));
      if (svc?.prix) prix = svc.prix + ' FCFA';
    } catch { /* silencieux */ }

    const now = new Date();
    const numFacture = `MLK-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-${rdv.id}`;
    const dateFormatee = now.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
    const daterdv = rdv.date_rdv
      ? new Date(rdv.date_rdv+'T12:00:00').toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })
      : '—';

    const win = window.open('', '_blank');
    if (!win) { toast?.('Autorisez les popups', 'error'); return; }

    win.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>Facture ${numFacture}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;padding:2.5rem;background:#fff;font-size:14px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2.5rem;padding-bottom:1.5rem;border-bottom:3px solid #0C3320}
  .logo-zone h1{color:#0C3320;font-size:1.8rem;font-weight:800;letter-spacing:.03em}
  .logo-zone p{color:#C9A84C;font-size:.85rem;margin-top:.2rem}
  .salon-info{text-align:right;font-size:.82rem;color:#555;line-height:1.6}
  .badge-facture{background:#0C3320;color:#C9A84C;padding:.5rem 1.5rem;border-radius:6px;font-weight:700;font-size:1.1rem;display:inline-block;margin-bottom:1.5rem}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:2rem}
  .meta-box{background:#f8f9fa;border-radius:8px;padding:1rem 1.25rem;border-left:3px solid #C9A84C}
  .meta-box h4{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#888;margin-bottom:.4rem}
  .meta-box p{font-weight:600;color:#1a1a1a;line-height:1.5}
  table{width:100%;border-collapse:collapse;margin-bottom:1.5rem}
  thead tr{background:#0C3320;color:#fff}
  th{padding:.75rem 1rem;text-align:left;font-size:.85rem;font-weight:600}
  td{padding:.75rem 1rem;border-bottom:1px solid #f0f0f0;font-size:.88rem}
  .total-box{display:flex;justify-content:flex-end;margin-bottom:2rem}
  .total-inner{background:#f8f9fa;border-radius:10px;padding:1rem 1.5rem;min-width:220px;border:1px solid #e5e7eb}
  .total-row{display:flex;justify-content:space-between;padding:.3rem 0;font-size:.88rem}
  .total-row.grand{border-top:2px solid #0C3320;margin-top:.5rem;padding-top:.75rem;font-weight:800;font-size:1rem;color:#0C3320}
  .footer{text-align:center;color:#999;font-size:.75rem;border-top:1px solid #eee;padding-top:1rem;margin-top:2rem}
  .merci{text-align:center;background:linear-gradient(135deg,#0C3320,#1a5c38);color:#C9A84C;border-radius:10px;padding:1rem;margin-bottom:1.5rem;font-size:1.1rem;font-weight:700}
  @media print{body{padding:1rem}.no-print{display:none}}
</style>
</head><body>
  <div class="header">
    <div class="logo-zone">
      <h1>🌿 ${nomSalon}</h1>
      <p>Spécialiste des locks naturels à Lomé</p>
    </div>
    <div class="salon-info">
      ${adresse}<br>${tel}<br>
      <a href="mailto:contact@miralocks.tg" style="color:#C9A84C">contact@miralocks.tg</a>
    </div>
  </div>

  <div class="badge-facture">FACTURE N° ${numFacture}</div>

  <div class="meta-grid">
    <div class="meta-box">
      <h4>Client</h4>
      <p>${rdv.nom}<br>${rdv.tel}${rdv.email ? '<br>'+rdv.email : ''}</p>
    </div>
    <div class="meta-box">
      <h4>Détails de la facture</h4>
      <p>Date d'émission : ${dateFormatee}<br>Date de la prestation : ${daterdv}</p>
    </div>
  </div>

  <table>
    <thead><tr><th>Prestation</th><th>Date</th><th>Durée</th><th>Prix</th></tr></thead>
    <tbody>
      <tr>
        <td><strong>${rdv.service}</strong>${rdv.message ? '<br><small style="color:#888">'+rdv.message+'</small>' : ''}</td>
        <td>${daterdv} ${rdv.heure || ''}</td>
        <td>Sur devis</td>
        <td><strong>${prix}</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="total-box">
    <div class="total-inner">
      <div class="total-row"><span>Sous-total HT</span><span>${prix}</span></div>
      <div class="total-row"><span>TVA (0%)</span><span>0 FCFA</span></div>
      ${rdv.acompte_montant ? `<div class="total-row"><span>Acompte versé</span><span>-${rdv.acompte_montant} FCFA</span></div>` : ''}
      <div class="total-row grand"><span>TOTAL DÛ</span><span>${prix}</span></div>
    </div>
  </div>

  <div class="merci">Merci de votre confiance ! 🌿 À bientôt chez MiraLocks</div>

  <div class="footer">
    ${nomSalon} · ${adresse} · ${tel}<br>
    Document généré le ${dateFormatee} · Non assujetti à TVA
  </div>
  <script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
    win.document.close();
    await histLog('rdv', 'Facture générée', `${rdv.nom} — RDV #${rdv.id}`);
  } catch(e) {
    (window.toast||window.showToast)?.('Erreur facture : '+e.message, 'error');
  }
};


/* ══════════════════════════════════════════════════════════
   2. SUIVI CHIFFRE D'AFFAIRES
══════════════════════════════════════════════════════════ */
window.renderCA = async function(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const [rdvs, svcs] = await Promise.all([sb.rdv.list(null), sb.services.list(false)]);

    /* Mapper service → prix */
    const prixMap = {};
    svcs.forEach(s => { if (s.prix) prixMap[s.nom] = parseInt(s.prix) || 0; });

    const now = new Date();
    const mois = now.getMonth(); const annee = now.getFullYear();

    let caMois = 0, caAnnee = 0, caTotal = 0;
    const parMois = {};
    const parService = {};

    rdvs.filter(r => r.statut === 'termine').forEach(r => {
      const p = prixMap[r.service] || 0;
      caTotal += p;
      const d = new Date(r.date_rdv+'T12:00:00');
      if (d.getFullYear() === annee) {
        caAnnee += p;
        if (d.getMonth() === mois) caMois += p;
        const key = `${annee}-${String(d.getMonth()+1).padStart(2,'0')}`;
        parMois[key] = (parMois[key]||0) + p;
      }
      parService[r.service] = (parService[r.service]||0) + p;
    });

    const topSvc = Object.entries(parService).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const moisLabels = ['Jan','Fév','Mar','Avr','Mai','Jui','Jul','Aoû','Sep','Oct','Nov','Déc'];

    el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem">
      ${[['Ce mois',caMois],['Cette année',caAnnee],['Total',caTotal]].map(([l,v])=>`
        <div style="background:var(--bg,#f9fafb);border-radius:12px;padding:1rem;text-align:center;border:1px solid var(--border,#e5e7eb)">
          <div style="font-size:1.4rem;font-weight:800;color:var(--vert,#0C3320)">${v.toLocaleString('fr-FR')} <small style="font-size:.7rem;color:var(--gris-d)">FCFA</small></div>
          <div style="font-size:.78rem;color:var(--gris-d)">${l}</div>
        </div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
      <div>
        <h5 style="font-size:.8rem;color:var(--gris-d);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem">Par mois (${annee})</h5>
        ${moisLabels.map((m,i)=>{
          const k=`${annee}-${String(i+1).padStart(2,'0')}`;
          const v=parMois[k]||0;
          const max=Math.max(...Object.values(parMois),1);
          return `<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:4px">
            <span style="font-size:.72rem;color:var(--gris-d);width:28px">${m}</span>
            <div style="flex:1;background:var(--bg,#f0f0f0);border-radius:4px;height:8px;overflow:hidden">
              <div style="background:var(--vert,#0C3320);width:${Math.round((v/max)*100)}%;height:100%;border-radius:4px"></div>
            </div>
            <span style="font-size:.7rem;color:var(--gris-d);width:60px;text-align:right">${v?v.toLocaleString('fr-FR'):''}</span>
          </div>`;
        }).join('')}
      </div>
      <div>
        <h5 style="font-size:.8rem;color:var(--gris-d);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem">Top services (CA)</h5>
        ${topSvc.length ? topSvc.map(([s,v])=>`
          <div style="margin-bottom:.6rem">
            <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:2px">
              <span style="font-weight:600;color:var(--text)">${s}</span>
              <span style="color:var(--gris-d)">${v.toLocaleString('fr-FR')} F</span>
            </div>
            <div style="background:var(--bg,#f0f0f0);border-radius:4px;height:6px;overflow:hidden">
              <div style="background:var(--or,#C9A84C);width:${Math.round((v/topSvc[0][1])*100)}%;height:100%;border-radius:4px"></div>
            </div>
          </div>`).join('') : '<p style="color:var(--gris-d);font-size:.82rem">Aucune donnée — ajoutez des prix aux services.</p>'}
      </div>
    </div>`;
  } catch(e) {
    el.innerHTML = `<p style="color:var(--danger)">Erreur : ${_escBiz(e.message)}</p>`;
  }
};


/* ══════════════════════════════════════════════════════════
   3. PROGRAMME DE FIDÉLITÉ
══════════════════════════════════════════════════════════ */
window.Fidelite = {
  async getClient(tel) {
    const clean = tel.replace(/\D/g,'');
    const rdvs = await sb._get('rendezvous',
      `tel=like.*${clean.slice(-8)}*&statut=eq.termine&select=id,nom,tel,service,date_rdv,created_at&order=created_at.asc`);
    const total = rdvs.length;
    const PALIERS = [
      { visites:5,  reduction:10, label:'Client Argent 🥈' },
      { visites:10, reduction:15, label:'Client Or 🥇'    },
      { visites:20, reduction:20, label:'Client VIP 💎'   },
    ];
    const palier = [...PALIERS].reverse().find(p => total >= p.visites) || null;
    const next   = PALIERS.find(p => total < p.visites) || null;
    return { rdvs, total, palier, next, nom: rdvs[0]?.nom || '' };
  },

  async renderCard(containerId, tel) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const data = await this.getClient(tel);
      const stars = Array(Math.min(data.total,10)).fill('⭐').join('') || '—';
      el.innerHTML = `
        <div style="background:${data.palier ? 'linear-gradient(135deg,#0C3320,#1a5c38)' : 'var(--bg,#f9fafb)'};border-radius:14px;padding:1.25rem;color:${data.palier ? '#C9A84C' : 'var(--text)'};border:1px solid var(--border,#e5e7eb)">
          <div style="font-size:1.5rem;margin-bottom:.25rem">${data.palier?.label || '🌱 Client régulier'}</div>
          <div style="font-size:2rem;font-weight:800">${data.total} visite${data.total>1?'s':''}</div>
          <div style="margin:.5rem 0;font-size:1rem">${stars}</div>
          ${data.palier ? `<div style="margin-top:.5rem;font-size:.9rem">🎁 Réduction actuelle : <strong>${data.palier.reduction}%</strong></div>` : ''}
          ${data.next ? `<div style="margin-top:.4rem;font-size:.8rem;opacity:.8">Encore ${data.next.visites - data.total} visite(s) pour ${data.next.label}</div>` : '<div style="margin-top:.5rem;font-size:.85rem">🏆 Niveau maximum atteint !</div>'}
        </div>`;
    } catch(e) {
      el.innerHTML = `<p style="color:var(--danger);font-size:.85rem">Erreur : ${_escBiz(e.message)}</p>`;
    }
  },
};


/* ══════════════════════════════════════════════════════════
   7. FICHE CLIENT COMPLÈTE
   Regroupe tous les RDV d'un même téléphone
══════════════════════════════════════════════════════════ */
window.openFicheClient = async function(tel, nom) {
  const toast = window.toast||window.showToast;
  try {
    const clean = tel.replace(/\D/g,'');
    const rdvs = await sb._get('rendezvous',
      `tel=like.*${clean.slice(-8)}*&order=date_rdv.desc&limit=50`);

    const fidelite = await window.Fidelite.getClient(tel).catch(()=>({total:0,palier:null}));

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';
    modal.innerHTML = `
      <div style="background:var(--bg-card,#fff);border-radius:20px;padding:2rem;max-width:620px;width:100%;max-height:90vh;overflow-y:auto;position:relative">
        <button onclick="this.closest('[style*=fixed]').remove()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--gris-d)">×</button>
        <h2 style="margin:0 0 .25rem;color:var(--vert,#0C3320)">👤 ${nom || rdvs[0]?.nom || 'Client'}</h2>
        <div style="color:var(--gris-d);font-size:.85rem;margin-bottom:1.25rem">
          📞 ${tel}
          ${rdvs[0]?.email ? ` · 📧 ${rdvs[0].email}` : ''}
        </div>

        <!-- Fidélité -->
        <div id="fidelite-card-${clean.slice(-6)}" style="margin-bottom:1.25rem"></div>

        <!-- Statistiques rapides -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1.25rem">
          ${[
            ['Total RDV', rdvs.length],
            ['Terminés', rdvs.filter(r=>r.statut==='termine').length],
            ['Annulés', rdvs.filter(r=>r.statut==='annule').length],
          ].map(([l,v])=>`
            <div style="background:var(--bg,#f9fafb);border-radius:10px;padding:.75rem;text-align:center;border:1px solid var(--border,#e5e7eb)">
              <div style="font-size:1.4rem;font-weight:800;color:var(--vert,#0C3320)">${v}</div>
              <div style="font-size:.75rem;color:var(--gris-d)">${l}</div>
            </div>`).join('')}
        </div>

        <!-- Historique des RDV -->
        <h4 style="font-size:.85rem;color:var(--gris-d);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem">Historique des rendez-vous</h4>
        <div style="display:flex;flex-direction:column;gap:.5rem">
          ${rdvs.map(r=>{
            const st={en_attente:{c:'#f59e0b',bg:'#FEF3C7'},confirme:{c:'#10b981',bg:'#D1FAE5'},annule:{c:'#ef4444',bg:'#FEE2E2'},termine:{c:'#6b7280',bg:'#F3F4F6'}}[r.statut]||{c:'#888',bg:'#f0f0f0'};
            return `<div style="display:flex;align-items:center;gap:.75rem;padding:.6rem 1rem;background:var(--bg,#f9fafb);border-radius:10px;border-left:3px solid ${st.c}">
              <div style="flex:1">
                <strong style="font-size:.88rem">${r.service}</strong>
                <div style="font-size:.75rem;color:var(--gris-d)">${r.date_rdv} ${r.heure||''}</div>
              </div>
              <span style="background:${st.bg};color:${st.c};font-size:.72rem;padding:2px 8px;border-radius:20px;font-weight:600">${r.statut}</span>
              ${r.statut==='termine'?`<button class="btn btn-sm btn-outline" style="font-size:.7rem;padding:3px 7px" onclick="generateFacture(${r.id})"><i class="fas fa-receipt"></i></button>`:''}
            </div>`;
          }).join('')}
        </div>

        <div style="margin-top:1.5rem;display:flex;gap:.75rem;justify-content:flex-end">
          <a href="https://wa.me/${clean}?text=${encodeURIComponent(`Bonjour ${nom||''} 👋, de la part de Miralocks !`)}"
            target="_blank" class="btn btn-sm" style="background:#25D366;color:#fff;border:none">
            <i class="fab fa-whatsapp"></i> WhatsApp
          </a>
          <button class="btn btn-sm btn-outline" onclick="this.closest('[style*=fixed]').remove()">Fermer</button>
        </div>
      </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });

    /* Charger la carte fidélité */
    setTimeout(() => window.Fidelite.renderCard(`fidelite-card-${clean.slice(-6)}`, tel), 100);

  } catch(e) {
    toast?.('Erreur fiche client : '+e.message, 'error');
  }
};

/* Ajouter le bouton "Fiche client" dans le détail RDV */
window._origRdvToggle_fiche = window.rdvToggle;


/* ══════════════════════════════════════════════════════════
   8. NOTES INTERNES PAR SERVICE
══════════════════════════════════════════════════════════ */
window.ServiceNotes = {
  KEY_PREFIX: 'service_note_',

  async get(serviceName) {
    const key = this.KEY_PREFIX + encodeURIComponent(serviceName);
    return await sb.settings.get(key).catch(()=>null);
  },

  async set(serviceName, note) {
    const key = this.KEY_PREFIX + encodeURIComponent(serviceName);
    await sb.settings.set(key, note);
    if (window._cache) window._cache.invalidate('setting_'+key);
  },

  async renderModal(serviceName) {
    const existing = await this.get(serviceName);
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    modal.innerHTML = `
      <div style="background:var(--bg-card,#fff);border-radius:20px;padding:2rem;max-width:480px;width:100%">
        <h3 style="margin:0 0 1rem;color:var(--vert,#0C3320)"><i class="fas fa-clipboard-list" style="color:var(--or,#C9A84C);margin-right:.4rem"></i>Fiche technique : ${serviceName}</h3>
        <textarea id="service-note-textarea" style="width:100%;min-height:160px;border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:.75rem;font-family:inherit;font-size:.88rem;resize:vertical" placeholder="Durée estimée : 2h&#10;Produits : shampoing locks, cire naturelle&#10;Contre-indications : cheveux très fragilisés&#10;Notes : prévoir serviette noire">${existing||''}</textarea>
        <div style="display:flex;gap:.75rem;margin-top:1rem;justify-content:flex-end">
          <button class="btn btn-outline btn-sm" onclick="this.closest('[style*=fixed]').remove()">Annuler</button>
          <button class="btn btn-sm" style="background:var(--vert,#0C3320);color:var(--or,#C9A84C)" onclick="
            window.ServiceNotes.set('${serviceName.replace(/'/g,"\\'")}', document.getElementById('service-note-textarea').value)
              .then(()=>{ window.toast?.('Note enregistrée !','success'); this.closest('[style*=fixed]').remove(); })
              .catch(e=>window.toast?.(e.message,'error'));
          "><i class="fas fa-save"></i> Enregistrer</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  },
};


/* ══════════════════════════════════════════════════════════
   9. GESTION DES CONGÉS ET FERMETURES
══════════════════════════════════════════════════════════ */
window.Fermetures = {
  KEY: 'dates_fermetures',

  async getAll() {
    try {
      const raw = await sb.settings.get(this.KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  async add(date, raison) {
    const list = await this.getAll();
    if (!list.find(f=>f.date===date)) list.push({ date, raison: raison||'Fermeture' });
    list.sort((a,b)=>a.date.localeCompare(b.date));
    await sb.settings.set(this.KEY, JSON.stringify(list));
    if (window._cache) window._cache.invalidate('setting_'+this.KEY);
  },

  async remove(date) {
    const list = (await this.getAll()).filter(f=>f.date!==date);
    await sb.settings.set(this.KEY, JSON.stringify(list));
    if (window._cache) window._cache.invalidate('setting_'+this.KEY);
  },

  async isClosed(date) {
    const list = await this.getAll();
    return list.some(f=>f.date===date);
  },

  async renderPanel(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const list = await this.getAll();
    const upcoming = list.filter(f=>f.date>=new Date().toISOString().slice(0,10));

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem">
        <span style="font-size:.85rem;color:var(--gris-d)">${upcoming.length} fermeture(s) à venir</span>
        <button class="btn btn-sm btn-success" onclick="window.Fermetures.addModal()"><i class="fas fa-plus"></i> Ajouter</button>
      </div>
      ${!upcoming.length ? '<p style="color:var(--gris-d);font-size:.85rem;text-align:center;padding:.75rem">Aucune fermeture programmée</p>' :
        upcoming.map(f=>`
          <div style="display:flex;align-items:center;gap:.75rem;padding:.5rem .75rem;background:var(--bg,#f9fafb);border-radius:8px;border-left:3px solid #ef4444;margin-bottom:.35rem">
            <i class="fas fa-calendar-times" style="color:#ef4444"></i>
            <div style="flex:1">
              <strong style="font-size:.88rem">${new Date(f.date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</strong>
              <div style="font-size:.75rem;color:var(--gris-d)">${f.raison}</div>
            </div>
            <button class="btn btn-sm btn-danger" onclick="window.Fermetures.remove('${f.date}').then(()=>window.loadFermeturesPanel?.())">
              <i class="fas fa-trash"></i>
            </button>
          </div>`).join('')}`;
  },

  addModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    modal.innerHTML = `
      <div style="background:var(--bg-card,#fff);border-radius:20px;padding:2rem;max-width:400px;width:100%">
        <h3 style="margin:0 0 1rem;color:var(--vert,#0C3320)"><i class="fas fa-calendar-times" style="color:#ef4444;margin-right:.4rem"></i>Ajouter une fermeture</h3>
        <div style="margin-bottom:.75rem">
          <label style="display:block;font-size:.85rem;font-weight:600;margin-bottom:.35rem">Date</label>
          <input type="date" id="ferm-date" style="width:100%;border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:.6rem .75rem" min="${new Date().toISOString().slice(0,10)}">
        </div>
        <div style="margin-bottom:1.25rem">
          <label style="display:block;font-size:.85rem;font-weight:600;margin-bottom:.35rem">Raison</label>
          <input type="text" id="ferm-raison" placeholder="Ex: Congé annuel, Fête nationale, Formation…" style="width:100%;border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:.6rem .75rem">
        </div>
        <div style="display:flex;gap:.75rem;justify-content:flex-end">
          <button class="btn btn-outline btn-sm" onclick="this.closest('[style*=fixed]').remove()">Annuler</button>
          <button class="btn btn-sm" style="background:#ef4444;color:#fff;border:none" onclick="
            const d=document.getElementById('ferm-date').value;
            const r=document.getElementById('ferm-raison').value||'Fermeture';
            if(!d){window.toast?.('Choisissez une date','error');return;}
            window.Fermetures.add(d,r).then(()=>{
              window.toast?.('Fermeture ajoutée !','success');
              this.closest('[style*=fixed]').remove();
              window.loadFermeturesPanel?.();
            });
          "><i class="fas fa-save"></i> Enregistrer</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  },
};

window.loadFermeturesPanel = async () => window.Fermetures.renderPanel('section-fermetures');


/* ══════════════════════════════════════════════════════════
   13. COMPRESSION IMAGES À LA VOLÉE
   Redimensionne avant upload dans Supabase Storage
══════════════════════════════════════════════════════════ */
window.compressImage = function(file, maxWidth=1200, maxHeight=1200, quality=0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const ratio = Math.min(maxWidth/width, maxHeight/height, 1);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) { resolve(file); return; }
        const ext = file.type === 'image/png' ? 'png' : 'jpeg';
        const compressed = new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: `image/${ext}` });
        console.log(`[ImageCompress] ${file.name}: ${(file.size/1024).toFixed(0)}KB → ${(compressed.size/1024).toFixed(0)}KB (${Math.round((1-compressed.size/file.size)*100)}% réduit)`);
        resolve(compressed);
      }, file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
};

/* Patcher sb.upload pour compresser automatiquement */
const _origUpload = sb.upload.bind(sb);
sb.upload = async function(folder, file) {
  if (file instanceof File && file.type.startsWith('image/')) {
    try { file = await compressImage(file); } catch(e) { console.warn('[compress]', e.message); }
  }
  return _origUpload(folder, file);
};
const _origPublicUpload = sb.publicUpload.bind(sb);
sb.publicUpload = async function(folder, file) {
  if (file instanceof File && file.type.startsWith('image/')) {
    try { file = await compressImage(file); } catch(e) { console.warn('[compress]', e.message); }
  }
  return _origPublicUpload(folder, file);
};


/* ══════════════════════════════════════════════════════════
   14. MODE MAINTENANCE
══════════════════════════════════════════════════════════ */
window.Maintenance = {
  async isActive() {
    try {
      const val = await sb.settings.get('maintenance_mode');
      return val === 'true';
    } catch { return false; }
  },

  async toggle() {
    const current = await this.isActive();
    await sb.settings.set('maintenance_mode', current ? 'false' : 'true');
    _cache?.invalidate('setting_maintenance_mode');
    const toast = window.toast||window.showToast;
    toast?.(current ? 'Mode maintenance désactivé ✅' : '🔧 Mode maintenance activé', current?'success':'warning');
    await histLog('autre', `Mode maintenance ${current?'désactivé':'activé'}`, '');
    await this.updateBtn();
  },

  async updateBtn() {
    const btn = document.getElementById('maintenance-toggle-btn');
    if (!btn) return;
    const active = await this.isActive();
    btn.innerHTML = `<i class="fas fa-${active?'check-circle':'tools'}"></i> ${active?'Désactiver maintenance':'🔧 Mode maintenance'}`;
    btn.style.background = active ? '#10b981' : '#f59e0b';
    btn.style.color = '#fff';
  },
};

/* Vérifier le mode maintenance sur les pages publiques */
if (!window.location.pathname.includes('admin')) {
  sb.settings.get('maintenance_mode').then(val => {
    if (val !== 'true') return;
    /* Remplacer le contenu par la page de maintenance */
    const main = document.querySelector('main, .main, #main, body > section');
    if (main) {
      main.innerHTML = `
        <div style="min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:3rem 1rem">
          <div style="font-size:4rem;margin-bottom:1rem">🔧</div>
          <h1 style="color:var(--vert,#0C3320);margin-bottom:.75rem">Site en maintenance</h1>
          <p style="color:var(--gris-d);max-width:380px;line-height:1.6">Nous mettons à jour notre site pour vous offrir une meilleure expérience. Nous serons de retour très bientôt !</p>
          <a href="https://wa.me/22897989001" target="_blank" style="margin-top:2rem;background:#25D366;color:#fff;padding:.75rem 1.75rem;border-radius:50px;text-decoration:none;font-weight:600;display:inline-flex;align-items:center;gap:.5rem">
            <i class="fab fa-whatsapp"></i> Nous contacter
          </a>
        </div>`;
    }
  }).catch(()=>{});
}


/* ══════════════════════════════════════════════════════════
   15. SAUVEGARDE JSON COMPLÈTE
══════════════════════════════════════════════════════════ */
window.exportBackupJSON = async function() {
  const toast = window.toast||window.showToast;
  toast?.('Export en cours…', 'info');
  try {
    const [rdvs, blog, galerie, avis, services, historique, settings] = await Promise.all([
      sb.rdv.list(null),
      sb.blog.list(false),
      sb.galerie.list(false),
      sb.avis.list(false),
      sb.services.list(false),
      sb._get('historique', 'order=created_at.desc&limit=500'),
      sb.settings.getAll(),
    ]);

    /* Filtrer les clés sensibles des settings */
    const SENSITIVE = ['admin_password','smtp_password','smtp_user','callmebot_apikey','cinetpay_apikey','fedapay_apikey','kkiapay_publickey'];
    const safeSettings = settings.filter(s => !SENSITIVE.includes(s.id));

    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: sb.getSession()?.email || 'admin',
      stats: { rdvs: rdvs.length, blog: blog.length, galerie: galerie.length, avis: avis.length, services: services.length },
      data: { rendezvous: rdvs, blog_posts: blog, galerie_photos: galerie, avis_clients: avis, services, historique, site_settings: safeSettings },
    };

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `miralocks_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);

    toast?.(`✅ Sauvegarde exportée — ${(json.length/1024).toFixed(0)} KB`, 'success');
    await histLog('autre', 'Sauvegarde JSON exportée', `${rdvs.length} RDV, ${blog.length} articles, ${galerie.length} photos`);
  } catch(e) {
    toast?.('Erreur backup : '+e.message, 'error');
  }
};


/* ══════════════════════════════════════════════════════════
   INJECTION DANS L'INTERFACE ADMIN
   - Boutons Facture dans panel RDV
   - Dashboard CA
   - Sections Paramètres (fermetures, maintenance, backup)
   - Bouton fiche client
══════════════════════════════════════════════════════════ */

/* Enregistrement dans le Registry central (admin-settings.js) */
if (window.ParamRegistry) {
  window.ParamRegistry.register(async () => {
    if (window.Fermetures && typeof window.Fermetures.renderPanel === 'function') {
      await window.Fermetures.renderPanel('section-fermetures').catch(console.warn);
    }
    if (window.Maintenance && typeof window.Maintenance.updateBtn === 'function') {
      await window.Maintenance.updateBtn().catch(console.warn);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  /* Patch du dashboard pour CA */
  const patchDash = () => {
    if (typeof loadDashboard !== 'function') { setTimeout(patchDash, 300); return; }
    const _orig = window.loadDashboard;
    window.loadDashboard = async function() {
      const r = await _orig.apply(this, arguments);
      if (!document.getElementById('dash-ca')) {
        const container = document.createElement('div');
        container.id = 'dash-ca';
        container.style.cssText = 'background:var(--bg-card,#fff);border-radius:var(--rayon-lg,16px);padding:1.25rem 1.5rem;border:1px solid var(--border,#e5e7eb);margin-top:1.5rem;';
        container.innerHTML = '<h4 style="margin:0 0 1rem;font-size:.9rem;color:var(--gris-d);text-transform:uppercase;letter-spacing:.05em"><i class="fas fa-chart-line" style="margin-right:.4rem;color:var(--or,#C9A84C)"></i>Chiffre d\'affaires</h4><div id="dash-ca-inner"></div>';
        const satisfaction = document.getElementById('dash-satisfaction');
        if (satisfaction) satisfaction.after(container);
        else document.getElementById('dash-pending')?.after(container);
      }
      setTimeout(() => renderCA('dash-ca-inner'), 700);
      return r;
    };
  };
  patchDash();
});
