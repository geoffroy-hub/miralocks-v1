/* ============================================================
   Miralocks — admin-communication.js  v1.0
   Communication & internationalisation :
   4.  Newsletter par email
   5.  Notifications push PWA
   6.  Partage de galerie
   10. Traduction EN complète (amélioration lang.js)
   11. Affichage prix multi-devises
   ============================================================ */

/* Helper : échappement HTML pour éviter les injections XSS */
const _escComm = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

/* ══════════════════════════════════════════════════════════
   4. NEWSLETTER
   Table : newsletter_abonnes (email, nom, actif, created_at)
   Stockée dans Supabase principal
══════════════════════════════════════════════════════════ */
window.Newsletter = {

  /* Escape HTML pour prévenir XSS */
  _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  /* Inscription (côté public) */
  async subscribe(email, nom) {
    email = (email||'').trim().toLowerCase();
    if (!email || !email.includes('@')) throw new Error('Email invalide');
    const r = await fetch(`${SUPABASE_URL}/rest/v1/newsletter_abonnes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Prefer': 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify({ email, nom: nom||'', actif: true }),
    });
    if (!r.ok && r.status !== 409) {
      const e = await r.json().catch(()=>({}));
      throw new Error(e.message || 'Erreur inscription');
    }
    return true;
  },

  /* Liste admin */
  async list() {
    const s = await sb.getValidSession();
    return sb._get('newsletter_abonnes', 'order=created_at.desc');
  },

  /* Désinscrire */
  async unsubscribe(id) {
    return sb._patch('newsletter_abonnes', id, { actif: false });
  },

  /* Supprimer */
  async delete(id) {
    return sb._delete('newsletter_abonnes', id);
  },

  /* Panel admin */
  async renderPanel(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const list = await this.list();
      const actifs = list.filter(a=>a.actif);
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem">
          <div>
            <strong style="color:var(--vert,#0C3320)">${actifs.length} abonné(s) actif(s)</strong>
            <span style="color:var(--gris-d);font-size:.8rem;margin-left:.5rem">${list.length} total</span>
          </div>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn-sm btn-outline" onclick="Newsletter.exportCSV()"><i class="fas fa-download"></i> Export</button>
            <button class="btn btn-sm" style="background:var(--vert,#0C3320);color:var(--or,#C9A84C)" onclick="Newsletter.openCampaignModal()"><i class="fas fa-paper-plane"></i> Campagne</button>
          </div>
        </div>
        ${!list.length ? '<p style="color:var(--gris-d);font-size:.85rem;text-align:center;padding:1rem">Aucun abonné pour le moment.</p>' : `
        <div style="max-height:300px;overflow-y:auto">
          ${list.map(a=>`
            <div style="display:flex;align-items:center;gap:.75rem;padding:.5rem .75rem;background:var(--bg,#f9fafb);border-radius:8px;margin-bottom:.35rem;border-left:3px solid ${a.actif?'#10b981':'#e5e7eb'}">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${this._esc(a.email)}</div>
                ${a.nom?`<div style="font-size:.75rem;color:var(--gris-d)">${this._esc(a.nom)}</div>`:''}
              </div>
              <span style="font-size:.72rem;padding:2px 7px;border-radius:20px;${a.actif?'background:#d1fae5;color:#065f46':'background:#f3f4f6;color:#6b7280'}">${a.actif?'Actif':'Inactif'}</span>
              <button class="btn btn-sm btn-danger" style="padding:3px 7px" onclick="Newsletter.delete(${a.id}).then(()=>Newsletter.renderPanel('${containerId}'))"><i class="fas fa-trash"></i></button>
            </div>`).join('')}
        </div>`}`;
    } catch(e) {
      el.innerHTML = `<p style="color:var(--danger);font-size:.85rem">Erreur : ${_escComm(e.message)}</p>`;
    }
  },

  exportCSV() {
    this.list().then(list => {
      const csv = '\uFEFF' + 'Email,Nom,Actif,Date inscription\r\n' +
        list.map(a=>`${a.email},${a.nom||''},${a.actif?'Oui':'Non'},${new Date(a.created_at).toLocaleDateString('fr-FR')}`).join('\r\n');
      const blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href=url; a.download=`newsletter_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      (window.toast||window.showToast)?.('Export CSV téléchargé !','success');
    });
  },

  openCampaignModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto';
    modal.innerHTML = `
      <div style="background:var(--bg-card,#fff);border-radius:20px;padding:2rem;max-width:520px;width:100%">
        <h3 style="margin:0 0 1rem;color:var(--vert,#0C3320)"><i class="fas fa-paper-plane" style="color:var(--or,#C9A84C);margin-right:.4rem"></i>Envoyer une campagne</h3>
        <div style="margin-bottom:.75rem">
          <label style="display:block;font-size:.85rem;font-weight:600;margin-bottom:.35rem">Sujet</label>
          <input type="text" id="campaign-subject" placeholder="Ex: Nouveautés Miralocks – Août 2026" style="width:100%;border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:.6rem .75rem">
        </div>
        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.85rem;font-weight:600;margin-bottom:.35rem">Message (HTML ou texte)</label>
          <textarea id="campaign-body" style="width:100%;min-height:140px;border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:.6rem .75rem;font-family:inherit;font-size:.88rem;resize:vertical" placeholder="Bonjour {{nom}},&#10;&#10;Voici nos actualités du mois…"></textarea>
          <div style="font-size:.75rem;color:var(--gris-d);margin-top:.25rem">Utilisez <code>{{nom}}</code> pour personnaliser avec le prénom de l'abonné.</div>
        </div>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:.75rem;font-size:.82rem;color:#92400e;margin-bottom:1rem">
          <i class="fas fa-info-circle"></i> La campagne sera envoyée via l'Edge Function <code>send-newsletter</code>. Assurez-vous qu'elle est déployée dans Supabase.
        </div>
        <div style="display:flex;gap:.75rem;justify-content:flex-end">
          <button class="btn btn-outline btn-sm" onclick="this.closest('[style*=fixed]').remove()">Annuler</button>
          <button class="btn btn-sm" style="background:var(--vert,#0C3320);color:var(--or,#C9A84C)" onclick="Newsletter._sendCampaign(this)">
            <i class="fas fa-paper-plane"></i> Envoyer
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  },

  async _sendCampaign(btn) {
    const subject = document.getElementById('campaign-subject')?.value.trim();
    const body = document.getElementById('campaign-body')?.value.trim();
    if (!subject || !body) { (window.toast||window.showToast)?.('Remplissez le sujet et le message','error'); return; }
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block"></div> Envoi…';
    try {
      await sb.invoke('send-newsletter', { subject, body });
      (window.toast||window.showToast)?.('Campagne envoyée !','success');
      await histLog('autre','Campagne newsletter envoyée', subject);
      btn.closest('[style*=fixed]').remove();
    } catch(e) {
      (window.toast||window.showToast)?.('Erreur : '+e.message,'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-paper-plane"></i> Envoyer';
    }
  },
};

/* Widget d'inscription newsletter (côté public) */
window.initNewsletterWidget = function(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(12,51,32,.05),rgba(201,168,76,.08));border:1px solid rgba(201,168,76,.2);border-radius:14px;padding:1.5rem;margin:1.5rem 0">
      <h4 style="margin:0 0 .5rem;color:var(--vert,#0C3320);font-size:1rem"><i class="fas fa-envelope" style="color:var(--or,#C9A84C);margin-right:.4rem"></i>Restez informé(e)</h4>
      <p style="font-size:.85rem;color:var(--gris-d);margin-bottom:.75rem">Recevez nos actualités, conseils locks et offres exclusives.</p>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <input type="email" id="nl-email" placeholder="votre@email.com" style="flex:1;min-width:200px;border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:.55rem .75rem;font-size:.88rem">
        <button class="btn btn-or" id="nl-btn" onclick="Newsletter._publicSubscribe()" style="font-size:.85rem;padding:.55rem 1rem">S'abonner</button>
      </div>
      <div id="nl-result" style="font-size:.8rem;margin-top:.4rem;min-height:1em"></div>
    </div>`;
};

Newsletter._publicSubscribe = async function() {
  const email = document.getElementById('nl-email')?.value;
  const result = document.getElementById('nl-result');
  const btn = document.getElementById('nl-btn');
  if (!email) return;
  btn.disabled = true;
  if (result) result.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inscription…';
  try {
    await Newsletter.subscribe(email);
    if (result) result.innerHTML = '<span style="color:#10b981"><i class="fas fa-check-circle"></i> Merci ! Vous êtes inscrit(e).</span>';
    document.getElementById('nl-email').value = '';
  } catch(e) {
    if (result) result.innerHTML = `<span style="color:#ef4444">${_escComm(e.message)}</span>`;
  } finally { btn.disabled = false; }
};


/* ══════════════════════════════════════════════════════════
   5. NOTIFICATIONS PUSH PWA
   Utilise l'API Notifications native + Service Worker
══════════════════════════════════════════════════════════ */
window.PushNotif = {

  async requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  },

  async send(title, body, opts={}) {
    if (!(await this.requestPermission())) return false;
    const reg = await navigator.serviceWorker.ready.catch(()=>null);
    if (reg) {
      reg.showNotification(title, {
        body,
        icon: '/assets/logo-vert.png',
        badge: '/assets/favicon-32.png',
        tag: opts.tag || 'miralocks-notif',
        renotify: true,
        data: { url: opts.url || '/' },
        actions: opts.actions || [],
        ...opts,
      });
    } else {
      new Notification(title, { body, icon: '/assets/logo-vert.png' });
    }
    return true;
  },

  /* Envoyer depuis l'admin */
  openAdminModal() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    modal.innerHTML = `
      <div style="background:var(--bg-card,#fff);border-radius:20px;padding:2rem;max-width:420px;width:100%">
        <h3 style="margin:0 0 1rem;color:var(--vert,#0C3320)"><i class="fas fa-bell" style="color:var(--or,#C9A84C);margin-right:.4rem"></i>Envoyer une notification push</h3>
        <p style="font-size:.82rem;color:var(--gris-d);margin-bottom:1rem">Envoyée aux visiteurs qui ont accepté les notifications (onglet ouvert ou PWA installée).</p>
        <div style="margin-bottom:.75rem">
          <label style="display:block;font-size:.85rem;font-weight:600;margin-bottom:.35rem">Titre</label>
          <input type="text" id="push-title" placeholder="Ex: Promo spéciale ce weekend !" style="width:100%;border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:.6rem .75rem">
        </div>
        <div style="margin-bottom:.75rem">
          <label style="display:block;font-size:.85rem;font-weight:600;margin-bottom:.35rem">Message</label>
          <textarea id="push-body" style="width:100%;min-height:80px;border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:.6rem .75rem;font-family:inherit;font-size:.88rem;resize:vertical" placeholder="Profitez de -15% sur tous les resserrages ce samedi !"></textarea>
        </div>
        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.85rem;font-weight:600;margin-bottom:.35rem">Lien (optionnel)</label>
          <input type="url" id="push-url" placeholder="https://miralocks.tg/rendezvous.html" style="width:100%;border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:.6rem .75rem">
        </div>
        <div style="display:flex;gap:.75rem;justify-content:flex-end">
          <button class="btn btn-outline btn-sm" onclick="this.closest('[style*=fixed]').remove()">Annuler</button>
          <button class="btn btn-sm" style="background:var(--vert,#0C3320);color:var(--or,#C9A84C)" onclick="
            const t=document.getElementById('push-title').value;
            const b=document.getElementById('push-body').value;
            const u=document.getElementById('push-url').value||'/';
            if(!t||!b){window.toast?.('Remplissez le titre et le message','error');return;}
            PushNotif.send(t,b,{url:u}).then(ok=>{
              if(ok){window.toast?.('Notification envoyée !','success');histLog('autre','Push notification envoyée',t);}
              else window.toast?.('Permission refusée ou non supportée','error');
              this.closest('[style*=fixed]').remove();
            });
          "><i class="fas fa-bell"></i> Envoyer</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });
  },
};

/* Demander la permission push au chargement (pages publiques) */
if (!window.location.pathname.includes('admin')) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      if ('Notification' in window && Notification.permission === 'default') {
        /* Attendre une interaction utilisateur avant de demander */
        const askOnce = () => {
          PushNotif.requestPermission();
          document.removeEventListener('click', askOnce);
        };
        document.addEventListener('click', askOnce, { once: true });
      }
    }, 3000);
  });
}


