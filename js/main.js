/* ============================================================
   Miralocks — main.js Version: 2.0
   ============================================================ */

'use strict';

// ── Utilitaires ──────────────────────────────────────────────────
// Debounce pour optimiser les événements resize
function debounce(fn, delay = 150) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ── Loader ──────────────────────────────────────────────────────
const loader = document.getElementById('page-loader');
if (loader) {
  const hideLoader = () => loader.classList.add('hidden');

  // En local (file://) : masquer immédiatement, Supabase n'est pas disponible
  if (window.location.protocol === 'file:') {
    setTimeout(hideLoader, 400);
  } else {
    window.addEventListener('load', () => setTimeout(hideLoader, 300));
    // Fallback : masquer après 2s max quoi qu'il arrive
    setTimeout(hideLoader, 2000);
  }
}

// ── Nav scroll ──────────────────────────────────────────────────
const nav = document.querySelector('.nav');
if (nav) {
  let lastScroll = 0;
  let ticking = false;
  const updateNav = () => {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 50);
    lastScroll = y;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(updateNav); ticking = true; }
  }, { passive: true });
}

// ── Hamburger menu ───────────────────────────────────────────────
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

// Créer l'overlay dynamiquement
let navOverlay = document.querySelector('.nav-overlay');
if (!navOverlay) {
  navOverlay = document.createElement('div');
  navOverlay.className = 'nav-overlay';
  document.body.appendChild(navOverlay);
}

function openNav() {
  hamburger.classList.add('open');
  navLinks.classList.add('open');
  navOverlay.classList.add('open');
  hamburger.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}
function closeNav() {
  hamburger.classList.remove('open');
  navLinks.classList.remove('open');
  navOverlay.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}

if (hamburger && navLinks) {
  hamburger.addEventListener('click', function (e) {
    e.stopPropagation();
    hamburger.classList.contains('open') ? closeNav() : openNav();
  });

  // Clic sur un lien du menu — laisser la navigation se faire normalement
  navLinks.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      // Ne pas bloquer le lien, juste fermer le menu
      closeNav();
      // La navigation se fait naturellement après
    });
  });

  // Fermer en cliquant sur l'overlay
  navOverlay.addEventListener('click', closeNav);

  // Fermer avec Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });
}

// ── Active nav link ──────────────────────────────────────────────
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach(a => {
  const href = a.getAttribute('href');
  if (href === currentPage || (currentPage === '' && href === 'index.html')) {
    a.classList.add('active');
    a.setAttribute('aria-current', 'page');
  }
});

// ── Animations sur scroll (IntersectionObserver) ────────────────────
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  // Observer tous les types d'animations
  document.querySelectorAll('.fade-in, .reveal-up, .reveal-left, .reveal-right').forEach(el => io.observe(el));
}

// ── FAQ accordion ────────────────────────────────────────────────
document.querySelectorAll('.faq-item').forEach(item => {
  const btn = item.querySelector('.faq-question');
  if (!btn) return;

  // Initialisation ARIA
  btn.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');

  btn.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');

    // Fermer tous
    document.querySelectorAll('.faq-item').forEach(o => {
      o.classList.remove('open');
      const q = o.querySelector('.faq-question');
      if (q) q.setAttribute('aria-expanded', 'false');
    });

    // Ouvrir celui-ci si pas déjà ouvert
    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});

// ── FAQ filtres ──────────────────────────────────────────────────
document.querySelectorAll('.faq-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.faq-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    document.querySelectorAll('.faq-item').forEach(item => {
      const show = cat === 'tout' || item.dataset.cat === cat;
      item.style.display = show ? '' : 'none';
    });
  });
});

