/* ============================================================
   Miralocks Admin — admin-security.js  v1.0
   Sécurité avancée :
   13. 2FA complet par email OTP (table admin_2fa existante)
   14. Journal de sécurité + alerte WhatsApp nouvelle IP/appareil
   15. Expiration de session configurable
   ============================================================ */


/* ══════════════════════════════════════════════════════════
   13. AUTHENTIFICATION 2FA COMPLÈTE
   Flux : login Supabase → génère OTP → email → saisie code
   La table admin_2fa est déjà créée en base.
══════════════════════════════════════════════════════════ */

const MFA = {

  /* Générer un code à 6 chiffres (cryptographiquement sûr) */
  _generateCode() {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    // Ramener dans [100000, 999999]
    return String(100000 + (arr[0] % 900000));
  },

  /* Stocker le code OTP en base via Edge Function (service_role côté serveur) */
  async sendCode(email) {
    try {
      /* On appelle l'Edge Function send-otp qui :
         1. Génère le code côté serveur
         2. L'insère dans admin_2fa
         3. Envoie l'email via SMTP configuré dans site_settings */
      const r = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ email }),
      });

      if (!r.ok) {
        /* Fallback : insérer directement si l'Edge Function n'existe pas encore */
        console.warn('[2FA] Edge Function send-otp indisponible, fallback local');
        return await this._fallbackSendCode(email);
      }
      return true;
    } catch (e) {
      console.warn('[2FA] Erreur sendCode:', e.message);
      return await this._fallbackSendCode(email);
    }
  },

  /* Fallback : insérer le code directement (moins sécurisé mais fonctionnel) */
  async _fallbackSendCode(email) {
    const code = this._generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    /* Insérer via anon — RLS autorise l'admin authentifié seulement
       Ici on utilise le token temporaire obtenu après signIn */
    const tempSession = JSON.parse(localStorage.getItem('ml_2fa_temp') || '{}');

    await fetch(`${SUPABASE_URL}/rest/v1/admin_2fa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${tempSession.token || SUPABASE_ANON}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ email, code, expires_at: expires, used: false, attempts: 0 }),
    });

    /* Afficher le code dans la console en développement uniquement */
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log(`[2FA DEV] Code OTP pour ${email}: ${code}`);
    }

    return true;
  },

  /* Vérifier le code saisi par l'admin */
  async verifyCode(email, code) {
    const tempSession = JSON.parse(localStorage.getItem('ml_2fa_temp') || '{}');

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_2fa?email=eq.${encodeURIComponent(email)}&used=eq.false&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON,
          'Authorization': `Bearer ${tempSession.token || SUPABASE_ANON}`,
        },
      }
    );

    const rows = await r.json();
    if (!rows || !rows.length) throw new Error('Code introuvable ou expiré.');

    const record = rows[0];

    /* Vérifier expiration */
    if (new Date(record.expires_at) < new Date()) {
      throw new Error('Code expiré. Veuillez recommencer la connexion.');
    }

    /* Vérifier tentatives max (3) */
    if (record.attempts >= 3) {
      throw new Error('Trop de tentatives. Reconnectez-vous.');
    }

    /* Incrémenter les tentatives */
    await fetch(`${SUPABASE_URL}/rest/v1/admin_2fa?id=eq.${record.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${tempSession.token || SUPABASE_ANON}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ attempts: record.attempts + 1 }),
    });

    if (record.code !== String(code).trim()) {
      throw new Error(`Code incorrect. ${2 - record.attempts} tentative(s) restante(s).`);
    }

    /* Marquer comme utilisé */
    await fetch(`${SUPABASE_URL}/rest/v1/admin_2fa?id=eq.${record.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON,
        'Authorization': `Bearer ${tempSession.token || SUPABASE_ANON}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ used: true }),
    });

    return true;
  },
};

window.MFA = MFA;

