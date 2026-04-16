/* ============================================================
   Miralocks — public-features.js  v1.0
   Nouvelles fonctionnalités pages publiques :
   1.  Rappels 24h avant RDV (SQL cron)
   2.  Créneaux disponibles dans le formulaire RDV
   3.  Réponses automatiques aux avis (admin)
   4.  Page de suivi RDV client (lien unique)
   5.  Codes promo / réductions
   6.  Rappel acompte impayé (admin)
   7.  Mode sombre sur le site public (déjà présent, amélioré)
   8.  Chatbot WhatsApp contextuel (déjà présent, amélioré)
   9.  Galerie avant/après (déjà présent, confirmé)
   ============================================================ */


/* ══════════════════════════════════════════════════════════
   2. CRÉNEAUX DISPONIBLES
   Charge les dates/heures déjà prises depuis Supabase
   et les affiche visuellement dans le formulaire RDV
══════════════════════════════════════════════════════════ */
window.initCreneauxDisponibles = async function(dateInputId) {
  const dateInput = document.getElementById(dateInputId);
  if (!dateInput || !window.sb) return;

  /* Conteneur d'info sous le champ date */
  let infoEl = document.getElementById('creneau-info');
  if (!infoEl) {
    infoEl = document.createElement('div');
    infoEl.id = 'creneau-info';
    infoEl.style.cssText = 'font-size:.82rem;margin-top:.4rem;min-height:1.2em;';
    dateInput.after(infoEl);
  }

  /* Charger les RDV non annulés des 60 prochains jours */
  let busyDates = {};
  try {
    const today = new Date().toISOString().slice(0, 10);
    const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const rdvs = await sb._get('rendezvous',
      `date_rdv=gte.${today}&date_rdv=lte.${in60}&statut=neq.annule&select=date_rdv,heure`
    );
    rdvs.forEach(r => {
      if (!busyDates[r.date_rdv]) busyDates[r.date_rdv] = [];
      if (r.heure) busyDates[r.date_rdv].push(r.heure);
    });
  } catch (e) { /* silencieux — ne pas bloquer le formulaire */ }

  /* Charger les fermetures programmées */
  let closedDates = [];
  try {
    const rawF = await sb.settings.get('dates_fermetures').catch(()=>null);
    if (rawF) closedDates = JSON.parse(rawF).map(f=>f.date);
  } catch { /* silencieux */ }


  /* Empêcher les dimanches et les dates avec 4+ RDV */
  dateInput.addEventListener('input', () => {
    const val = dateInput.value;
    if (!val) { infoEl.innerHTML = ''; return; }

    const d = new Date(val + 'T12:00:00');
    if (closedDates.includes(val)) {
      infoEl.innerHTML = `<span style="color:#ef4444"><i class="fas fa-ban"></i> Institut fermé ce jour (congé)</span>`;
      dateInput.setCustomValidity('Institut fermé ce jour');
      return;
    }
    if (d.getDay() === 0) {
      infoEl.innerHTML = `<span style="color:#ef4444"><i class="fas fa-times-circle"></i> Fermé le dimanche</span>`;
      dateInput.setCustomValidity('Fermé le dimanche');
      return;
    }

    const heures = busyDates[val] || [];
    const count = heures.length;

    dateInput.setCustomValidity('');

    if (count === 0) {
      infoEl.innerHTML = `<span style="color:#10b981"><i class="fas fa-check-circle"></i> Disponible — journée libre</span>`;
    } else if (count < 3) {
      infoEl.innerHTML = `<span style="color:#f59e0b"><i class="fas fa-exclamation-circle"></i> ${count} rendez-vous ce jour — encore des places</span>`;
    } else if (count < 5) {
      infoEl.innerHTML = `<span style="color:#ef4444"><i class="fas fa-clock"></i> Journée chargée — préférez une autre date</span>`;
    } else {
      infoEl.innerHTML = `<span style="color:#ef4444"><i class="fas fa-ban"></i> Journée complète — choisissez une autre date</span>`;
      dateInput.setCustomValidity('Journée complète');
    }
  });
};


