/* ============================================================
   Miralocks — performance.js  v1.0
   Optimisations performance :
   4.  Géolocalisation itinéraire (contact.html)
   5.  Splash screen PWA personnalisé
   6.  Gestes tactiles galerie (swipe + pinch-zoom)
   13. Lazy loading avec blur-up placeholder
   14. Cache IndexedDB (services, galerie)
   15. Préchargement pages suivantes
   ============================================================ */


/* ══════════════════════════════════════════════════════════
   13. LAZY LOADING BLUR-UP
   Affiche un placeholder flou pendant le chargement
   Utilise l'API IntersectionObserver
══════════════════════════════════════════════════════════ */
(function initBlurUpLazyLoad() {
  if (!('IntersectionObserver' in window)) return;

  /* Injecter les styles */
  const style = document.createElement('style');
  style.textContent = `
    img[data-src] {
      filter: blur(12px);
      transform: scale(1.03);
      transition: filter .5s ease, transform .5s ease;
    }
    img[data-src].blur-loaded {
      filter: none;
      transform: scale(1);
    }
    .img-placeholder {
      background: linear-gradient(135deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer-img 1.4s infinite;
    }
    @keyframes shimmer-img { to { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) {
      img[data-src] { filter: none; transform: none; transition: none; }
    }
  `;
  document.head.appendChild(style);

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      const src = img.dataset.src;
      if (!src) return;

      /* Créer une image temporaire pour détecter le chargement */
      const tmp = new Image();
      tmp.onload = () => {
        img.src = src;
        img.classList.add('blur-loaded');
        img.removeAttribute('data-src');
        img.closest('.img-placeholder')?.classList.remove('img-placeholder');
      };
      tmp.src = src;
      io.unobserve(img);
    });
  }, { rootMargin: '200px 0px', threshold: 0 });

  /* Convertir les images lazy existantes */
  function convertImages() {
    document.querySelectorAll('img[loading="lazy"]:not([data-src]):not([data-no-blur])').forEach(img => {
      if (!img.src || img.src.startsWith('data:') || img.complete) return;
      img.dataset.src = img.src;
      /* Placeholder 1px transparent */
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
      img.closest('.gallery-item, .ba-item, .avis-card, .blog-card')?.classList.add('img-placeholder');
      io.observe(img);
    });
  }

  document.addEventListener('DOMContentLoaded', convertImages);

  /* Observer les images ajoutées dynamiquement */
  const domObserver = new MutationObserver(() => convertImages());
  document.addEventListener('DOMContentLoaded', () => {
    domObserver.observe(document.body, { childList: true, subtree: true });
  });

  window.reInitLazyLoad = convertImages;
})();


