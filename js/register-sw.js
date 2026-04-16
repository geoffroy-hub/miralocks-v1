/* ============================================================
   Miralocks — register-sw.js Version: 2.0 
   ============================================================ */

// Enregistrement Service Worker Miralocks
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Les Service Workers ne fonctionnent pas en local avec le protocole file://
    if (window.location.protocol === 'file:') {

      return;
    }

    // Correction du chemin pour qu'il fonctionne depuis n'importe où
    const swPath = window.location.pathname.includes('/htdocs/')
      ? './sw.js'
      : '/sw.js';

    navigator.serviceWorker.register(swPath)
      .then(r => { })
      .catch(e => { });
  });
}