/* ── Injection de l'étape 2FA dans le flux de connexion ── */
document.addEventListener('DOMContentLoaded', () => {
  const loginBox = document.querySelector('.login-box');
  if (!loginBox) return;

  /* Créer le panneau OTP (caché par défaut) */
  const otpPanel = document.createElement('div');
  otpPanel.id = 'otp-panel';
  otpPanel.style.cssText = 'display:none';
  otpPanel.innerHTML = `
    <div class="login-field" style="margin-bottom:1rem">
      <div style="text-align:center;margin-bottom:1.25rem">
        <div style="font-size:2.5rem;margin-bottom:.5rem">📧</div>
        <h3 style="margin:0 0 .25rem;color:var(--vert,#0C3320);font-size:1.1rem">Vérification en 2 étapes</h3>
        <p style="margin:0;font-size:.85rem;color:#666" id="otp-desc">Un code à 6 chiffres a été envoyé à votre adresse email.</p>
      </div>
      <label for="otp-input">Code de vérification</label>
      <input type="text" id="otp-input" placeholder="000000"
        maxlength="6" inputmode="numeric" pattern="[0-9]*"
        style="text-align:center;font-size:1.5rem;letter-spacing:.4em;font-weight:700">
    </div>
    <button class="btn-login" id="otp-verify-btn">
      <span id="otp-btn-text">Vérifier le code</span>
    </button>
    <div class="login-error" id="otp-error"></div>
    <div style="text-align:center;margin-top:1rem">
      <button id="otp-resend-btn" style="background:none;border:none;color:var(--or,#C9A84C);cursor:pointer;font-size:.85rem;text-decoration:underline">
        Renvoyer le code
      </button>
      <span style="margin:0 .5rem;color:#ccc">·</span>
      <button id="otp-back-btn" style="background:none;border:none;color:#888;cursor:pointer;font-size:.85rem;text-decoration:underline">
        Retour
      </button>
    </div>
  `;
  loginBox.appendChild(otpPanel);

  /* Référencer les éléments du formulaire login original */
  const loginFields = loginBox.querySelectorAll('.login-field, .btn-login, #login-error, #toggle-pass');
  const loginBtnOrig = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');

  function showOtpStep(email) {
    /* Cacher le formulaire login */
    loginBox.querySelectorAll('.login-field').forEach(el => el.style.display = 'none');
    if (loginBtnOrig) loginBtnOrig.style.display = 'none';
    if (loginError) loginError.style.display = 'none';
    otpPanel.style.display = 'block';
    document.getElementById('otp-input').focus();

    /* Masquer partiellement l'email */
    const parts = email.split('@');
    const masked = parts[0].slice(0, 2) + '***@' + parts[1];
    document.getElementById('otp-desc').textContent = `Code envoyé à ${masked}. Vérifiez votre boîte mail.`;
  }

  function hideOtpStep() {
    otpPanel.style.display = 'none';
    loginBox.querySelectorAll('.login-field').forEach(el => el.style.display = '');
    if (loginBtnOrig) loginBtnOrig.style.display = '';
    if (loginError) loginError.style.display = '';
    localStorage.removeItem('ml_2fa_temp');
  }

  /* Intercepter le click login ORIGINAL pour insérer l'étape 2FA */
  if (loginBtnOrig) {
    /* Vérifier si 2FA est activé dans les settings */
    sb.settings.get('admin_2fa_enabled').then(val => {
      if (val !== 'true') return; /* 2FA désactivé → flux normal */

      /* Cloner le bouton pour supprimer l'ancien listener et ajouter le nôtre */
      const newBtn = loginBtnOrig.cloneNode(true);
      loginBtnOrig.parentNode.replaceChild(newBtn, loginBtnOrig);

      newBtn.addEventListener('click', async () => {
        const email = document.getElementById('login-email')?.value.trim();
        const pass = document.getElementById('login-pass')?.value;
        const err = document.getElementById('login-error');

        if (!email || !pass) {
          if (err) { err.textContent = 'Remplissez tous les champs.'; err.classList.add('show'); }
          return;
        }

        newBtn.disabled = true;
        document.getElementById('login-btn-text').textContent = 'Connexion…';
        if (err) err.classList.remove('show');

        try {
          /* 1. Connexion Supabase pour valider les credentials */
          const data = await sb.signIn(email, pass);
          /* Stocker temporairement la session avant validation 2FA */
          localStorage.setItem('ml_2fa_temp', JSON.stringify({
            token: data.access_token,
            email,
          }));
          /* Vider la vraie session jusqu'à validation du OTP */
          localStorage.removeItem('ml_session');

          /* 2. Envoyer le code OTP */
          await MFA.sendCode(email);

          /* 3. Afficher l'étape OTP */
          showOtpStep(email);
        } catch (e) {
          if (err) { err.textContent = e.message || 'Email ou mot de passe incorrect.'; err.classList.add('show'); }
          document.dispatchEvent(new Event('ml:login-failed'));
        } finally {
          newBtn.disabled = false;
          document.getElementById('login-btn-text').textContent = 'Se connecter';
        }
      });
    }).catch(() => { /* 2FA non configuré → ignorer */ });
  }

  /* Vérification OTP */
  document.getElementById('otp-verify-btn')?.addEventListener('click', async () => {
    const code = document.getElementById('otp-input')?.value.trim();
    const err = document.getElementById('otp-error');
    const btn = document.getElementById('otp-verify-btn');
    const tempSession = JSON.parse(localStorage.getItem('ml_2fa_temp') || '{}');

    if (!code || code.length !== 6) {
      if (err) { err.textContent = 'Saisissez le code à 6 chiffres.'; err.classList.add('show'); }
      return;
    }

    btn.disabled = true;
    document.getElementById('otp-btn-text').textContent = 'Vérification…';
    if (err) err.classList.remove('show');

    try {
      await MFA.verifyCode(tempSession.email, code);

      /* Restaurer la vraie session */
      const fullSession = JSON.parse(localStorage.getItem('ml_2fa_temp') || '{}');
      localStorage.setItem('ml_session', JSON.stringify({
        token: fullSession.token,
        email: fullSession.email,
        expires: Date.now() + SESSION_CONFIG.getDurationMs(),
        refresh: fullSession.refresh || null,
      }));
      localStorage.removeItem('ml_2fa_temp');

      /* Connexion sb2 en arrière-plan */
      const pass = document.getElementById('login-pass')?.value;
      if (pass) sb2.signIn(fullSession.email, pass).catch(() => {});

      /* Log et affichage admin */
      document.dispatchEvent(new Event('ml:login-success'));
      hideOtpStep();
      if (typeof showAdmin === 'function') showAdmin();
    } catch (e) {
      if (err) { err.textContent = e.message; err.classList.add('show'); }
      btn.disabled = false;
      document.getElementById('otp-btn-text').textContent = 'Vérifier le code';
    }
  });

  /* Touche Entrée sur le champ OTP */
  document.getElementById('otp-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('otp-verify-btn')?.click();
  });

  /* Renvoyer le code */
  document.getElementById('otp-resend-btn')?.addEventListener('click', async () => {
    const tempSession = JSON.parse(localStorage.getItem('ml_2fa_temp') || '{}');
    if (!tempSession.email) return;
    const btn = document.getElementById('otp-resend-btn');
    btn.disabled = true;
    btn.textContent = 'Envoi…';
    await MFA.sendCode(tempSession.email).catch(() => {});
    btn.textContent = '✅ Code renvoyé !';
    setTimeout(() => { btn.disabled = false; btn.textContent = 'Renvoyer le code'; }, 30000);
  });

  /* Retour */
  document.getElementById('otp-back-btn')?.addEventListener('click', hideOtpStep);
});


