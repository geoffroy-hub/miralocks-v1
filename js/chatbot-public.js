/* ============================================================
   Miralocks — chatbot-public.js  v1.0
   Fonctionnalités publiques avancées :
   7.  Chatbot IA sur le site public (Claude API)
   8.  Avis clients avec photos
   9.  Page profil stylist (about.html)
   10. Import CSV rendez-vous (admin)
   11. Dashboard personnalisable (admin)
   12. Historique des modifications (admin)
   ============================================================ */
/* Helper : échappement HTML pour éviter les injections XSS */
const _escChat = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');



/* ══════════════════════════════════════════════════════════
   7. CHATBOT IA PUBLIC
   Widget WhatsApp-style en bas de page sur le site public
   Répond aux questions sur services, prix, disponibilités
══════════════════════════════════════════════════════════ */
window.PublicChatbot = {
  _open: false,
  _history: [],
  _initialized: false,

  /* Contexte du chatbot public */
  async _getSystem(config = {}) {
    if (config.systemPrompt) return config.systemPrompt;

    let services = [];
    try {
      if (window.sb) services = await sb.services.list(true).catch(() => []);
    } catch { }

    return `Tu es l'assistante virtuelle de l'Institut MiraLocks, salon de locks naturels à Lomé, Togo.
MiraLocks est spécialisé dans les locks naturels, l'entretien et la création.
Tu réponds aux visiteurs du site web avec gentillesse et en français (ou en anglais si on te parle en anglais).

COORDONNÉES :
- Adresse : Agoè Cacaveli, près de l'école La Source, Lomé
- WhatsApp : +228 97 98 90 01
- Horaires : Mardi–Samedi, 08h00–18h00 (Fermé Dimanche et Lundi)
- Réservation : https://mira-lecks.vercel.app/rendezvous.html

${services.length ? `PRESTATIONS DISPONIBLES :\n${services.slice(0, 10).map(s => `- ${s.nom}${s.prix ? ` : ${s.prix} FCFA` : ''}`).join('\n')}` : ''}

RÈGLES D'OR :
1. Sois concise (3 phrases max).
2. Pour les rendez-vous, invite toujours à utiliser le lien ou WhatsApp.
3. Ne propose que les services listés ci-dessus.
4. Si un visiteur demande autre chose, reste polie et redirige vers WhatsApp.`;
  },

  async send(msg) {
    this._history.push({ role: 'user', content: msg });
    if (this._history.length > 10) this._history = this._history.slice(-10);

    try {
      // 1. Tenter de récupérer la config publique
      let config = await window.AICore.getConfig('public').catch(() => ({}));
      
      // 2. Fallback à la config admin si la clé publique est absente
      // (Note : cela ne fonctionnera pour le public que si l'admin a relâché les RLS sur ai_apikey)
      if (!config || !config.apikey) {
        const adminCfg = await window.AICore.getConfig('admin').catch(() => ({}));
        if (adminCfg && adminCfg.apikey) {
          config = { ...adminCfg, ...config }; 
        }
      }

      if (!config || !config.apikey) {
        throw new Error("Clé API manquante ou inaccessible");
      }

      const system = await this._getSystem(config);
      const reply = await window.AICore.call(this._history, config, system);
      
      this._history.push({ role: 'assistant', content: reply });
      return reply;
    } catch(e) {
      console.error('[Chatbot] Send Error:', e);
      throw e;
    }
  },

  init() {
    if (this._initialized) return;
    this._initialized = true;

    /* Créer le widget */
    const widget = document.createElement('div');
    widget.id = 'public-chatbot';
    widget.style.cssText = `
      position:fixed;bottom:6.5rem;right:1.5rem;
      z-index:8889;font-family:inherit;
    `;
    widget.innerHTML = `
      <!-- Bulle flottante -->
      <button id="chatbot-fab" style="
        width:56px;height:56px;border-radius:50%;
        background:linear-gradient(135deg,#0C3320,#1a5c38);
        color:var(--or,#C9A84C);border:none;cursor:pointer;
        box-shadow:0 4px 20px rgba(12,51,32,.35);
        display:flex;align-items:center;justify-content:center;
        transition:transform .2s, box-shadow .2s;
        padding: 0; overflow: hidden;
      " title="Poser une question" aria-label="Ouvrir le chatbot">
        <img src="assets/chatbot-logo.png" style="width:100%;height:100%;object-fit:cover" alt="Chatbot">
      </button>

      <!-- Panneau chat -->
      <div id="chatbot-panel" style="
        display:none;
        position:absolute;bottom:66px;right:0;
        width:320px;max-height:480px;
        background:var(--bg-card,#fff);
        border-radius:20px;
        box-shadow:0 12px 50px rgba(0,0,0,.22);
        border:1px solid var(--border,#e5e7eb);
        overflow:hidden;
        flex-direction:column;
      ">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#0C3320,#1a5c38);padding:1rem;display:flex;align-items:center;gap:.75rem">
          <div style="width:38px;height:38px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden">
             <img src="assets/chatbot-logo.png" style="width:100%;height:100%;object-fit:cover" alt="Logo">
          </div>
          <div style="flex:1;color:#fff">
            <div style="font-weight:700;font-size:.9rem">Assistant MiraLocks</div>
            <div style="font-size:.7rem;opacity:.8;display:flex;align-items:center;gap:.3rem">
              <span style="width:7px;height:7px;background:#4ade80;border-radius:50%;display:inline-block;box-shadow:0 0 5px #4ade80"></span>
              IA en ligne
            </div>
          </div>
          <button onclick="PublicChatbot.close()" style="background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:1.4rem;padding:.2rem">×</button>
        </div>

        <!-- Messages -->
        <div id="chatbot-msgs" style="flex:1;overflow-y:auto;padding:.85rem;display:flex;flex-direction:column;gap:.6rem;max-height:240px;min-height:160px">
          <div class="cb-msg cb-bot" style="background:linear-gradient(135deg,rgba(12,51,32,.06),rgba(12,51,32,.03));border-radius:10px 10px 10px 0;padding:.65rem .85rem;font-size:.82rem;color:var(--text);max-width:88%;border-left:2px solid var(--vert,#0C3320)">
            Bonjour ! 👋 Je suis l'assistante de MiraLocks. Posez-moi vos questions sur nos services, tarifs ou horaires !
          </div>
        </div>

        <!-- Suggestions rapides -->
        <div id="chatbot-sugg" style="padding:.4rem .85rem;display:flex;gap:.3rem;flex-wrap:wrap;border-top:1px solid var(--border,#f0f0f0)">
          ${['Services & tarifs','Horaires','Réserver','Localisation'].map(s =>
            `<button onclick="PublicChatbot._quick('${s}')" style="background:rgba(12,51,32,.07);color:var(--vert,#0C3320);border:1px solid rgba(12,51,32,.15);border-radius:20px;padding:2px 9px;font-size:.7rem;cursor:pointer;font-family:inherit">${s}</button>`
          ).join('')}
        </div>

        <!-- Saisie -->
        <div style="padding:.6rem .85rem;border-top:1px solid var(--border,#f0f0f0);display:flex;gap:.4rem">
          <input id="chatbot-input" type="text" placeholder="Votre question…"
            style="flex:1;border:1px solid var(--border,#e5e7eb);border-radius:20px;padding:.45rem .85rem;font-size:.82rem;outline:none;font-family:inherit;background:var(--bg,#f9fafb)"
            onkeydown="if(event.key==='Enter'){PublicChatbot._sendInput()}">
          <button id="chatbot-send" onclick="PublicChatbot._sendInput()" style="background:var(--vert,#0C3320);color:var(--or,#C9A84C);border:none;border-radius:50%;width:34px;height:34px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas fa-paper-plane" style="font-size:.75rem"></i>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    /* Événements */
    document.getElementById('chatbot-fab').onclick = () => this.toggle();
    document.getElementById('chatbot-fab').addEventListener('mouseenter', () => {
      document.getElementById('chatbot-fab').style.transform = 'scale(1.1)';
    });
    document.getElementById('chatbot-fab').addEventListener('mouseleave', () => {
      document.getElementById('chatbot-fab').style.transform = '';
    });
  },

  toggle() { this._open ? this.close() : this.open(); },

  open() {
    const panel = document.getElementById('chatbot-panel');
    if (panel) { panel.style.display = 'flex'; panel.style.flexDirection = 'column'; }
    const fab = document.getElementById('chatbot-fab');
    if (fab) {
      fab.innerHTML = '<i class="fas fa-times" style="font-size:1.5rem"></i>';
      fab.style.background = 'linear-gradient(135deg,#c9a84c,#b08d32)'; // Change color when open
      fab.style.color = '#0C3320';
    }
    this._open = true;
    setTimeout(() => document.getElementById('chatbot-input')?.focus(), 100);
  },

  close() {
    const panel = document.getElementById('chatbot-panel');
    if (panel) panel.style.display = 'none';
    const fab = document.getElementById('chatbot-fab');
    if (fab) {
      fab.innerHTML = '<img src="assets/chatbot-logo.png" style="width:100%;height:100%;object-fit:cover" alt="Chatbot">';
      fab.style.background = 'linear-gradient(135deg,#0C3320,#1a5c38)';
      fab.style.color = 'var(--or,#C9A84C)';
    }
    this._open = false;
  },

  async _quick(msg) {
    const sugg = document.getElementById('chatbot-sugg');
    if (sugg) sugg.style.display = 'none';
    await this._sendMessage(msg);
  },

  async _sendInput() {
    const input = document.getElementById('chatbot-input');
    const msg = input?.value.trim();
    if (!msg) return;
    input.value = '';
    await this._sendMessage(msg);
  },

  async _sendMessage(msg) {
    const msgs = document.getElementById('chatbot-msgs');
    const send = document.getElementById('chatbot-send');
    const input = document.getElementById('chatbot-input');
    if (!msgs) return;

    /* Message utilisateur */
    const uDiv = document.createElement('div');
    uDiv.style.cssText = 'background:linear-gradient(135deg,#0C3320,#1a5c38);color:var(--or,#C9A84C);border-radius:10px 10px 0 10px;padding:.65rem .85rem;font-size:.82rem;max-width:88%;align-self:flex-end;margin-left:auto';
    uDiv.textContent = msg;
    msgs.appendChild(uDiv);
    msgs.scrollTop = msgs.scrollHeight;

    /* Typing */
    const typing = document.createElement('div');
    typing.style.cssText = 'background:rgba(12,51,32,.06);border-radius:10px;padding:.65rem .85rem;font-size:.82rem;max-width:70%;color:var(--gris-d);border-left:2px solid var(--vert,#0C3320)';
    typing.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;

    if (send) send.disabled = true;
    if (input) input.disabled = true;

    try {
      const reply = await this.send(msg);
      if (typing) typing.remove();
      const bDiv = document.createElement('div');
      bDiv.style.cssText = 'background:linear-gradient(135deg,rgba(12,51,32,.06),rgba(12,51,32,.03));border-radius:10px 10px 10px 0;padding:.65rem .85rem;font-size:.82rem;color:var(--text);max-width:92%;border-left:2px solid var(--vert,#0C3320);white-space:pre-wrap;line-height:1.5';
      bDiv.textContent = reply;
      msgs.appendChild(bDiv);
    } catch(e) {
      if (typing) typing.remove();
      const errDiv = document.createElement('div');
      errDiv.style.cssText = 'background:#fee2e2;border-radius:10px;padding:.65rem .85rem;font-size:.78rem;color:#991b1b;max-width:88%;border:1px solid #fca5a5';
      const isMissingKey = e.message && (e.message.includes('Clé') || e.message.includes('API'));
      errDiv.textContent = isMissingKey 
        ? '🤖 Configuration IA en attente par l\'administrateur. Veuillez patienter ou nous écrire sur WhatsApp.'
        : 'Service temporairement indisponible. Contactez-nous sur WhatsApp ! 📱';
      msgs.appendChild(errDiv);
    } finally {
      if (send) send.disabled = false;
      if (input) { input.disabled = false; input.focus(); }
      msgs.scrollTop = msgs.scrollHeight;
    }
  },
};

/* Activer le chatbot sur les pages publiques (pas admin) */
if (!window.location.pathname.includes('admin')) {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => PublicChatbot.init(), 1000);
  });
}


/* ══════════════════════════════════════════════════════════
   8. AVIS CLIENTS AVEC PHOTOS
   Extension de la soumission d'avis pour inclure une photo
══════════════════════════════════════════════════════════ */
window.initAvisAvecPhoto = function(formId) {
  const form = document.getElementById(formId);
  if (!form || !window.sb) return;

  /* Ajouter le champ photo si absent */
  if (form.querySelector('#avis-photo-input')) return;

  const photoGroup = document.createElement('div');
  photoGroup.style.cssText = 'margin-bottom:1rem';
  photoGroup.innerHTML = `
    <label style="display:block;font-size:.88rem;font-weight:600;margin-bottom:.4rem;color:var(--vert,#0C3320)">
      <i class="fas fa-camera" style="color:var(--or,#C9A84C);margin-right:.3rem"></i>
      Ajoutez une photo (optionnel)
    </label>
    <div style="position:relative;border:2px dashed var(--border,#e5e7eb);border-radius:12px;padding:1.25rem;text-align:center;cursor:pointer;transition:border-color .2s" id="avis-photo-zone">
      <input type="file" id="avis-photo-input" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer" capture="environment">
      <i class="fas fa-image" style="font-size:1.5rem;color:var(--gris-d,#ccc);display:block;margin-bottom:.35rem"></i>
      <div style="font-size:.82rem;color:var(--gris-d)">Cliquez ou prenez une photo de votre coiffure</div>
      <div id="avis-photo-preview" style="margin-top:.75rem"></div>
    </div>
  `;

  /* Insérer avant le bouton submit */
  const submitBtn = form.querySelector('[type="submit"], button:last-of-type');
  if (submitBtn) submitBtn.before(photoGroup);
  else form.appendChild(photoGroup);

  /* Prévisualisation */
  document.getElementById('avis-photo-input')?.addEventListener('change', function() {
    const file = this.files[0];
    const preview = document.getElementById('avis-photo-preview');
    const zone = document.getElementById('avis-photo-zone');
    if (!file || !preview) return;
    const url = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${url}" style="max-width:100%;max-height:140px;border-radius:8px;object-fit:cover">`;
    zone.style.borderColor = 'var(--or,#C9A84C)';
    zone.style.borderStyle = 'solid';
  });
};