/* ══════════════════════════════════════════════════════════
   3. RÉPONSES AUTOMATIQUES AUX AVIS (côté admin)
   Suggère un brouillon selon le nombre d'étoiles
══════════════════════════════════════════════════════════ */
window.generateAvisReply = function(etoiles, nom) {
  const prenom = (nom || 'cher(e) client(e)').split(' ')[0];

  if (etoiles >= 5) {
    return `Merci infiniment ${prenom} ! 🌿 Votre confiance nous touche énormément. C'est une vraie motivation de vous savoir satisfait(e). On vous attend très bientôt !`;
  } else if (etoiles >= 4) {
    return `Merci pour votre retour ${prenom} ! Nous sommes ravis que votre expérience ait été positive. N'hésitez pas à nous faire part de vos suggestions pour faire encore mieux. À bientôt !`;
  } else if (etoiles >= 3) {
    return `Merci ${prenom} pour votre avis honnête. Nous prenons vos remarques très au sérieux et travaillons continuellement à améliorer notre service. N'hésitez pas à nous contacter directement pour en discuter.`;
  } else {
    return `Bonjour ${prenom}, nous sommes sincèrement désolés que votre expérience n'ait pas été à la hauteur de vos attentes. Votre satisfaction est notre priorité. Pourriez-vous nous contacter directement pour que nous puissions arranger les choses ?`;
  }
};

/* Injecter le bouton "Suggérer une réponse" dans chaque avis (panel admin) */
window.injectAvisReplyButtons = function() {
  document.querySelectorAll('[data-avis-id]').forEach(card => {
    if (card.querySelector('.btn-reply-avis')) return;
    const etoiles = parseInt(card.dataset.etoiles) || 5;
    const nom = card.dataset.nom || '';
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-outline btn-reply-avis';
    btn.style.cssText = 'font-size:.75rem;margin-top:.5rem;';
    btn.innerHTML = '<i class="fas fa-reply"></i> Réponse suggérée';
    btn.onclick = () => {
      const reply = generateAvisReply(etoiles, nom);
      const existing = card.querySelector('.reply-draft');
      if (existing) { existing.remove(); return; }
      const draft = document.createElement('div');
      draft.className = 'reply-draft';
      draft.style.cssText = 'background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:.75rem;margin-top:.5rem;font-size:.82rem;color:#166534;';
      draft.innerHTML = `<strong style="display:block;margin-bottom:.35rem;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em">Brouillon de réponse :</strong>${reply}
        <div style="margin-top:.5rem;display:flex;gap:.5rem;">
          <button class="btn btn-sm" style="background:#10b981;color:#fff;font-size:.72rem" onclick="navigator.clipboard.writeText(\`${reply.replace(/`/g, "'")}\`);window.toast?.('Copié !','success')"><i class="fas fa-copy"></i> Copier</button>
        </div>`;
      card.appendChild(draft);
    };
    const actions = card.querySelector('.table-actions, .avis-actions');
    if (actions) actions.appendChild(btn);
    else card.appendChild(btn);
  });
};


/* ══════════════════════════════════════════════════════════
   4. PAGE DE SUIVI RDV CLIENT (LIEN UNIQUE)
   Génère un lien unique basé sur l'ID + téléphone (hash)
   Accessible sans compte sur /suivi.html
══════════════════════════════════════════════════════════ */
window.RDVTracker = {

  /* Générer un token de suivi (hash simple côté client) */
  generateToken(id, tel) {
    const raw = `${id}-${tel.replace(/\D/g, '')}-miralocks`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  },

  /* Générer l'URL de suivi */
  getTrackingUrl(id, tel) {
    const token = this.generateToken(id, tel);
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    return `${base}suivi.html?id=${id}&token=${token}`;
  },

  /* Vérifier le token (côté suivi.html) */
  verifyToken(id, tel, token) {
    return this.generateToken(id, tel) === token;
  },

  /* Charger le RDV depuis suivi.html */
  async loadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const token = params.get('token');
    if (!id || !token) return null;

    const rows = await sb._get('rendezvous', `id=eq.${id}&select=id,nom,service,date_rdv,heure,statut,tel`);
    const rdv = rows?.[0];
    if (!rdv) return null;

    /* Vérifier le token */
    if (!this.verifyToken(id, rdv.tel, token)) return null;
    return rdv;
  },
};

