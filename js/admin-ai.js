/* ============================================================
   Miralocks Admin — admin-ai.js  v1.0
   Intelligence Artificielle via API Claude :
   13. Description automatique des photos (galerie/blog)
   14. Réponses aux avis personnalisées par IA
   15. Assistant admin IA (chat intégré)
   ============================================================ */
/* Helper : échappement HTML pour éviter les injections XSS */
function _escAI(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* Helper : appel API (universel) */
async function callClaude(messages, system = '', maxTokens = 1000) {
  if (!window.getAIConfig || !window.callAI) {
    throw new Error("L'API IA n'est pas chargée. Rechargez la page.");
  }
  const config = await window.getAIConfig();
  if (!config || !config.apikey) {
    throw new Error("Clé API IA manquante. Allez dans Paramètres -> Configuration IA.");
  }

  // Adapter le format image Anthropic vers OpenAI (Groq/OpenAI) 
  if (config.provider !== 'anthropic') {
    messages = messages.map(msg => {
      if (Array.isArray(msg.content)) {
        return {
          ...msg,
          content: msg.content.map(c => {
            if (c.type === 'image' && c.source) {
              return { type: 'image_url', image_url: { url: `data:${c.source.media_type};base64,${c.source.data}` } };
            }
            return c;
          })
        };
      }
      return msg;
    });
  }

  return await window.callAI(messages, config, system, maxTokens);
}

/* Helper : convertir une URL d'image en base64 */
async function imageUrlToBase64(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch(e) {
    throw new Error('Impossible de charger l\'image : ' + e.message);
  }
}


/* ══════════════════════════════════════════════════════════
   13. DESCRIPTION AUTOMATIQUE DES PHOTOS
   Analyse la photo uploadée et suggère titre + description
══════════════════════════════════════════════════════════ */
window.AIPhotoDescriber = {

  async describe(imageUrl) {
    const toast = window.toast || window.showToast;
    try {
      toast?.('🤖 Analyse de la photo en cours…', 'info');

      const base64 = await imageUrlToBase64(imageUrl);

      const text = await callClaude([{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
          },
          {
            type: 'text',
            text: `Tu es l'assistant de l'Institut MiraLocks, salon de locks naturels à Lomé, Togo.
Analyse cette photo de réalisation capillaire et génère :
1. Un titre court et accrocheur (max 8 mots)
2. Une description engageante (2-3 phrases, 30-50 mots)
3. Une catégorie parmi : creation, entretien, coloration, avant-apres, equipe

Réponds UNIQUEMENT en JSON valide, sans markdown :
{"titre":"...","description":"...","categorie":"..."}`,
          },
        ],
      }], '', 300);

      const clean = text.replace(/```json|```/g, '').trim();
      const result = JSON.parse(clean);
      toast?.('✅ Description générée par l\'IA !', 'success');
      return result;
    } catch(e) {
      (window.toast || window.showToast)?.('Erreur IA : ' + e.message, 'error');
      return null;
    }
  },

  /* Injecter le bouton dans le formulaire de la galerie admin */
  injectButton(photoUrlInputId, titreInputId, descInputId, catInputId) {
    const photoInput = document.getElementById(photoUrlInputId);
    if (!photoInput) return;

    const existing = document.getElementById('ai-describe-btn');
    if (existing) return;

    const btn = document.createElement('button');
    btn.id = 'ai-describe-btn';
    btn.type = 'button';
    btn.className = 'btn btn-sm';
    btn.style.cssText = 'background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border:none;display:flex;align-items:center;gap:.4rem;margin-top:.5rem;';
    btn.innerHTML = '<i class="fas fa-magic"></i> Décrire avec l\'IA';
    btn.onclick = async () => {
      const url = document.getElementById(photoUrlInputId)?.value;
      if (!url) { (window.toast||window.showToast)?.('Uploadez d\'abord une photo', 'error'); return; }

      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:.4rem"></div> Analyse…';

      const result = await this.describe(url);
      if (result) {
        if (titreInputId) {
          const titreEl = document.getElementById(titreInputId);
          if (titreEl && !titreEl.value) titreEl.value = result.titre || '';
        }
        if (descInputId) {
          const descEl = document.getElementById(descInputId);
          if (descEl && !descEl.value) descEl.value = result.description || '';
        }
        if (catInputId && result.categorie) {
          const catEl = document.getElementById(catInputId);
          if (catEl) catEl.value = result.categorie;
        }
      }

      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-magic"></i> Décrire avec l\'IA';
    };

    photoInput.after(btn);
  },
};

