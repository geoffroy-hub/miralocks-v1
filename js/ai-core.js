/* ============================================================
   Miralocks — ai-core.js  v1.0
   Noyau IA partagé (Admin & Public)
   Gère Groq, OpenAI, Anthropic (Gemini via Groq/OpenAI compatible)
   ============================================================ */

window.AICore = {
  LS_KEY_ADMIN: 'ml_ai_config',
  LS_KEY_PUBLIC: 'ml_chat_public_config',

  /**
   * Récupère la configuration depuis localStorage ou Supabase
   * @param {string} type 'admin' ou 'public'
   */
  async getConfig(type = 'admin') {
    const lsKey = type === 'admin' ? this.LS_KEY_ADMIN : this.LS_KEY_PUBLIC;
    const prefix = type === 'admin' ? 'ai_' : 'chat_public_';

    // 1. Priorité LocalStorage
    try {
      const local = localStorage.getItem(lsKey);
      if (local) return JSON.parse(local);
    } catch(e) {}

    // 2. Fallback Supabase
    if (!window.sb?.settings?.get) return this._getDefaults(type);

    try {
      const [apikey, model, provider, salonName, prompt] = await Promise.all([
        window.sb.settings.get(`${prefix}apikey`),
        window.sb.settings.get(`${prefix}model`),
        window.sb.settings.get(`${prefix}provider`),
        window.sb.settings.get('ai_salon_name'), // Toujours utiliser le nom global
        type === 'public' ? window.sb.settings.get(`${prefix}system_prompt`) : Promise.resolve(null)
      ]);

      const cfg = {
        apikey: apikey || '',
        model: model || (type === 'admin' ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant'),
        provider: provider || 'groq',
        salonName: salonName || 'MiraLocks',
        systemPrompt: prompt || null
      };

      if (cfg.apikey) localStorage.setItem(lsKey, JSON.stringify(cfg));
      return cfg;
    } catch(e) {
      return this._getDefaults(type);
    }
  },

  _getDefaults(type) {
    return {
      apikey: '',
      model: type === 'admin' ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant',
      provider: 'groq',
      salonName: 'MiraLocks',
      systemPrompt: null
    };
  },

  getAPIUrl(provider) {
    if (provider === 'openai') return 'https://api.openai.com/v1/chat/completions';
    if (provider === 'anthropic') return 'https://api.anthropic.com/v1/messages';
    if (provider === 'google') return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    return 'https://api.groq.com/openai/v1/chat/completions';
  },

  /**
   * Appel API universel
   */
  async call(messages, config, customSystem, maxTokens = 1024) {
    const { apikey, model, provider, salonName } = config;
    if (!apikey) throw new Error("Clé API manquante");

    const systemPrompt = customSystem || config.systemPrompt || `Tu es l'assistante IA officielle de ${salonName}.`;
    const url = this.getAPIUrl(provider);
    const headers = { 'Content-Type': 'application/json' };

    if (provider === 'anthropic') {
      headers['x-api-key'] = apikey;
      headers['anthropic-version'] = '2023-06-01';
      const body = { model, max_tokens: maxTokens, system: systemPrompt, messages };
      const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error?.message || `Erreur ${r.status}`); }
      const data = await r.json();
      return data.content?.[0]?.text || '';
    } else {
      // Pour Google Gemini (via endpoint compatible OpenAI), la clé peut être passée en Authorization: Bearer
      // ou en ?key=API_KEY. L'endpoint OpenAI-compatible de Google supporte Bearer.
      headers['Authorization'] = 'Bearer ' + apikey;
      
      const msgs = [{ role: 'system', content: systemPrompt }, ...messages];
      const body = { 
        model: model || (provider === 'google' ? 'gemini-1.5-flash' : 'llama-3.1-8b-instant'),
        max_tokens: maxTokens, 
        messages: msgs 
      };

      const finalUrl = provider === 'google' ? `${url}?key=${apikey}` : url;
      // On garde Bearer pour les autres, et on peut aussi le laisser pour Google (supporté)
      
      const r = await fetch(finalUrl, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!r.ok) { 
        const e = await r.json().catch(()=>({})); 
        throw new Error(e.error?.message || e.message || `Erreur ${r.status}`); 
      }
      const data = await r.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }
};

/* Compatibilité ascendante avec l'ancien code admin-ai.js */
window.getAIConfig = () => window.AICore.getConfig('admin');
window.callAI = (m, c, s, t) => window.AICore.call(m, c, s, t);