/* ══════════════════════════════════════════════════════════
   6. PARTAGE DE GALERIE
   Bouton share sur chaque photo de la galerie
══════════════════════════════════════════════════════════ */
window.sharePhoto = async function(photoUrl, titre) {
  const shareData = {
    title: titre || 'Réalisation Miralocks',
    text: `✨ Découvrez cette réalisation de l'Institut MiraLocks à Lomé ! 🌿\n${titre||''}`,
    url: photoUrl,
  };

  if (navigator.share) {
    try { await navigator.share(shareData); return; } catch(e) { if(e.name==='AbortError') return; }
  }

  /* Fallback : menu de partage personnalisé */
  const existing = document.getElementById('share-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id = 'share-menu';
  menu.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:1rem';
  const waMsg = encodeURIComponent(`${shareData.text}\n${photoUrl}`);
  menu.innerHTML = `
    <div style="background:var(--bg-card,#fff);border-radius:20px 20px 0 0;padding:1.5rem;width:100%;max-width:420px">
      <h4 style="margin:0 0 1rem;text-align:center;color:var(--vert,#0C3320)">Partager cette photo</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1rem">
        <a href="https://wa.me/?text=${waMsg}" target="_blank" rel="noopener"
          style="display:flex;flex-direction:column;align-items:center;gap:.35rem;padding:.75rem;background:#25D366;color:#fff;border-radius:12px;text-decoration:none;font-size:.78rem;font-weight:600">
          <i class="fab fa-whatsapp" style="font-size:1.4rem"></i>WhatsApp
        </a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(photoUrl)}" target="_blank" rel="noopener"
          style="display:flex;flex-direction:column;align-items:center;gap:.35rem;padding:.75rem;background:#1877F2;color:#fff;border-radius:12px;text-decoration:none;font-size:.78rem;font-weight:600">
          <i class="fab fa-facebook-f" style="font-size:1.4rem"></i>Facebook
        </a>
        <button onclick="navigator.clipboard.writeText('${photoUrl}').then(()=>{window.toast?.('Lien copié !','success');document.getElementById('share-menu').remove()})"
          style="display:flex;flex-direction:column;align-items:center;gap:.35rem;padding:.75rem;background:var(--bg,#f4f4f4);color:var(--text);border:none;border-radius:12px;cursor:pointer;font-size:.78rem;font-weight:600">
          <i class="fas fa-link" style="font-size:1.4rem"></i>Copier
        </button>
      </div>
      <button onclick="document.getElementById('share-menu').remove()" style="width:100%;padding:.75rem;background:var(--bg,#f4f4f4);border:none;border-radius:12px;cursor:pointer;font-size:.9rem;color:var(--gris-d)">Annuler</button>
    </div>`;
  document.body.appendChild(menu);
  menu.addEventListener('click', e=>{ if(e.target===menu) menu.remove(); });
};

/* Injecter les boutons de partage sur la galerie publique */
window.initGalleryShare = function() {
  document.querySelectorAll('.gallery-item, .galerie-item, [class*="gallery"] img').forEach(item => {
    if (item.querySelector('.share-btn')) return;
    const img = item.tagName==='IMG' ? item : item.querySelector('img');
    if (!img) return;

    const btn = document.createElement('button');
    btn.className = 'share-btn';
    btn.style.cssText = 'position:absolute;top:.5rem;right:.5rem;background:rgba(0,0,0,.55);color:#fff;border:none;border-radius:50%;width:34px;height:34px;cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;z-index:2';
    btn.innerHTML = '<i class="fas fa-share-alt"></i>';
    btn.onclick = e => { e.stopPropagation(); sharePhoto(img.src, img.alt); };

    const wrapper = img.closest('[style*="position"]') || img.parentElement;
    if (wrapper && getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';
    wrapper?.appendChild(btn);

    item.addEventListener('mouseenter', ()=>btn.style.opacity='1');
    item.addEventListener('mouseleave', ()=>btn.style.opacity='0');
  });
};

/* Activer sur les pages galerie */
if (!window.location.pathname.includes('admin')) {
  document.addEventListener('DOMContentLoaded', ()=>setTimeout(initGalleryShare, 500));
}


/* ══════════════════════════════════════════════════════════
   11. AFFICHAGE PRIX EN PLUSIEURS DEVISES
   FCFA → EUR, USD avec taux stockés dans site_settings
══════════════════════════════════════════════════════════ */
window.CurrencyConverter = {
  RATES: { FCFA: 1, EUR: 0.00152, USD: 0.00165 },
  current: 'FCFA',
  SYMBOLS: { FCFA: 'FCFA', EUR: '€', USD: '$' },

  async loadRates() {
    try {
      const raw = await sb.settings.get('currency_rates');
      if (raw) this.RATES = { FCFA: 1, ...JSON.parse(raw) };
    } catch { /* utiliser les taux par défaut */ }
    const saved = localStorage.getItem('ml_currency') || 'FCFA';
    if (this.RATES[saved]) this.current = saved;
  },

  convert(fcfaAmount) {
    const n = parseInt(String(fcfaAmount).replace(/\D/g,'')) || 0;
    const converted = Math.round(n * this.RATES[this.current]);
    return `${converted.toLocaleString('fr-FR')} ${this.SYMBOLS[this.current]}`;
  },

  setCurrency(code) {
    if (!this.RATES[code]) return;
    this.current = code;
    localStorage.setItem('ml_currency', code);
    this.updateAllPrices();
    document.querySelectorAll('[data-currency-btn]').forEach(b=>{
      b.style.fontWeight = b.dataset.currencyBtn === code ? '700' : '400';
      b.style.color = b.dataset.currencyBtn === code ? 'var(--or,#C9A84C)' : '';
    });
  },

  updateAllPrices() {
    document.querySelectorAll('[data-price-fcfa]').forEach(el => {
      const raw = el.dataset.priceFcfa;
      el.textContent = this.convert(raw);
    });
  },

  injectSelector(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:.35rem;font-size:.8rem">
        <span style="color:var(--gris-d)"><i class="fas fa-coins"></i></span>
        ${Object.keys(this.RATES).map(c=>`
          <button data-currency-btn="${c}"
            onclick="CurrencyConverter.setCurrency('${c}')"
            style="background:none;border:none;cursor:pointer;font-size:.8rem;padding:2px 5px;border-radius:4px;font-weight:${this.current===c?'700':'400'};color:${this.current===c?'var(--or,#C9A84C)':'var(--gris-d)'}">${c}</button>
        `).join('<span style="color:var(--gris-d)">/</span>')}
      </div>`;
  },
};

/* Initialiser le convertisseur sur les pages publiques */
if (!window.location.pathname.includes('admin')) {
  document.addEventListener('DOMContentLoaded', async () => {
    await CurrencyConverter.loadRates();

    /* Convertir tous les prix avec l'attribut data-price-fcfa */
    CurrencyConverter.updateAllPrices();

    /* Injecter le sélecteur dans la navbar si un conteneur existe */
    const navCurrency = document.getElementById('currency-selector');
    if (navCurrency) CurrencyConverter.injectSelector('currency-selector');
  });
}


/* ══════════════════════════════════════════════════════════
   INJECTION DANS L'ADMIN — Nouveaux panneaux paramètres
══════════════════════════════════════════════════════════ */
/* Enregistrement dans le Registry central (admin-settings.js) */
if (window.ParamRegistry) {
  window.ParamRegistry.register(async () => {
    if (window.Newsletter && typeof window.Newsletter.renderPanel === 'function') {
      await window.Newsletter.renderPanel('section-newsletter');
    }
  });
}