/* Injecter le lien de suivi dans les actions RDV admin */
window.copyTrackingLink = async function(id) {
  try {
    const rdv = await sb.rdv.get(id);
    if (!rdv) return;
    const url = window.RDVTracker.getTrackingUrl(rdv.id, rdv.tel);
    await navigator.clipboard.writeText(url);
    window.toast?.('Lien de suivi copié ! Envoyez-le au client via WhatsApp.', 'success');
  } catch (e) {
    window.toast?.('Erreur : ' + e.message, 'error');
  }
};

/* Envoyer le lien de suivi par WhatsApp */
window.sendTrackingLink = async function(id) {
  try {
    const rdv = await sb.rdv.get(id);
    if (!rdv) return;
    const url = window.RDVTracker.getTrackingUrl(rdv.id, rdv.tel);
    const msg = `Bonjour ${rdv.nom} 👋\n\nVoici votre lien pour suivre l'état de votre rendez-vous chez Miralocks :\n\n🔗 ${url}\n\nÀ bientôt ! 🌿`;
    const phone = rdv.tel.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  } catch (e) {
    window.toast?.('Erreur : ' + e.message, 'error');
  }
};


/* ══════════════════════════════════════════════════════════
   5. CODES PROMO / RÉDUCTIONS
   Stockés dans site_settings comme JSON
   Vérification côté client (affichage seulement)
══════════════════════════════════════════════════════════ */
window.PromoCode = {

  async getAll() {
    try {
      const raw = await sb.settings.get('promo_codes');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  async validate(code) {
    const codes = await this.getAll();
    const found = codes.find(c => c.code.toUpperCase() === code.trim().toUpperCase() && c.actif);
    if (!found) return null;
    /* Vérifier l'expiration */
    if (found.expires && new Date(found.expires) < new Date()) return null;
    return found;
  },

  async saveAll(codes) {
    await sb.settings.set('promo_codes', JSON.stringify(codes));
  },
};

/* Injecter le champ code promo dans le formulaire RDV */
window.initPromoField = function(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  const submitBtn = form.querySelector('[type="submit"], .btn-submit, button[class*="btn"]');
  if (!submitBtn) return;

  /* Créer le groupe code promo */
  const group = document.createElement('div');
  group.style.cssText = 'margin-bottom:1rem;';
  group.innerHTML = `
    <label for="promo-code-input" style="display:block;margin-bottom:.35rem;font-weight:600;font-size:.88rem">
      <i class="fas fa-tag" style="color:var(--or,#C9A84C);margin-right:.3rem"></i>Code promo (optionnel)
    </label>
    <div style="display:flex;gap:.5rem">
      <input type="text" id="promo-code-input" placeholder="Ex: WELCOME10"
        style="flex:1;text-transform:uppercase;letter-spacing:.05em" maxlength="20">
      <button type="button" id="promo-apply-btn" class="btn btn-outline btn-sm" style="white-space:nowrap">
        Appliquer
      </button>
    </div>
    <div id="promo-result" style="font-size:.82rem;margin-top:.35rem;min-height:1.2em"></div>
  `;
  submitBtn.before(group);

  document.getElementById('promo-apply-btn')?.addEventListener('click', async () => {
    const code = document.getElementById('promo-code-input')?.value;
    const result = document.getElementById('promo-result');
    if (!code) return;

    result.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vérification…';

    const promo = await PromoCode.validate(code);
    if (promo) {
      result.innerHTML = `<span style="color:#10b981"><i class="fas fa-check-circle"></i> Code valide : ${promo.label || promo.reduction + '% de réduction'} !</span>`;
      /* Stocker pour l'envoyer avec le RDV */
      window._activePromoCode = promo;
    } else {
      result.innerHTML = `<span style="color:#ef4444"><i class="fas fa-times-circle"></i> Code invalide ou expiré</span>`;
      window._activePromoCode = null;
    }
  });
};


/* ══════════════════════════════════════════════════════════
   6. RAPPEL ACOMPTE IMPAYÉ (Admin)
   Alerte si RDV confirmé depuis +48h sans acompte
══════════════════════════════════════════════════════════ */
window.checkAcomptesManquants = async function() {
  try {
    const all = await sb.rdv.list('confirme');
    const now = Date.now();
    const delai = 48 * 60 * 60 * 1000; // 48h

    const manquants = all.filter(r => {
      if (r.pay_acompte || r.acompte_montant > 0) return false;
      const created = new Date(r.created_at).getTime();
      return now - created > delai;
    });

    if (!manquants.length) return;

    /* Afficher une alerte dans le dashboard */
    const pending = document.getElementById('dash-pending');
    if (pending) {
      const alert = document.createElement('div');
      alert.style.cssText = 'background:#fef3c7;border:1px solid #fde68a;border-radius:var(--rayon,12px);padding:1rem 1.25rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:.6rem;';
      alert.innerHTML = `
        <span style="color:#92400e">
          <i class="fas fa-exclamation-triangle"></i>
          <strong>${manquants.length} RDV confirmé(s)</strong> sans acompte depuis +48h :
          ${manquants.map(r => `<strong>${r.nom}</strong> (${r.date_rdv})`).join(', ')}
        </span>
        <button class="btn btn-warning btn-sm" onclick="navTo('rendezvous')" style="margin-left:auto">Voir</button>
      `;
      /* Insérer en tête */
      pending.prepend(alert);
    }

    /* Envoyer un rappel WhatsApp à chaque client */
    const sendReminders = await sb.settings.get('acompte_auto_reminder');
    if (sendReminders !== 'true') return;

    for (const r of manquants) {
      const phone = r.tel?.replace(/\D/g, '');
      if (!phone) continue;
      const msg = `Bonjour ${r.nom} 👋\n\nRappel : votre rendez-vous du ${r.date_rdv} chez Miralocks est confirmé.\n\nPour le finaliser, un acompte est requis. Merci de nous contacter.\n\n🌿 MiraLocks`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      await new Promise(r => setTimeout(r, 800)); // espacer les ouvertures
    }
  } catch (e) {
    console.warn('[checkAcomptesManquants]', e.message);
  }
};

/* Déclencher après chargement du dashboard */
document.addEventListener('ml:login-success', () => {
  setTimeout(checkAcomptesManquants, 2000);
});


/* ══════════════════════════════════════════════════════════
   1. RAPPELS 24H — Cron SQL déjà géré côté serveur
   Côté client : afficher dans le dashboard les RDV de demain
══════════════════════════════════════════════════════════ */
window.loadRdvDemain = async function() {
  const el = document.getElementById('dash-today');
  if (!el) return;

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const rdvsDemain = (await sb.rdv.list(null))
      .filter(r => r.date_rdv === tomorrowStr && r.statut !== 'annule');

    if (!rdvsDemain.length) return;

    const banner = document.createElement('div');
    banner.style.cssText = 'background:linear-gradient(135deg,rgba(201,168,76,.08),rgba(12,51,32,.04));border:1px solid rgba(201,168,76,.3);border-radius:var(--rayon-lg,16px);padding:1rem 1.25rem;margin-bottom:1rem;';
    banner.innerHTML = `
      <h4 style="margin:0 0 .75rem;font-size:.9rem;color:var(--vert,#0C3320)">
        <i class="fas fa-bell" style="color:var(--or,#C9A84C);margin-right:.4rem"></i>
        ${rdvsDemain.length} rendez-vous demain
      </h4>
      ${rdvsDemain.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid rgba(0,0,0,.05)">
          <span><strong>${r.heure || '—'}</strong> · ${r.nom} · ${r.service}</span>
          <a href="https://wa.me/${(r.tel||'').replace(/\D/g,'')}?text=${encodeURIComponent(`Rappel : votre RDV Miralocks est demain à ${r.heure||''}. À bientôt ! 🌿`)}"
            target="_blank" class="btn btn-sm" style="background:#25D366;color:#fff;border:none;font-size:.72rem;padding:3px 8px">
            <i class="fab fa-whatsapp"></i> Rappel
          </a>
        </div>`).join('')}
    `;
    el.prepend(banner);
  } catch (e) { /* silencieux */ }
};

document.addEventListener('ml:login-success', () => {
  setTimeout(loadRdvDemain, 1500);
});