/* Injecter dans la galerie admin */
document.addEventListener('DOMContentLoaded', () => {
  /* Observer l'ouverture du modal galerie */
  const modalGalerie = document.getElementById('modal-galerie');
  if (modalGalerie) {
    const observer = new MutationObserver(() => {
      if (modalGalerie.classList.contains('open')) {
        setTimeout(() => {
          AIPhotoDescriber.injectButton('galerie-photo-url', 'galerie-titre', 'galerie-description', 'galerie-categorie');
        }, 200);
      }
    });
    observer.observe(modalGalerie, { attributes: true, attributeFilter: ['class'] });
  }

  /* Idem pour le modal blog */
  const modalBlog = document.getElementById('modal-blog');
  if (modalBlog) {
    const obs2 = new MutationObserver(() => {
      if (modalBlog.classList.contains('open')) {
        setTimeout(() => {
          AIPhotoDescriber.injectButton('blog-photo-url', 'blog-titre', 'blog-extrait', null);
        }, 200);
      }
    });
    obs2.observe(modalBlog, { attributes: true, attributeFilter: ['class'] });
  }
});


/* ══════════════════════════════════════════════════════════
   14. RÉPONSES AUX AVIS PERSONNALISÉES PAR IA
   Analyse le contenu de l'avis et génère une réponse unique
══════════════════════════════════════════════════════════ */
window.AIAvisReply = {

  async generate(avis) {
    const toast = window.toast || window.showToast;
    try {
      toast?.('🤖 Génération de la réponse…', 'info');

      const text = await callClaude([{
        role: 'user',
        content: `Tu es la responsable de l'Institut MiraLocks, salon de locks naturels à Lomé, Togo.
Un client a laissé cet avis :

Nom : ${avis.nom || 'Client'}
Note : ${avis.etoiles || 5}/5 étoiles
Avis : "${avis.texte || ''}"
Localité : ${avis.localite || 'Lomé, Togo'}

Rédige une réponse professionnelle, chaleureuse et authentique en français (max 80 mots).
La réponse doit :
- Commencer par le prénom du client
- Être personnalisée selon le contenu exact de l'avis
- Refléter la culture togolaise et africaine avec bienveillance
- Si note ≥ 4 : remercier chaleureusement, mentionner un détail de l'avis
- Si note < 4 : s'excuser sincèrement, proposer de corriger, inviter à revenir
- Terminer par une phrase d'invitation (emoji 🌿 bienvenu)

Réponds UNIQUEMENT avec le texte de la réponse, sans guillemets ni explication.`,
      }], '', 300);

      toast?.('✅ Réponse IA générée !', 'success');
      return text.trim();
    } catch(e) {
      (window.toast || window.showToast)?.('Erreur IA : ' + e.message, 'error');
      return null;
    }
  },

  /* Remplacer la fonction generateAvisReply existante par l'IA */
  async renderModal(avis) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    modal.innerHTML = `
      <div style="background:var(--bg-card,#fff);border-radius:20px;padding:2rem;max-width:500px;width:100%;position:relative">
        <button onclick="this.closest('[style*=fixed]').remove()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--gris-d)">×</button>
        <h3 style="margin:0 0 .75rem;color:var(--vert,#0C3320)">
          <i class="fas fa-magic" style="color:#7c3aed;margin-right:.4rem"></i>Réponse IA à l'avis
        </h3>
        <div style="background:var(--bg,#f9fafb);border-radius:10px;padding:1rem;margin-bottom:1rem;font-size:.85rem">
          <div style="font-weight:600">${_escAI(avis.nom)} — ${'★'.repeat(avis.etoiles||5)}</div>
          <div style="color:var(--gris-d);margin-top:.25rem;font-style:italic">"${_escAI((avis.texte||'').slice(0,100))}${(avis.texte||'').length>100?'…':''}"</div>
        </div>
        <div style="margin-bottom:1rem">
          <label style="display:block;font-size:.82rem;font-weight:600;margin-bottom:.35rem;color:var(--gris-d)">Réponse générée par l'IA :</label>
          <textarea id="ai-reply-text" style="width:100%;min-height:120px;border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:.75rem;font-family:inherit;font-size:.88rem;resize:vertical">Génération en cours…</textarea>
        </div>
        <div style="display:flex;gap:.75rem;justify-content:flex-end;flex-wrap:wrap">
          <button class="btn btn-sm btn-outline" id="ai-regen-btn" onclick="AIAvisReply._regenerate(${JSON.stringify(avis).replace(/"/g,'&quot;')})">
            <i class="fas fa-redo"></i> Régénérer
          </button>
          <button class="btn btn-sm btn-outline" onclick="navigator.clipboard.writeText(document.getElementById('ai-reply-text').value).then(()=>window.toast?.('Copié !','success'))">
            <i class="fas fa-copy"></i> Copier
          </button>
          <button class="btn btn-sm" style="background:var(--vert,#0C3320);color:var(--or,#C9A84C)" onclick="this.closest('[style*=fixed]').remove()">
            Fermer
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    /* Générer la réponse */
    const text = await this.generate(avis);
    const textarea = document.getElementById('ai-reply-text');
    if (textarea) textarea.value = text || 'Erreur de génération. Veuillez réessayer.';
  },

  async _regenerate(avis) {
    const btn = document.getElementById('ai-regen-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:12px;height:12px;border-width:2px;display:inline-block"></div>'; }
    const text = await this.generate(avis);
    const textarea = document.getElementById('ai-reply-text');
    if (textarea && text) textarea.value = text;
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-redo"></i> Régénérer'; }
  },
};

/* Surcharger window.generateAvisReply pour utiliser l'IA si disponible */
window.generateAvisReplyAI = async function(etoiles, nom, texte, id) {
  /* Construire un objet avis minimal */
  const avis = { id, nom, etoiles, texte };
  await AIAvisReply.renderModal(avis);
};


/* ══════════════════════════════════════════════════════════
   15. ASSISTANT ADMIN IA
   Panneau de chat intelligent intégré dans l'admin
══════════════════════════════════════════════════════════ */
window.AIAssistant = {
  _history: [],
  _open: false,

  async _getContext() {
    /* Récupérer des stats pour contextualiser l'IA */
    try {
      const [rdvCounts, services, avis] = await Promise.all([
        sb.rdv.counts().catch(() => ({})),
        sb.services.list(true).catch(() => []),
        sb.avis.list(true).catch(() => []),
      ]);
      const avgStars = avis.length
        ? (avis.reduce((a,v) => a + (v.etoiles||5), 0) / avis.length).toFixed(1)
        : 'N/A';

      return `Tu es l'assistant IA de l'Institut MiraLocks, salon de locks naturels à Lomé, Togo.
Tu aides la gérante Akossiwa Miriam ABOTCHI à gérer son salon.

CONTEXTE ACTUEL :
- RDV en attente : ${rdvCounts.en_attente || 0}
- RDV confirmés : ${rdvCounts.confirme || 0}
- Total RDV : ${rdvCounts.total || 0}
- Services actifs : ${services.length}
- Note moyenne clients : ${avgStars}/5 étoiles (${avis.length} avis)
- Services principaux : ${services.slice(0,5).map(s=>s.nom).join(', ')}

Tu peux :
- Analyser les statistiques et suggérer des actions
- Rédiger des textes (posts, descriptions, articles de blog)
- Conseiller sur la gestion du salon
- Répondre aux questions sur les fonctionnalités admin
- Suggérer des stratégies marketing adaptées au marché togolais

Réponds en français, de façon concise et pratique. Utilise des emojis avec modération.`;
    } catch {
      return `Tu es l'assistant IA de l'Institut MiraLocks, salon de locks naturels à Lomé, Togo. Aide la gérante à gérer son activité. Réponds en français.`;
    }
  },

  async send(userMessage) {
    this._history.push({ role: 'user', content: userMessage });

    /* Limiter l'historique à 10 échanges */
    if (this._history.length > 20) this._history = this._history.slice(-20);

    const system = await this._getContext();
    const reply = await callClaude(this._history, system, 600);

    this._history.push({ role: 'assistant', content: reply });
    return reply;
  },

  open() {
    if (document.getElementById('ai-assistant-panel')) {
      document.getElementById('ai-assistant-panel').style.display = 'flex';
      this._open = true;
      return;
    }
    this._createPanel();
    this._open = true;
  },

  close() {
    const panel = document.getElementById('ai-assistant-panel');
    if (panel) panel.style.display = 'none';
    this._open = false;
  },

  _createPanel() {
    const panel = document.createElement('div');
    panel.id = 'ai-assistant-panel';
    panel.style.cssText = `
      position:fixed;bottom:1.5rem;right:1.5rem;
      width:360px;max-height:520px;
      background:var(--bg-card,#fff);
      border-radius:20px;
      box-shadow:0 8px 40px rgba(0,0,0,.18);
      display:flex;flex-direction:column;
      z-index:8888;
      border:1px solid var(--border,#e5e7eb);
      overflow:hidden;
    `;
    panel.innerHTML = `
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:1rem 1.25rem;display:flex;align-items:center;gap:.75rem">
        <div style="width:36px;height:36px;background:rgba(255,255,255,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.1rem">🤖</div>
        <div style="flex:1;color:#fff">
          <div style="font-weight:700;font-size:.92rem">Assistant IA Miralocks</div>
          <div style="font-size:.72rem;opacity:.8">Propulsé par Claude</div>
        </div>
        <button onclick="AIAssistant.close()" style="background:none;border:none;color:rgba(255,255,255,.8);font-size:1.2rem;cursor:pointer;padding:.25rem">×</button>
      </div>

      <!-- Messages -->
      <div id="ai-chat-messages" style="flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.75rem;max-height:300px;min-height:200px">
        <div class="ai-msg ai-msg-bot" style="background:linear-gradient(135deg,rgba(124,58,237,.08),rgba(79,70,229,.05));border-radius:12px 12px 12px 0;padding:.75rem 1rem;font-size:.85rem;color:var(--text);max-width:90%;border-left:3px solid #7c3aed">
          👋 Bonjour ! Je suis votre assistante IA. Je peux analyser vos statistiques, rédiger des textes, ou répondre à vos questions sur la gestion du salon. Comment puis-je vous aider ?
        </div>
      </div>

      <!-- Suggestions rapides -->
      <div id="ai-suggestions" style="padding:.5rem 1rem;display:flex;gap:.35rem;flex-wrap:wrap;border-top:1px solid var(--border,#f0f0f0)">
        ${[
          'Analyse mes stats',
          'Rédige un post Instagram',
          'Conseils pour plus de RDV',
          'Génère un article de blog',
        ].map(s => `<button onclick="AIAssistant._quickSend('${s}')" style="background:rgba(124,58,237,.08);color:#7c3aed;border:1px solid rgba(124,58,237,.2);border-radius:20px;padding:3px 10px;font-size:.72rem;cursor:pointer;white-space:nowrap">${s}</button>`).join('')}
      </div>

      <!-- Saisie -->
      <div style="padding:.75rem 1rem;border-top:1px solid var(--border,#f0f0f0);display:flex;gap:.5rem">
        <input type="text" id="ai-chat-input" placeholder="Posez votre question…"
          style="flex:1;border:1px solid var(--border,#e5e7eb);border-radius:25px;padding:.5rem 1rem;font-size:.85rem;outline:none"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();AIAssistant._sendFromInput()}">
        <button id="ai-send-btn" onclick="AIAssistant._sendFromInput()" style="background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border:none;border-radius:50%;width:38px;height:38px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <i class="fas fa-paper-plane" style="font-size:.8rem"></i>
        </button>
      </div>`;

    document.body.appendChild(panel);
  },

  async _sendFromInput() {
    const input = document.getElementById('ai-chat-input');
    const msg = input?.value.trim();
    if (!msg) return;
    input.value = '';
    await this._sendMessage(msg);
  },

  async _quickSend(msg) {
    /* Cacher les suggestions */
    const sug = document.getElementById('ai-suggestions');
    if (sug) sug.style.display = 'none';
    await this._sendMessage(msg);
  },

  async _sendMessage(msg) {
    const container = document.getElementById('ai-chat-messages');
    const sendBtn = document.getElementById('ai-send-btn');
    const input = document.getElementById('ai-chat-input');
    if (!container) return;

    /* Message utilisateur */
    const userDiv = document.createElement('div');
    userDiv.style.cssText = 'background:linear-gradient(135deg,#0C3320,#1a5c38);color:var(--or,#C9A84C);border-radius:12px 12px 0 12px;padding:.75rem 1rem;font-size:.85rem;max-width:90%;align-self:flex-end;margin-left:auto';
    userDiv.textContent = msg;
    container.appendChild(userDiv);
    container.scrollTop = container.scrollHeight;

    /* Indicateur de frappe */
    const typingDiv = document.createElement('div');
    typingDiv.id = 'ai-typing';
    typingDiv.style.cssText = 'background:var(--bg,#f9fafb);border-radius:12px 12px 12px 0;padding:.75rem 1rem;font-size:.85rem;max-width:70%;border-left:3px solid #7c3aed;color:var(--gris-d)';
    typingDiv.innerHTML = '<i class="fas fa-ellipsis-h" style="animation:pulse 1s infinite"></i> En cours de réflexion…';
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;

    /* Désactiver la saisie */
    if (sendBtn) sendBtn.disabled = true;
    if (input) input.disabled = true;

    try {
      const reply = await this.send(msg);
      typingDiv.remove();

      const botDiv = document.createElement('div');
      botDiv.style.cssText = 'background:linear-gradient(135deg,rgba(124,58,237,.08),rgba(79,70,229,.05));border-radius:12px 12px 12px 0;padding:.75rem 1rem;font-size:.85rem;color:var(--text);max-width:92%;border-left:3px solid #7c3aed;white-space:pre-wrap;line-height:1.5';
      botDiv.textContent = reply;
      container.appendChild(botDiv);
    } catch(e) {
      typingDiv.remove();
      const errDiv = document.createElement('div');
      errDiv.style.cssText = 'background:#fee2e2;border-radius:12px;padding:.75rem 1rem;font-size:.82rem;color:#991b1b;max-width:90%';
      errDiv.textContent = '❌ Erreur : ' + e.message;
      container.appendChild(errDiv);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      if (input) { input.disabled = false; input.focus(); }
      container.scrollTop = container.scrollHeight;
    }
  },
};

/* Bouton flottant IA dans l'admin */
document.addEventListener('DOMContentLoaded', () => {
  const adminPage = document.getElementById('admin-page');
  if (!adminPage) return;

  const fab = document.createElement('button');
  fab.id = 'ai-fab';
  fab.title = 'Assistant IA';
  fab.style.cssText = `
    position:fixed;bottom:5.5rem;right:1.5rem;
    width:52px;height:52px;
    background:linear-gradient(135deg,#7c3aed,#4f46e5);
    color:#fff;border:none;border-radius:50%;
    box-shadow:0 4px 20px rgba(124,58,237,.4);
    cursor:pointer;font-size:1.3rem;
    display:none;align-items:center;justify-content:center;
    z-index:8887;
    transition:transform .2s, box-shadow .2s;
  `;
  fab.innerHTML = '🤖';
  fab.onclick = () => AIAssistant._open ? AIAssistant.close() : AIAssistant.open();
  fab.onmouseenter = () => { fab.style.transform = 'scale(1.1)'; fab.style.boxShadow = '0 6px 28px rgba(124,58,237,.5)'; };
  fab.onmouseleave = () => { fab.style.transform = ''; fab.style.boxShadow = '0 4px 20px rgba(124,58,237,.4)'; };

  document.body.appendChild(fab);

  /* Afficher le FAB quand l'admin est visible (pas sur le login) */
  const checkFabVisibility = () => {
    fab.style.display = (!adminPage.style.display || adminPage.style.display === 'block' || adminPage.style.display === 'flex') ? 'flex' : 'none';
  };
  
  const observer = new MutationObserver(checkFabVisibility);
  observer.observe(adminPage, { attributes: true, attributeFilter: ['style', 'class'] });
  checkFabVisibility();
});


/* ══════════════════════════════════════════════════════════
   16. GÉNÉRATEUR D'ARTICLES BLOG SEO — TOGO
   Génère des articles optimisés pour les recherches locales
══════════════════════════════════════════════════════════ */
window.BlogGenerator = {

  /* Sujets populaires pré-définis pour le marché togolais */
  SUJETS: [
    { label: 'Prix pose locks Lomé',        prompt: 'prix pose locks Lomé Togo tarifs salon' },
    { label: 'Entretien dreadlocks Togo',   prompt: 'entretien dreadlocks Togo conseils quotidiens' },
    { label: 'Resserrage locks maison',     prompt: 'resserrage locks maison techniques conseils' },
    { label: 'Locks naturels cheveux secs', prompt: 'locks naturels cheveux secs hydratation' },
    { label: 'Durée pose locks débutante',  prompt: 'durée pose locks première fois durée séance' },
    { label: 'Produits locks naturels',     prompt: 'produits naturels locks huile shea karité Togo' },
    { label: 'Locks bébé enfant Lomé',      prompt: 'locks enfant bébé Lomé soins précautions' },
    { label: 'Évolution locks par mois',    prompt: 'évolution croissance locks mois par mois photos' },
  ],

  async generer(sujet, motsCles = '') {
    const toast = window.toast || window.showToast;
    const sys = `Tu es rédactrice SEO spécialisée en soins capillaires africains pour l'Institut MiraLocks à Lomé, Togo.
Rédige des articles en français, accessibles, chaleureux, adaptés au public togolais.
Intègre naturellement les mots-clés locaux (Lomé, Togo, FCFA si prix, quartiers si pertinent).
Format de sortie STRICT — réponds UNIQUEMENT avec ce JSON, sans texte avant ni après :
{
  "titre": "...",
  "extrait": "...(2 phrases max)...",
  "contenu": "...(HTML simple : <h2>, <p>, <ul><li> uniquement, ~500 mots)...",
  "meta_description": "...(150 chars max)...",
  "mots_cles": ["...", "...", "...", "..."]
}`;

    const userMsg = `Sujet : ${sujet}
${motsCles ? `Mots-clés supplémentaires : ${motsCles}` : ''}
Rédige un article de blog SEO complet pour MiraLocks Lomé.`;

    const raw = await callClaude([{ role: 'user', content: userMsg }], sys, 1500);

    /* Parser le JSON retourné */
    let article;
    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      article = JSON.parse(clean);
    } catch {
      throw new Error('Réponse IA invalide — réessayez');
    }
    return article;
  },

  /* Sauvegarder l'article dans Supabase blog_posts */
  async sauvegarder(article) {
    const s = await sb.getValidSession();
    if (!s) throw new Error('Non authentifié');
    const slug = article.titre
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim()
      .replace(/\s+/g, '-')
      + '-' + Date.now().toString(36);
    const post = {
      titre: article.titre,
      extrait: article.extrait,
      contenu: article.contenu,
      slug,
      categorie: 'conseils',
      publie: false,
      created_at: new Date().toISOString(),
    };
    const r = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts`, {
      method: 'POST',
      headers: { ...sb._h(s.token), 'Prefer': 'return=representation' },
      body: JSON.stringify(post),
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'Erreur sauvegarde'); }
    return slug;
  },

  /* Ouvrir le modal de génération */
  openModal() {
    const opts = this.SUJETS.map(s =>
      `<option value="${s.prompt}">${s.label}</option>`
    ).join('');

    const html = `
<div id="modal-blog-gen" style="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem">
<div style="background:var(--bg-card,#fff);border-radius:16px;padding:1.75rem;max-width:520px;width:100%;max-height:90vh;overflow-y:auto">
  <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:1.25rem">
    <span style="font-size:1.3rem">🤖</span>
    <h3 style="margin:0;font-size:1.05rem">Générer un article SEO</h3>
  </div>

  <div class="form-group">
    <label class="form-label">Sujet prédéfini</label>
    <select id="bg-sujet" class="form-control">
      <option value="">— Choisir un sujet populaire —</option>
      ${opts}
    </select>
  </div>
  <div class="form-group">
    <label class="form-label">Ou décrivez librement le sujet</label>
    <input type="text" id="bg-sujet-libre" class="form-control" placeholder="Ex: coiffures locks pour mariage au Togo">
  </div>
  <div class="form-group">
    <label class="form-label">Mots-clés supplémentaires (optionnel)</label>
    <input type="text" id="bg-mots-cles" class="form-control" placeholder="Ex: Agoè, prix, durée, naturel">
  </div>

  <div id="bg-result" style="display:none;margin:1rem 0">
    <div style="border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:1rem;background:var(--bg,#f9fafb)">
      <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--gris-d);margin-bottom:.4rem">Titre généré</div>
      <div id="bg-titre-preview" style="font-weight:700;font-size:1rem;color:var(--vert,#0C3320);margin-bottom:.75rem"></div>
      <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--gris-d);margin-bottom:.4rem">Extrait</div>
      <div id="bg-extrait-preview" style="font-size:.85rem;color:var(--text);margin-bottom:.75rem;line-height:1.5"></div>
      <div style="font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--gris-d);margin-bottom:.4rem">Mots-clés SEO</div>
      <div id="bg-kw-preview" style="font-size:.8rem;color:var(--or-d,#8B6914);display:flex;flex-wrap:wrap;gap:.3rem"></div>
    </div>
  </div>

  <div id="bg-status" style="font-size:.83rem;color:var(--gris-d);min-height:1.4rem;margin-bottom:.5rem"></div>

  <div style="display:flex;gap:.5rem;flex-wrap:wrap">
    <button id="bg-btn-generer" class="btn btn-primary" style="flex:1" onclick="BlogGenerator._generer()">
      <i class="fas fa-magic"></i> Générer l'article
    </button>
    <button id="bg-btn-sauver" class="btn btn-outline" style="display:none" onclick="BlogGenerator._sauver()">
      <i class="fas fa-save"></i> Sauvegarder (brouillon)
    </button>
    <button class="btn btn-outline" onclick="document.getElementById('modal-blog-gen').remove()">Fermer</button>
  </div>
</div></div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    /* Remplir sujet libre si on choisit un prédéfini */
    document.getElementById('bg-sujet').addEventListener('change', function() {
      if (this.value) document.getElementById('bg-sujet-libre').value = '';
    });
  },

  _currentArticle: null,

  async _generer() {
    const sujetSel   = document.getElementById('bg-sujet').value;
    const sujetLibre = document.getElementById('bg-sujet-libre').value.trim();
    const motsCles   = document.getElementById('bg-mots-cles').value.trim();
    const sujet      = sujetLibre || sujetSel;

    if (!sujet) {
      document.getElementById('bg-status').innerHTML =
        '<span style="color:var(--danger)">Choisissez ou saisissez un sujet</span>';
      return;
    }

    const btn = document.getElementById('bg-btn-generer');
    const status = document.getElementById('bg-status');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Génération en cours…';
    status.textContent = 'Rédaction par l\'IA (10–20 secondes)…';
    document.getElementById('bg-result').style.display = 'none';
    document.getElementById('bg-btn-sauver').style.display = 'none';

    try {
      const article = await this.generer(sujet, motsCles);
      this._currentArticle = article;

      document.getElementById('bg-titre-preview').textContent   = article.titre || '—';
      document.getElementById('bg-extrait-preview').textContent = article.extrait || '—';
      const kwEl = document.getElementById('bg-kw-preview');
      kwEl.innerHTML = (article.mots_cles || []).map(k =>
        `<span style="background:rgba(201,168,76,.15);color:#8B6914;border-radius:20px;padding:2px 9px">${_escAI(k)}</span>`
      ).join('');

      document.getElementById('bg-result').style.display = '';
      document.getElementById('bg-btn-sauver').style.display = '';
      status.innerHTML = '<span style="color:var(--success)">✓ Article généré — vérifiez avant de sauvegarder</span>';

    } catch(e) {
      status.innerHTML = `<span style="color:var(--danger)">Erreur : ${_escAI(e.message)}</span>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-magic"></i> Regénérer';
    }
  },

  async _sauver() {
    if (!this._currentArticle) return;
    const btn = document.getElementById('bg-btn-sauver');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
      await this.sauvegarder(this._currentArticle);
      document.getElementById('bg-status').innerHTML =
        '<span style="color:var(--success)">✓ Article sauvegardé en brouillon — visible dans le panel Blog</span>';
      (window.toast || window.showToast)?.('Article blog sauvegardé en brouillon !', 'success');
      document.getElementById('bg-btn-sauver').style.display = 'none';
      if (typeof loadBlog === 'function') setTimeout(loadBlog, 500);
    } catch(e) {
      document.getElementById('bg-status').innerHTML =
        `<span style="color:var(--danger)">Erreur sauvegarde : ${_escAI(e.message)}</span>`;
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Sauvegarder (brouillon)';
    }
  },
};

/* Injecter le bouton "Générer avec IA" dans le panel Blog */
(function injectBlogGenButton() {
  function _inject() {
    const blogPanel = document.getElementById('panel-blog');
    if (!blogPanel) { setTimeout(_inject, 800); return; }
    if (blogPanel.querySelector('#btn-blog-gen-ai')) return;

    const header = blogPanel.querySelector('.panel-header');
    if (!header) return;

    const btn = document.createElement('button');
    btn.id = 'btn-blog-gen-ai';
    btn.className = 'btn btn-outline btn-sm';
    btn.style.cssText = 'border-color:rgba(124,58,237,.4);color:#7c3aed;';
    btn.innerHTML = '🤖 Générer avec l\'IA';
    btn.onclick = () => BlogGenerator.openModal();

    const headerActions = header.querySelector('.panel-actions, div[style*="flex"]');
    if (headerActions) headerActions.appendChild(btn);
    else header.appendChild(btn);
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(_inject, 1200));
})();