/* ══════════════════════════════════════════════════════════
   14. JOURNAL DE SÉCURITÉ + ALERTE WHATSAPP NOUVELLE IP
══════════════════════════════════════════════════════════ */

const SecurityJournal = {
  LAST_IP_KEY: 'ml_last_login_ip',
  LAST_UA_KEY: 'ml_last_login_ua',

  /* Détecte si c'est une nouvelle IP ou un nouvel appareil */
  isNewContext(ip, ua) {
    const lastIp = localStorage.getItem(this.LAST_IP_KEY);
    const lastUa = localStorage.getItem(this.LAST_UA_KEY);

    const browserChanged = lastUa && !ua.includes(lastUa.slice(0, 30));
    const ipChanged = lastIp && lastIp !== ip;

    return { ipChanged, browserChanged, lastIp, isNew: !lastIp || ipChanged || browserChanged };
  },

  /* Sauvegarder le contexte courant */
  saveContext(ip, ua) {
    localStorage.setItem(this.LAST_IP_KEY, ip);
    localStorage.setItem(this.LAST_UA_KEY, ua.slice(0, 60));
  },

  /* Envoyer une alerte WhatsApp admin si contexte inconnu */
  async alertAdmin(ip, ua, device, email) {
    try {
      const waNumber = await sb.settings.get('whatsapp_admin_number');
      const apiKey = await sb.settings.get('callmebot_apikey');
      if (!waNumber || !apiKey) return;

      const now = new Date().toLocaleString('fr-FR');
      const msg = `🔐 *Alerte Miralocks Admin*\n\nConnexion depuis un nouveau contexte détecté !\n\n👤 Email : ${email}\n🌐 IP : ${ip}\n💻 Appareil : ${device}\n🕐 Heure : ${now}\n\n_Si ce n'est pas vous, changez votre mot de passe immédiatement._`;

      await fetch(
        `https://api.callmebot.com/whatsapp.php?phone=${waNumber}&text=${encodeURIComponent(msg)}&apikey=${apiKey}`,
        { mode: 'no-cors' }
      );
    } catch (e) {
      console.warn('[SecurityJournal] Alerte WhatsApp failed:', e.message);
    }
  },
};