/* ══════════════════════════════════════════════════════════
   14. CACHE INDEXEDDB
   Stocke galerie + services pour affichage instantané
══════════════════════════════════════════════════════════ */
window.IDBCache = {
  DB_NAME: 'MiralocksCache',
  DB_VERSION: 1,
  _db: null,

  async open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('data')) {
          db.createObjectStore('data', { keyPath: 'key' });
        }
      };
      req.onsuccess = e => { this._db = e.target.result; resolve(this._db); };
      req.onerror = () => reject(req.error);
    });
  },

  async get(key) {
    try {
      const db = await this.open();
      return new Promise((resolve) => {
        const tx = db.transaction('data', 'readonly');
        const req = tx.objectStore('data').get(key);
        req.onsuccess = () => {
          const record = req.result;
          if (!record) { resolve(null); return; }
          /* TTL : expirer après 30 minutes */
          if (Date.now() - record.ts > 30 * 60 * 1000) { resolve(null); return; }
          resolve(record.value);
        };
        req.onerror = () => resolve(null);
      });
    } catch { return null; }
  },

  async set(key, value) {
    try {
      const db = await this.open();
      return new Promise((resolve) => {
        const tx = db.transaction('data', 'readwrite');
        tx.objectStore('data').put({ key, value, ts: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch { return false; }
  },

  async clear() {
    try {
      const db = await this.open();
      return new Promise((resolve) => {
        const tx = db.transaction('data', 'readwrite');
        tx.objectStore('data').clear();
        tx.oncomplete = () => resolve(true);
      });
    } catch { return false; }
  },
};

/* Patcher sb.galerie.list pour utiliser IndexedDB */
if (window.sb) {
  const _origGalerieList = sb.galerie.list.bind(sb.galerie);
  sb.galerie.list = async function(onlyPublished = true) {
    const cacheKey = `galerie_list_${onlyPublished}`;
    const cached = await IDBCache.get(cacheKey);
    if (cached) {
      /* Retourner le cache immédiatement et rafraîchir en arrière-plan */
      _origGalerieList(onlyPublished).then(fresh => {
        if (fresh?.length) IDBCache.set(cacheKey, fresh);
      }).catch(() => {});
      return cached;
    }
    const data = await _origGalerieList(onlyPublished);
    if (data?.length) await IDBCache.set(cacheKey, data);
    return data;
  };

  const _origServicesList = sb.services?.list?.bind(sb.services);
  if (_origServicesList) {
    sb.services.list = async function(onlyActive = true) {
      const cacheKey = `services_list_${onlyActive}`;
      const cached = await IDBCache.get(cacheKey);
      if (cached) {
        _origServicesList(onlyActive).then(fresh => {
          if (fresh?.length) IDBCache.set(cacheKey, fresh);
        }).catch(() => {});
        return cached;
      }
      const data = await _origServicesList(onlyActive);
      if (data?.length) await IDBCache.set(cacheKey, data);
      return data;
    };
  }
}


/* ══════════════════════════════════════════════════════════
   15. PRÉCHARGEMENT DES PAGES SUIVANTES
   Charge les pages les plus visitées en arrière-plan
══════════════════════════════════════════════════════════ */
(function initPagePrefetch() {
  /* Pages à précharger selon la page courante */
  const PREFETCH_MAP = {
    'index.html':       ['gallery.html', 'rendezvous.html', 'services.html'],
    '':                 ['gallery.html', 'rendezvous.html', 'services.html'],
    'services.html':    ['rendezvous.html', 'gallery.html'],
    'blog.html':        ['rendezvous.html', 'services.html'],
    'avis.html':        ['rendezvous.html', 'gallery.html'],
  };

  const page = window.location.pathname.split('/').pop() || '';
  const toPreload = PREFETCH_MAP[page] || [];

  /* Précharger après 2 secondes (laisser la page courante se charger d'abord) */
  if (toPreload.length && 'requestIdleCallback' in window) {
    requestIdleCallback(() => {
      toPreload.forEach(href => {
        if (document.querySelector(`link[rel="prefetch"][href="${href}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = href;
        link.as = 'document';
        document.head.appendChild(link);
      });
    }, { timeout: 2000 });
  } else if (toPreload.length) {
    setTimeout(() => {
      toPreload.forEach(href => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = href;
        document.head.appendChild(link);
      });
    }, 2000);
  }

  /* Aussi précharger au survol des liens */
  document.addEventListener('mouseover', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('tel') || href.startsWith('mailto')) return;
    if (document.querySelector(`link[rel="prefetch"][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  });
})();


/* ══════════════════════════════════════════════════════════
   4. GÉOLOCALISATION POUR ITINÉRAIRE
   Bouton "M'y conduire" avec position GPS
══════════════════════════════════════════════════════════ */
window.getDirections = function() {
  const DEST_LAT = 6.224345, DEST_LNG = 1.193420;
  const DEST_NAME = 'Institut+MiraLocks+Lom%C3%A9';

  if (!navigator.geolocation) {
    /* Fallback : ouvrir Google Maps sans position */
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${DEST_LAT},${DEST_LNG}`, '_blank');
    return;
  }

  /* Bouton en état de chargement */
  const btn = document.getElementById('btn-directions');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Localisation…'; }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      const ua = navigator.userAgent;

      let url;
      if (/iPhone|iPad|iPod/i.test(ua)) {
        /* iOS : ouvrir dans Apple Maps puis Google Maps en fallback */
        url = `maps://maps.apple.com/?saddr=${latitude},${longitude}&daddr=${DEST_LAT},${DEST_LNG}&dirflg=d`;
      } else if (/android/i.test(ua)) {
        /* Android : Google Maps avec navigation */
        url = `google.navigation:q=${DEST_LAT},${DEST_LNG}`;
      } else {
        url = `https://www.google.com/maps/dir/${latitude},${longitude}/${DEST_LAT},${DEST_LNG}`;
      }

      window.open(url, '_blank');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-route"></i> M\'y conduire'; }
    },
    () => {
      /* Permission refusée : fallback sans position */
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${DEST_LAT},${DEST_LNG}&destination_place_id=ChIJ_miralocks`, '_blank');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-route"></i> M\'y conduire'; }
    },
    { timeout: 8000, maximumAge: 60000 }
  );
};

/* Waze */
window.getDirectionsWaze = function() {
  window.open('https://waze.com/ul?ll=6.224345,1.193420&navigate=yes', '_blank', 'noopener');
};

/* Injecter le bouton "M'y conduire" si on est sur contact.html */
document.addEventListener('DOMContentLoaded', () => {
  const contactSection = document.querySelector('.contact-map, #map-section, [aria-label*="contact" i], [aria-label*="localisation" i]');
  if (!contactSection && !window.location.pathname.includes('contact')) return;

  /* Chercher les boutons de carte existants et ajouter la géolocalisation */
  const existingBtns = document.querySelectorAll('.btn[href*="maps"], a[href*="maps.google"], a[href*="maps.apple"]');
  if (existingBtns.length === 0) return;

  const geoDiv = document.createElement('div');
  geoDiv.style.cssText = 'display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem';
  geoDiv.innerHTML = `
    <button id="btn-directions" onclick="getDirections()" class="btn btn-or" style="display:inline-flex;align-items:center;gap:.4rem;font-size:.9rem">
      <i class="fas fa-route"></i> M'y conduire
    </button>
    <button onclick="getDirectionsWaze()" class="btn btn-outline" style="display:inline-flex;align-items:center;gap:.4rem;font-size:.9rem;background:#33ccff;color:#fff;border-color:#33ccff">
      <i class="fas fa-car"></i> Waze
    </button>
  `;
  existingBtns[0].closest('div, p, li')?.after(geoDiv);
});


/* ══════════════════════════════════════════════════════════
   5. SPLASH SCREEN PWA PERSONNALISÉ
   Améliore l'expérience au lancement depuis l'écran d'accueil
══════════════════════════════════════════════════════════ */
(function initPWASplash() {
  /* Détecter si lancé en mode standalone (PWA) */
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone
    || document.referrer.includes('android-app://');

  if (!isStandalone) return;

  /* Créer le splash screen */
  const splash = document.createElement('div');
  splash.id = 'pwa-splash';
  splash.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:var(--vert,#0C3320);
    display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    gap:1.5rem;
    transition:opacity .4s ease, transform .4s ease;
  `;
  splash.innerHTML = `
    <picture>
      <source srcset="assets/logo-or.avif" type="image/avif">
      <source srcset="assets/logo-or.webp" type="image/webp">
      <img src="assets/logo-or.png" alt="Miralocks" style="width:120px;height:auto;animation:splashPulse 1s ease infinite alternate">
    </picture>
    <div style="text-align:center">
      <div style="color:var(--or,#C9A84C);font-size:1.5rem;font-weight:800;letter-spacing:.02em">Miralocks</div>
      <div style="color:rgba(255,255,255,.6);font-size:.85rem;margin-top:.25rem">Institut de locks à Lomé</div>
    </div>
    <div style="width:40px;height:3px;background:rgba(201,168,76,.3);border-radius:2px;overflow:hidden">
      <div id="splash-bar" style="width:0%;height:100%;background:var(--or,#C9A84C);border-radius:2px;transition:width .1s linear"></div>
    </div>
    <style>
      @keyframes splashPulse { from{transform:scale(.95)} to{transform:scale(1.05)} }
    </style>
  `;
  document.body.prepend(splash);

  /* Animation de la barre de progression */
  let progress = 0;
  const bar = splash.querySelector('#splash-bar');
  const interval = setInterval(() => {
    progress = Math.min(progress + Math.random() * 15, 90);
    if (bar) bar.style.width = progress + '%';
  }, 150);

  /* Masquer le splash quand la page est prête */
  window.addEventListener('load', () => {
    clearInterval(interval);
    if (bar) bar.style.width = '100%';
    setTimeout(() => {
      splash.style.opacity = '0';
      splash.style.transform = 'scale(1.05)';
      setTimeout(() => splash.remove(), 400);
    }, 300);
  });
})();


/* ══════════════════════════════════════════════════════════
   6. GESTES TACTILES SUR LA GALERIE
   Swipe + Pinch-to-zoom dans la lightbox
══════════════════════════════════════════════════════════ */
(function initGalleryGestures() {
  document.addEventListener('DOMContentLoaded', () => {
    const lb = document.getElementById('lightbox');
    if (!lb) return;

    /* Variables de geste */
    let touches = [], scale = 1, lastScale = 1;
    let panX = 0, panY = 0, lastPanX = 0, lastPanY = 0;
    const img = lb.querySelector('.lightbox-img');
    if (!img) return;

    function applyTransform() {
      img.style.transform = `scale(${scale}) translate(${panX/scale}px, ${panY/scale}px)`;
    }

    function resetTransform() {
      scale = 1; panX = 0; panY = 0; lastScale = 1; lastPanX = 0; lastPanY = 0;
      img.style.transform = '';
      img.style.transition = 'transform .3s ease';
      setTimeout(() => img.style.transition = '', 300);
    }

    lb.addEventListener('touchstart', e => {
      touches = Array.from(e.touches);
      img.style.transition = 'none';
    }, { passive: true });

    lb.addEventListener('touchmove', e => {
      const curr = Array.from(e.touches);

      if (curr.length === 2) {
        /* Pinch-to-zoom */
        e.preventDefault();
        const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (touches.length === 2) {
          const prevDist = dist(touches[0], touches[1]);
          const currDist = dist(curr[0], curr[1]);
          const delta = currDist / prevDist;
          scale = Math.max(1, Math.min(4, lastScale * delta));
          applyTransform();
        }
      } else if (curr.length === 1 && scale > 1) {
        /* Pan quand zoomé */
        e.preventDefault();
        if (touches.length === 1) {
          panX = lastPanX + (curr[0].clientX - touches[0].clientX);
          panY = lastPanY + (curr[0].clientY - touches[0].clientY);
          applyTransform();
        }
      }
      touches = curr;
    }, { passive: false });

    lb.addEventListener('touchend', e => {
      lastScale = scale;
      lastPanX = panX;
      lastPanY = panY;
      touches = Array.from(e.touches);
    }, { passive: true });

    /* Double-tap pour zoom/dézoom */
    let lastTap = 0;
    lb.addEventListener('touchend', e => {
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
        if (scale > 1) resetTransform();
        else { scale = 2; applyTransform(); lastScale = 2; }
      }
      lastTap = now;
    });

    /* Reset au fermeture */
    const closeBtns = lb.querySelectorAll('.lightbox-close');
    closeBtns.forEach(b => b.addEventListener('click', resetTransform));
    lb.addEventListener('click', e => { if (e.target === lb) resetTransform(); });
  });
})();