/* Patcher sb.avis.create pour inclure la photo */
if (window.sb?.avis) {
  const _origAvisCreate = sb.avis.create.bind(sb.avis);
  sb.avis.create = async function(data) {
    /* Uploader la photo si présente */
    const photoInput = document.getElementById('avis-photo-input');
    if (photoInput?.files?.[0]) {
      try {
        const photoUrl = await sb.publicUpload('avis', photoInput.files[0]);
        data.photo_url = photoUrl;
      } catch(e) {
        console.warn('[AvisPhoto] Upload failed:', e.message);
      }
    }
    return _origAvisCreate(data);
  };
}


/* ══════════════════════════════════════════════════════════
   10. IMPORT CSV RENDEZ-VOUS (Admin)
══════════════════════════════════════════════════════════ */
window.importRdvCSV = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  input.onchange = async function() {
    const file = this.files[0];
    if (!file) return;
    const toast = window.toast || window.showToast;
    toast?.('Import en cours…', 'info');

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast?.('Fichier CSV vide ou invalide', 'error'); return; }

    /* Parser l'en-tête */
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    const FIELD_MAP = {
      'nom': 'nom', 'name': 'nom',
      'téléphone': 'tel', 'tel': 'tel', 'phone': 'tel', 'telephone': 'tel',
      'email': 'email',
      'service': 'service', 'prestation': 'service',
      'date': 'date_rdv', 'date_rdv': 'date_rdv',
      'heure': 'heure', 'time': 'heure',
      'message': 'message', 'note': 'message',
    };

    let imported = 0, errors = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim());
      const rdv = { statut: 'en_attente' };

      headers.forEach((h, idx) => {
        const field = FIELD_MAP[h];
        if (field && values[idx]) rdv[field] = values[idx];
      });

      if (!rdv.nom || !rdv.tel || !rdv.service || !rdv.date_rdv) { errors++; continue; }

      try {
        await sb.rdv.create(rdv);
        imported++;
      } catch { errors++; }
    }

    toast?.(`✅ ${imported} RDV importés${errors ? ` (${errors} erreurs)` : ''}`, imported > 0 ? 'success' : 'error');
    if (imported > 0) {
      await histLog('rdv', 'Import CSV rendez-vous', `${imported} importés, ${errors} erreurs`);
      if (typeof loadRdv === 'function') loadRdv('en_attente');
    }
  };
  input.click();
};


