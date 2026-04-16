/**
 * Miralocks — lang.js Version: 4.0
 * Traduction FR ↔ EN via cookie googtrans (SANS logo Google visible)
 * ✅ Aucun logo, aucune barre, aucun widget Google affiché
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'miralocks-lang';

  // ── 1. Injecter les styles pour masquer TOUT ce que Google injecte ──
  function injectHideStyles() {
    var style = document.createElement('style');
    style.id = 'gt-hide-all';
    style.textContent = [
      '.goog-te-banner-frame { display:none!important; }',
      'body { top:0!important; }',
      '#goog-gt-tt { display:none!important; visibility:hidden!important; }',
      '.goog-te-balloon-frame { display:none!important; }',
      '.goog-tooltip { display:none!important; }',
      '.goog-tooltip:hover { display:none!important; }',
      '.goog-text-highlight { background:none!important; box-shadow:none!important; }',
      '.skiptranslate { display:none!important; }',
      '#goog-gt- { display:none!important; }',
      'iframe.goog-te-menu-frame { display:none!important; }',
      /* Cacher les spinners et popups "PENDANT LA TRADUCTION" */
      '.goog-te-spinner-pos { display:none!important; }',
      '.goog-te-spinner-animation { display:none!important; }',
      '.goog-te-spinner-icon { display:none!important; }',
      'iframe[src*="translate.google"] { display:none!important; }',
      'iframe[src*="translate.googleapis"] { display:none!important; }',
      '[class*="goog-te-"] { display:none!important; }',
      /* Nouveaux sélecteurs pour masquer le logo rond flottant sur mobile */
      '.VIpgJd-ZVi9od-aZ2wEe-wOHMyf { display:none!important; visibility:hidden!important; }',
      '.VIpgJd-ZVi9od-ORHb-OEVmcd { display:none!important; visibility:hidden!important; }',
      '.VIpgJd-ZVi9od-aZ2wEe-OiiCO { display:none!important; visibility:hidden!important; }',
      '.VIpgJd-ZVi9od-SMfZPh-hFEqM { display:none!important; visibility:hidden!important; }',
      '[class^="VIpgJd-"] { display:none!important; visibility:hidden!important; }',
      'div[id^="goog-gt-"] { display:none!important; visibility:hidden!important; z-index:-99999!important; }',
      '.goog-te-gadget { display:none!important; }',
      '.goog-logo-link { display:none!important; }',
      '.gt-is-translating { display:none!important; }'
    ].join('\n');
    document.head.appendChild(style);

    // Empêcher Chrome (mobile) de lancer son propre widget natif de traduction par-dessus.
    if (!document.querySelector('meta[name="google"]')) {
      var meta = document.createElement('meta');
      meta.name = 'google';
      meta.content = 'notranslate';
      document.head.appendChild(meta);
    }
  }

  // ── 2. Cookie googtrans ─────────────────────────────────────────────
  function setGoogTransCookie(langCode) {
    var val = (langCode === 'en') ? '/fr/en' : '/fr/fr';
    var host = location.hostname;
    document.cookie = 'googtrans=' + val + '; path=/; domain=.' + host;
    document.cookie = 'googtrans=' + val + '; path=/; domain=' + host;
    document.cookie = 'googtrans=' + val + '; path=/';
  }

  function clearGoogTransCookie() {
    var host = location.hostname;
    var exp = 'expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
    document.cookie = 'googtrans=; ' + exp + '; domain=.' + host;
    document.cookie = 'googtrans=; ' + exp + '; domain=' + host;
    document.cookie = 'googtrans=; ' + exp;
  }

  // ── 3. Injecter Google Translate (invisible) ────────────────────────
  function injectGoogleTranslate() {
    if (document.getElementById('google_translate_element')) return;

    var div = document.createElement('div');
    div.id = 'google_translate_element';
    div.setAttribute('aria-hidden', 'true');
    div.style.cssText = 'display:none!important;position:absolute!important;visibility:hidden!important;width:0!important;height:0!important;overflow:hidden!important;opacity:0!important;z-index:-9999!important;';
    document.body.appendChild(div);

    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement(
        { pageLanguage: 'fr', includedLanguages: 'en,fr', autoDisplay: false },
        'google_translate_element'
      );
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en') {
        setTimeout(function () { applyTranslation('en'); }, 500);
      }
    };

    var script = document.createElement('script');
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    document.head.appendChild(script);
  }

  // ── 4. Appliquer la traduction ──────────────────────────────────────
  function applyTranslation(langCode) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      var select = document.querySelector('.goog-te-combo');
      if (select) {
        clearInterval(timer);
        select.value = langCode;
        select.dispatchEvent(new Event('change'));
        forceHideGoogleElements();
      } else if (attempts >= 30) {
        clearInterval(timer);
        setGoogTransCookie(langCode);
        location.reload();
      }
    }, 200);
  }

  // ── 5. Masquer de force tous les éléments Google ────────────────────
  function forceHideGoogleElements() {
    [
      '.goog-te-banner-frame', '#goog-gt-tt', '#goog-gt-', '.goog-te-balloon-frame', 'iframe.goog-te-menu-frame',
      '.VIpgJd-ZVi9od-aZ2wEe-wOHMyf', '.VIpgJd-ZVi9od-ORHb-OEVmcd', '.VIpgJd-ZVi9od-aZ2wEe-OiiCO', 
      '.VIpgJd-ZVi9od-SMfZPh-hFEqM', 'div[id^="goog-gt-"]', '.goog-te-gadget', '.goog-logo-link'
    ].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('width', '0', 'important');
        el.style.setProperty('height', '0', 'important');
        el.style.setProperty('z-index', '-99999', 'important');
      });
    });

    // Attaquer spécifiquement toute balise image ou iframe de Google
    document.querySelectorAll('iframe[src*="translate"], img[src*="translate.google"]').forEach(function(el) {
      el.style.setProperty('display', 'none', 'important');
      // Si c'est enveloppé dans une div non contrôlée, la masquer aussi
      if (el.parentElement && el.parentElement.id !== 'google_translate_element') {
        el.parentElement.style.setProperty('display', 'none', 'important');
        el.parentElement.style.setProperty('opacity', '0', 'important');
        el.parentElement.style.setProperty('transform', 'scale(0)', 'important');
        el.parentElement.style.setProperty('pointer-events', 'none', 'important');
      }
    });

    document.body.style.top = '0';
  }

  // ── 6. Observer continu ─────────────────────────────────────────────
  function watchAndHide() {
    var observer = new MutationObserver(function () {
      forceHideGoogleElements();
      if (document.body.style.top && document.body.style.top !== '0px') {
        document.body.style.top = '0';
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style','class'] });
  }

  // ── 7. Revenir en français ──────────────────────────────────────────
  function revertToFrench() {
    clearGoogTransCookie();
    var select = document.querySelector('.goog-te-combo');
    if (select) { select.value = 'fr'; select.dispatchEvent(new Event('change')); forceHideGoogleElements(); return; }
    try {
      var iframe = document.querySelector('.goog-te-banner-frame');
      if (iframe && iframe.contentDocument) { var btn = iframe.contentDocument.querySelector('#restore'); if (btn) { btn.click(); return; } }
    } catch (e) {}
    location.reload();
  }

  // ── 8. Mettre à jour les boutons ────────────────────────────────────
  function updateButtons(lang) {
    document.querySelectorAll('.lang-selector').forEach(function (btn) {
      var cur = btn.querySelector('.lang-current');
      if (cur) cur.textContent = lang.toUpperCase();
      btn.setAttribute('aria-label', lang === 'fr' ? 'Changer la langue — actuellement Français, cliquer pour Anglais' : 'Change language — currently English, click for French');
      btn.classList.toggle('lang-active-en', lang === 'en');
    });
  }

  // ── 9. Toggle FR ↔ EN ───────────────────────────────────────────────
  function toggleLang() {
    var current = localStorage.getItem(STORAGE_KEY) || 'fr';
    var next = current === 'fr' ? 'en' : 'fr';
    localStorage.setItem(STORAGE_KEY, next);
    updateButtons(next);
    document.querySelectorAll('.lang-selector').forEach(function (btn) { btn.setAttribute('disabled','true'); btn.style.opacity = '0.6'; });
    if (next === 'en') { applyTranslation('en'); } else { revertToFrench(); }
    setTimeout(function () { document.querySelectorAll('.lang-selector').forEach(function (btn) { btn.removeAttribute('disabled'); btn.style.opacity = ''; }); }, 3000);
  }

  // ── 10. Init ─────────────────────────────────────────────────────────
  injectHideStyles(); // Avant DOMContentLoaded

  document.addEventListener('DOMContentLoaded', function () {
    injectGoogleTranslate();
    forceHideGoogleElements();
    watchAndHide();
    document.querySelectorAll('.lang-selector').forEach(function (btn) { btn.addEventListener('click', toggleLang); });
    var saved = localStorage.getItem(STORAGE_KEY) || 'fr';
    updateButtons(saved);
  });

  window.addEventListener('load', forceHideGoogleElements);

})();