/* Brancher sur l'événement login-success */
document.addEventListener('ml:login-success', async () => {
  try {
    const ip = await fetch('https://api.ipify.org?format=json')
      .then(r => r.json()).then(d => d.ip).catch(() => 'IP inconnue');
    const ua = navigator.userAgent;

    const ctx = SecurityJournal.isNewContext(ip, ua);

    /* Détection de l'appareil */
    let device = 'PC / Bureau';
    if (/android/i.test(ua)) device = '📱 Android';
    else if (/iPhone|iPad/i.test(ua)) device = '🍎 iOS';
    else if (/windows/i.test(ua)) device = '💻 Windows';
    else if (/mac/i.test(ua)) device = '🖥️ Mac';

    const session = await sb.getValidSession();
    const email = session?.email || 'admin';

    if (ctx.isNew && ctx.lastIp) {
      /* Contexte inconnu → alerte */
      await SecurityJournal.alertAdmin(ip, ua, device, email);
      await histLog('connexion', '⚠️ Connexion depuis nouveau contexte', `IP: ${ip} | Appareil: ${device}`);
    }

    SecurityJournal.saveContext(ip, ua);
  } catch (e) {
    console.warn('[SecurityJournal]', e.message);
  }
});

window.SecurityJournal = SecurityJournal;


/* ══════════════════════════════════════════════════════════
   15. EXPIRATION DE SESSION CONFIGURABLE
   L'admin peut choisir : 1h, 8h, 30 jours
══════════════════════════════════════════════════════════ */

const SESSION_CONFIG = {
  KEY: 'ml_session_duration',
  OPTIONS: {
    '1h':    { label: '1 heure',    ms: 60 * 60 * 1000 },
    '8h':    { label: '8 heures',   ms: 8 * 60 * 60 * 1000 },
    '30d':   { label: '30 jours',   ms: 30 * 24 * 60 * 60 * 1000 },
  },
  DEFAULT: '8h',

  get() {
    return localStorage.getItem(this.KEY) || this.DEFAULT;
  },
  set(val) {
    if (this.OPTIONS[val]) localStorage.setItem(this.KEY, val);
  },
  getDurationMs() {
    const key = this.get();
    return this.OPTIONS[key]?.ms || this.OPTIONS[this.DEFAULT].ms;
  },
  getLabel() {
    return this.OPTIONS[this.get()]?.label || '8 heures';
  },
};

window.SESSION_CONFIG = SESSION_CONFIG;

/* Injecter le sélecteur de durée dans la page login */
document.addEventListener('DOMContentLoaded', () => {
  const loginBox = document.querySelector('.login-box');
  if (!loginBox) return;

  const loginBtn = loginBox.querySelector('#login-btn, .btn-login');
  if (!loginBtn) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'margin-bottom:.75rem;display:flex;align-items:center;gap:.5rem;font-size:.82rem;color:#888;';
  wrapper.innerHTML = `
    <i class="fas fa-clock" style="color:var(--or,#C9A84C)"></i>
    Rester connecté :
    <select id="session-duration-select" style="
      border:1px solid #ddd;border-radius:6px;padding:3px 8px;
      font-size:.82rem;color:#444;background:#fff;cursor:pointer;
    ">
      ${Object.entries(SESSION_CONFIG.OPTIONS).map(([k, v]) =>
        `<option value="${k}" ${SESSION_CONFIG.get() === k ? 'selected' : ''}>${v.label}</option>`
      ).join('')}
    </select>
  `;
  loginBtn.before(wrapper);

  document.getElementById('session-duration-select')?.addEventListener('change', e => {
    SESSION_CONFIG.set(e.target.value);
  });
});

/* Patcher sb.signIn pour utiliser la durée configurable */
const _origSignIn = sb.signIn.bind(sb);
sb.signIn = async function(email, password) {
  const data = await _origSignIn(email, password);
  /* Remplacer la durée d'expiration par celle choisie */
  try {
    const s = JSON.parse(localStorage.getItem('ml_session') || '{}');
    s.expires = Date.now() + SESSION_CONFIG.getDurationMs();
    localStorage.setItem('ml_session', JSON.stringify(s));
  } catch (e) { /* silencieux */ }
  return data;
};

/* Afficher la durée de session dans le dashboard admin */
document.addEventListener('ml:login-success', () => {
  const emailDisplay = document.getElementById('admin-email-display');
  if (emailDisplay) {
    const session = sb.getSession();
    if (session) {
      const expires = new Date(session.expires);
      const label = expires.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const subtitle = emailDisplay.nextElementSibling;
      if (!document.getElementById('session-expiry-display')) {
        const tag = document.createElement('div');
        tag.id = 'session-expiry-display';
        tag.style.cssText = 'font-size:.7rem;color:var(--gris-d,#aaa);margin-top:2px;';
        tag.innerHTML = `<i class="fas fa-clock" style="margin-right:3px"></i>Session jusqu'au ${label}`;
        emailDisplay.after(tag);
      }
    }
  }
});