/* ══════════════════════════════════════════════════════════
   11. DASHBOARD PERSONNALISABLE (Drag & Drop)
══════════════════════════════════════════════════════════ */
window.DashboardCustomizer = {
  KEY: 'ml_dash_order',

  getOrder() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || null; }
    catch { return null; }
  },

  saveOrder(ids) {
    localStorage.setItem(this.KEY, JSON.stringify(ids));
  },

  apply() {
    const grid = document.getElementById('dash-grid');
    if (!grid) return;
    const order = this.getOrder();
    if (!order) return;

    order.forEach(id => {
      const card = document.querySelector(`.dash-card[data-id="${id}"]`);
      if (card) grid.appendChild(card);
    });
  },

  enable() {
    const grid = document.getElementById('dash-grid');
    if (!grid) return;

    /* Attribuer des IDs aux cards */
    grid.querySelectorAll('.dash-card').forEach((card, i) => {
      if (!card.dataset.id) card.dataset.id = `card-${i}`;
      card.draggable = true;
      card.style.cursor = 'grab';
      card.style.transition = 'opacity .2s, transform .2s';
    });

    let dragging = null;

    grid.addEventListener('dragstart', e => {
      dragging = e.target.closest('.dash-card');
      if (dragging) { dragging.style.opacity = '.5'; dragging.style.cursor = 'grabbing'; }
    });

    grid.addEventListener('dragover', e => {
      e.preventDefault();
      const target = e.target.closest('.dash-card');
      if (!target || target === dragging) return;
      const rect = target.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      if (e.clientX < mid) grid.insertBefore(dragging, target);
      else grid.insertBefore(dragging, target.nextSibling);
    });

    grid.addEventListener('dragend', () => {
      if (dragging) { dragging.style.opacity = ''; dragging.style.cursor = 'grab'; dragging = null; }
      /* Sauvegarder l'ordre */
      const ids = [...grid.querySelectorAll('.dash-card')].map(c => c.dataset.id);
      this.saveOrder(ids);
    });

    /* Ajouter le bouton de reset */
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-sm btn-outline';
    resetBtn.style.cssText = 'font-size:.75rem;margin-left:auto';
    resetBtn.innerHTML = '<i class="fas fa-undo"></i> Réinitialiser';
    resetBtn.onclick = () => { localStorage.removeItem(this.KEY); if (typeof loadDashboard === 'function') loadDashboard(); };

    const panel = document.getElementById('panel-dashboard');
    const header = panel?.querySelector('.panel-header');
    if (header) header.style.display = 'flex', header.style.alignItems = 'center', header.appendChild(resetBtn);
  },
};