// ── Avant/Après slider ───────────────────────────────────────────
function initSliders() {
  document.querySelectorAll('.ba-item').forEach(function (item) {
    var before = item.querySelector('.ba-before');
    var after = item.querySelector('.ba-after');
    var divider = item.querySelector('.ba-divider');
    var handle = item.querySelector('.ba-handle');
    if (!before || !after) return;

    var pct = 50;
    var dragging = false;
    var startX = 0, startY = 0, isHorizDrag = null;

    // PERFORMANCE: cache le rect pour éviter le forced layout à chaque événement
    var cachedRect = null;
    function getRect() {
      if (!cachedRect) cachedRect = item.getBoundingClientRect();
      return cachedRect;
    }
    // Invalider le cache au resize (avec debounce pour performance)
    window.addEventListener('resize', debounce(function () { cachedRect = null; }), { passive: true });

    function applyPos(p) {
      pct = Math.min(Math.max(p, 1), 99);
      before.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      after.style.clipPath = 'inset(0 0 0 ' + pct + '%)';
      if (divider) divider.style.left = pct + '%';
      if (handle) {
        handle.style.left = pct + '%';
        handle.style.top = '50%';
      }
    }

    function getPct(clientX) {
      var rect = getRect();
      return (clientX - rect.left) / rect.width * 100;
    }

    // ── Mouse ──
    item.addEventListener('mousedown', function (e) {
      dragging = true;
      applyPos(getPct(e.clientX));
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (dragging) applyPos(getPct(e.clientX));
    });
    document.addEventListener('mouseup', function () { dragging = false; });

    // ── Touch : détection direction stricte pour ne jamais bloquer le scroll ──
    var touchLocked = false; // true = scroll vertical verrouillé sur cette interaction

    item.addEventListener('touchstart', function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isHorizDrag = null;
      dragging = false;
      touchLocked = false;
    }, { passive: true });

    item.addEventListener('touchmove', function (e) {
      // Si on a déjà déterminé que c'est un scroll vertical → ignorer
      if (touchLocked) return;

      var dx = Math.abs(e.touches[0].clientX - startX);
      var dy = Math.abs(e.touches[0].clientY - startY);

      // Attendre un mouvement suffisant pour être sûr de la direction
      if (dx < 8 && dy < 8) return;

      if (isHorizDrag === null) {
        // Exiger que le mouvement horizontal soit au moins 2x le vertical
        if (dx >= dy * 2) {
          isHorizDrag = true;
          dragging = true;
        } else {
          // Mouvement vertical ou diagonal → laisser le scroll se faire
          isHorizDrag = false;
          touchLocked = true;
          return;
        }
      }

      if (dragging && isHorizDrag) {
        e.preventDefault(); // bloque le scroll seulement si drag horizontal confirmé
        applyPos(getPct(e.touches[0].clientX));
      }
    }, { passive: false });

    item.addEventListener('touchend', function () { dragging = false; isHorizDrag = null; touchLocked = false; });
    item.addEventListener('touchcancel', function () { dragging = false; isHorizDrag = null; touchLocked = false; });

    // Position initiale
    applyPos(50);


  });
}

// Lancer après chargement complet
if (document.readyState === 'complete') {
  initSliders();
} else {
  window.addEventListener('load', initSliders);
}

// ── Lightbox ─────────────────────────────────────────────────────
const lightbox = document.getElementById('lightbox');
const lbImg = lightbox ? lightbox.querySelector('.lightbox-img') : null;
const lbClose = lightbox ? lightbox.querySelector('.lightbox-close') : null;
const lbPrev = lightbox ? lightbox.querySelector('.lightbox-prev') : null;
const lbNext = lightbox ? lightbox.querySelector('.lightbox-next') : null;
let lbItems = [];
let lbIndex = 0;

if (lightbox && lbImg) {
  // Focus Trap (Accessibility)
  let lastFocusedElement = null;
  const focusableElementsString = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  const openLightbox = (items, index) => {
    if (!lbImg) return;
    lastFocusedElement = document.activeElement; // Sauvegarde le focus actuel
    lbItems = items; lbIndex = index;
    lbImg.src = items[index].src;
    lbImg.alt = items[index].alt || '';
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Focus automatique dans la lightbox
    setTimeout(() => {
      const focusable = Array.from(lightbox.querySelectorAll(focusableElementsString));
      if (focusable.length) focusable[0].focus();
    }, 100);
  };
  const closeLightbox = () => {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    if (lastFocusedElement) lastFocusedElement.focus(); // Restaure le focus
  };
  const showAdj = (dir) => {
    lbIndex = (lbIndex + dir + lbItems.length) % lbItems.length;
    lbImg.style.opacity = '0';
    setTimeout(() => {
      lbImg.src = lbItems[lbIndex].src;
      lbImg.style.opacity = '1';
    }, 180);
  };

  lbClose?.addEventListener('click', closeLightbox);
  lbPrev?.addEventListener('click', () => showAdj(-1));
  lbNext?.addEventListener('click', () => showAdj(1));

  // Désactivation de la fermeture par clic dans l'arrière-plan (évite les erreurs tactiles)
  // lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showAdj(-1);
    if (e.key === 'ArrowRight') showAdj(1);

    // Trap focus avec Tab
    if (e.key === 'Tab') {
      const focusable = Array.from(lightbox.querySelectorAll(focusableElementsString));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === lightbox) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    }
  });

  // Galerie cliquable — uniquement sur les items sans gestionnaire dédié
  // Les pages ayant data-lightbox-managed="true" gèrent leur propre lightbox (ex: gallery.html)
  if (!document.body.dataset.lightboxManaged) {
    const galleryImgs = Array.from(document.querySelectorAll('.gallery-item img'));
    galleryImgs.forEach((img, i) => {
      img.closest('.gallery-item').addEventListener('click', () => {
        openLightbox(galleryImgs.map(im => ({ src: im.src, alt: im.alt })), i);
      });
    });
  }
}

// ── Stats counter ────────────────────────────────────────────────
const statsSection = document.querySelector('.stats');
if (statsSection && 'IntersectionObserver' in window) {
  const countUp = (el, target, suffix) => {
    // Annuler une animation en cours si elle existe
    if (el._animFrame) cancelAnimationFrame(el._animFrame);
    let current = 0;
    const step = Math.ceil(target / 60);
    const tick = () => {
      current = Math.min(current + step, target);
      el.textContent = current + suffix;
      if (current < target) el._animFrame = requestAnimationFrame(tick);
    };
    el._animFrame = requestAnimationFrame(tick);
  };

  const statsIo = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    document.querySelectorAll('.stat-number[data-target]').forEach(el => {
      countUp(el, +el.dataset.target, el.dataset.suffix || '');
    });
  }, { threshold: 0.5 });
  statsIo.observe(statsSection);
}

// ── Cookie banner ────────────────────────────────────────────────
const cookieBanner = document.querySelector('.cookie-banner');
if (cookieBanner && !localStorage.getItem('Miralocks_cookies')) {
  setTimeout(() => cookieBanner.classList.add('visible'), 1500);
  cookieBanner.querySelector('.cookie-accept')?.addEventListener('click', () => {
    localStorage.setItem('Miralocks_cookies', '1');
    cookieBanner.classList.remove('visible');
  });
  cookieBanner.querySelector('.cookie-refuse')?.addEventListener('click', () => {
    localStorage.setItem('Miralocks_cookies', '0');
    cookieBanner.classList.remove('visible');
  });
}

// (Le formulaire RDV est désormais géré directement dans rendezvous.html pour inclure l'enregistrement Supabase)

// ── Theme ────────────────────────────────────────────────────────
// Injection rapide déjà faite dans le <head> de chaque page HTML.
// Ici on branche le bouton toggle et on met à jour l'icône.
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const html = document.documentElement;

  const updateIcon = (theme) => {
    if (!toggleBtn) return;
    const icon = toggleBtn.querySelector('i');
    if (!icon) return;
    if (theme === 'dark') {
      icon.className = 'fas fa-sun';
    } else {
      icon.className = 'fas fa-moon';
    }
  };

  // Synchroniser l'icône avec le thème actuel
  updateIcon(html.dataset.theme || 'light');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const newTheme = html.dataset.theme === 'dark' ? 'light' : 'dark';
      html.dataset.theme = newTheme;
      localStorage.setItem('Miralocks_theme', newTheme);
      updateIcon(newTheme);
    });
  }
}
// ── Copyright dynamisation ────────────────────────────────────
function initCopyright() {
  const year = new Date().getFullYear();
  document.querySelectorAll('.footer-bottom span, .footer-copyright').forEach(span => {
    if (span.textContent.includes('©')) {
      span.textContent = span.textContent.replace(/\d{4}/, year);
    }
  });
}

// ── WhatsApp Contextuel ──────────────────────────────────────
function initWhatsAppContext() {
  const waBtn = document.querySelector('.whatsapp-float');
  if (!waBtn) return;

  const page = window.location.pathname.split('/').pop() || 'index.html';
  let msg = "Bonjour Miralocks ! 👋\nJ'aimerais avoir quelques renseignements.";

  if (page.includes('services')) {
    msg = "Bonjour ! 👋\nJe consulte vos tarifs et j'aimerais un devis ou plus d'infos sur une prestation.";
  } else if (page.includes('gallery') || page.includes('avant-apres')) {
    msg = "Bonjour ! 👋\nJ'adore vos réalisations ! J'aimerais en savoir plus pour obtenir un résultat similaire.";
  } else if (page.includes('blog')) {
    msg = "Bonjour ! 👋\nJe viens de lire votre article de blog et j'aurais une question sur vos conseils.";
  } else if (page.includes('rendezvous') || page.includes('contact')) {
    msg = "Bonjour ! 👋\nJe souhaite prendre rendez-vous (ou j'ai une question urgente). Merci !";
  }

  const phone = "22897989001";
  waBtn.href = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

  // Afficher la bulle d'aide après 5 secondes
  setTimeout(() => {
    waBtn.classList.add('show-tip');
    // La masquer après 10 secondes supplémentaires pour ne pas gêner
    setTimeout(() => waBtn.classList.remove('show-tip'), 10000);
  }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initCopyright();
  initWhatsAppContext();
  // Enregistrer la visite (tracking interne Supabase)
  if (typeof sb !== 'undefined' && sb.visites) sb.visites.track();
});