/* Activer après le chargement du dashboard */
document.addEventListener('ml:login-success', () => {
  setTimeout(() => {
    DashboardCustomizer.apply();
    DashboardCustomizer.enable();
  }, 1500);
});


/* ══════════════════════════════════════════════════════════
   12. HISTORIQUE DES MODIFICATIONS ADMIN
   Enrichit la table historique avec plus de détails
══════════════════════════════════════════════════════════ */
window.ModifHistory = {

  /* Patcher les opérations CRUD pour logger automatiquement */
  init() {
    if (!window.sb) return;

    /* Blog */
    const _blogUpdate = sb.blog?.update?.bind(sb.blog);
    if (_blogUpdate) {
      sb.blog.update = async function(id, data) {
        const old = await sb.blog.get(id).catch(() => null);
        const result = await _blogUpdate(id, data);
        if (old) await histLog('blog', `Article modifié : "${data.titre || old.titre}"`,
          `Champs: ${Object.keys(data).join(', ')}`).catch(() => {});
        return result;
      };
    }

    /* Services */
    const _svcUpdate = sb.services?.update?.bind(sb.services);
    if (_svcUpdate) {
      sb.services.update = async function(id, data) {
        const result = await _svcUpdate(id, data);
        await histLog('service', `Service modifié : "${data.nom || '#'+id}"`,
          `Champs: ${Object.keys(data).join(', ')}`).catch(() => {});
        return result;
      };
    }

    /* Galerie */
    const _galUpdate = sb.galerie?.update?.bind(sb.galerie);
    if (_galUpdate) {
      sb.galerie.update = async function(id, data) {
        const result = await _galUpdate(id, data);
        await histLog('galerie', `Photo modifiée : "${data.titre || '#'+id}"`,
          `Champs: ${Object.keys(data).join(', ')}`).catch(() => {});
        return result;
      };
    }
  },

  /* Afficher l'historique avec couleurs et icônes enrichis */
  async render(containerId, limit = 100) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement…</div>';

    try {
      const logs = await sb._get('historique', `order=created_at.desc&limit=${limit}`);
      const _escLog = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if (!logs.length) { el.innerHTML = '<div class="empty-state"><i class="fas fa-history"></i><p>Aucune modification enregistrée.</p></div>'; return; }

      const TYPE_CONFIG = {
        rdv:       { icon: 'calendar-check', color: '#10b981', label: 'Rendez-vous' },
        blog:      { icon: 'newspaper',      color: '#3b82f6', label: 'Blog' },
        galerie:   { icon: 'images',         color: '#8b5cf6', label: 'Galerie' },
        avis:      { icon: 'star',           color: '#f59e0b', label: 'Avis' },
        service:   { icon: 'cut',            color: '#ec4899', label: 'Prestation' },
        connexion: { icon: 'sign-in-alt',    color: '#6b7280', label: 'Connexion' },
        autre:     { icon: 'info-circle',    color: '#0C3320', label: 'Autre' },
      };

      el.innerHTML = `<div style="display:flex;flex-direction:column;gap:.35rem">
        ${logs.map(log => {
          const cfg = TYPE_CONFIG[log.type] || TYPE_CONFIG.autre;
          const date = new Date(log.created_at);
          const dateStr = date.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
          const isAlert = log.message?.includes('⚠️') || log.message?.includes('ERREUR') || log.message?.includes('ÉCHOUÉE');
          return `
            <div style="display:flex;align-items:flex-start;gap:.75rem;padding:.6rem .85rem;background:${isAlert?'#fef2f2':'var(--bg,#f9fafb)'};border-radius:10px;border-left:3px solid ${isAlert?'#ef4444':cfg.color}">
              <div style="width:28px;height:28px;border-radius:50%;background:${cfg.color}20;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">
                <i class="fas fa-${cfg.icon}" style="font-size:.7rem;color:${cfg.color}"></i>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-size:.85rem;font-weight:600;color:var(--text)">${_escLog(log.message || '')}</div>
                ${log.detail ? `<div style="font-size:.75rem;color:var(--gris-d);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_escLog(log.detail)}</div>` : ''}
                <div style="font-size:.7rem;color:var(--gris-d);margin-top:3px">${dateStr}</div>
              </div>
              <span style="font-size:.68rem;background:${cfg.color}15;color:${cfg.color};padding:2px 7px;border-radius:20px;font-weight:600;flex-shrink:0">${cfg.label}</span>
            </div>`;
        }).join('')}
      </div>`;
    } catch(e) {
      el.innerHTML = `<div style="color:var(--danger);padding:1rem;background:#fee2e2;border-radius:12px"><i class="fas fa-exclamation-triangle"></i> Erreur : ${_escChat(e.message)}</div>`;
    }
  },
};

/* Initialiser les logs de modifications */
document.addEventListener('ml:login-success', () => {
  setTimeout(() => ModifHistory.init(), 500);
});