// ── Navigation et Raccourcis Secrets ──────────────────────────
(function () {
  var _p = 'admin.html'; 
  var REQUIRED_TAPS = 3;

  // Nouveau Raccourci : Ctrl + Alt + Shift + M
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.altKey && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      // On s'assure de retourner à la racine pour l'admin si on est sur une page profonde
      const rootPath = window.location.pathname.includes('/') ? 
                       window.location.pathname.split('/').slice(0, -1).join('/') + '/' : './';
      window.location.href = rootPath + _p;
    }
  });

  // Triple tap/clic logo
  var logo = document.querySelector('.nav-logo');
  if (!logo) return;

  var taps = 0, tapTimer = null, lastTap = 0;

  logo.addEventListener('click', function (e) {
    var now = Date.now();
    var timeSinceLast = now - lastTap;
    if (timeSinceLast > 400) taps = 0;
    taps++;
    lastTap = now;
    clearTimeout(tapTimer);

    if (taps >= REQUIRED_TAPS) {
      e.preventDefault();
      taps = 0;
      logo.style.transition = 'opacity .15s';
      logo.style.opacity = '.3';
      setTimeout(function () {
        logo.style.opacity = '';
        const rootPath = window.location.pathname.includes('/') ? 
                         window.location.pathname.split('/').slice(0, -1).join('/') + '/' : './';
        window.location.href = rootPath + _p;
      }, 200);
    } else {
      tapTimer = setTimeout(function () { taps = 0; }, 400);
    }
  });
})();

// ── PWA Installation Logic ────────────────────────────────────
(function() {
  let deferredPrompt;
  const installBtn = document.getElementById('pwa-install-btn');

  if (!installBtn) return;

  const isIos = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase()) && !window.MSStream;
  const isIosSafari = isIos && /webkit/.test(navigator.userAgent.toLowerCase()) && !/crios|fxios/.test(navigator.userAgent.toLowerCase());
  const isPwa = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (isIosSafari && !isPwa) {
    installBtn.style.display = 'inline-flex';
    installBtn.style.alignItems = 'center';
    installBtn.style.gap = '.4rem';

    // Afficher une bulle d'instructions visible sans clic sur iOS
    const iosTip = document.createElement('div');
    iosTip.style.cssText = [
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%)',
      'background:#fff;color:#0C3320;border:2px solid #C9A84C',
      'border-radius:12px;padding:.75rem 1.1rem;font-size:.85rem',
      'box-shadow:0 4px 20px rgba(0,0,0,.18);z-index:9999',
      'max-width:300px;text-align:center;line-height:1.5',
      'animation:fadeInUp .4s ease'
    ].join(';');
    iosTip.innerHTML = "📲 <strong>Installer l'app</strong><br>Touchez <strong>⍗</strong> puis <em>'Sur l'écran d'accueil'</em>";

    // Ajouter bouton fermeture
    const closeIos = document.createElement('button');
    closeIos.innerHTML = '✕';
    closeIos.setAttribute('aria-label', 'Fermer');
    closeIos.style.cssText = 'position:absolute;top:4px;right:8px;background:none;border:none;font-size:1rem;cursor:pointer;color:#888';
    closeIos.onclick = () => iosTip.remove();
    iosTip.appendChild(closeIos);

    // Afficher après 3s, masquer après 12s
    setTimeout(() => {
      document.body.appendChild(iosTip);
      setTimeout(() => iosTip.remove(), 12000);
    }, 3000);

    installBtn.addEventListener('click', () => {
      alert("Sur iPhone/iPad, l'installation est manuelle :\n\n1. Touchez l'icône de partage ⍗ (le carré avec une flèche) au centre en bas de votre écran.\n2. Faites défiler et choisissez 'Sur l\'écran d\'accueil' ➕.");
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    // Empêcher l'affichage automatique par défaut
    e.preventDefault();
    deferredPrompt = e;
    // Afficher le bouton personnalisé
    installBtn.style.display = 'inline-flex';
    installBtn.style.alignItems = 'center';
    installBtn.style.gap = '.4rem';
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });

  window.addEventListener('appinstalled', () => {
    installBtn.style.display = 'none';
  });
})();

// Fin du fichier main.js
