/* ============================================================
   Miralocks — animations.js  v1.0
   Améliorations visuelles :
   1. Animations au scroll enrichies (stagger, parallax, reveal)
   2. Vidéo hero en boucle silencieuse
   3. Compteurs animés améliorés avec easing
   ============================================================ */

/* ══════════════════════════════════════════════════════════
   1. ANIMATIONS AU SCROLL ENRICHIES
   Stagger, parallax léger, entrées directionnelles variées
══════════════════════════════════════════════════════════ */
(function initScrollAnimations() {
  if (!('IntersectionObserver' in window)) return;

  /* Injecter les styles d'animation */
  const style = document.createElement('style');
  style.textContent = `
    /* ── Base : éléments cachés avant animation ── */
    .anim-fade    { opacity:0; transition: opacity .7s ease, transform .7s ease; }
    .anim-up      { opacity:0; transform:translateY(40px); transition: opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1); }
    .anim-down    { opacity:0; transform:translateY(-30px); transition: opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1); }
    .anim-left    { opacity:0; transform:translateX(-40px); transition: opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1); }
    .anim-right   { opacity:0; transform:translateX(40px); transition: opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1); }
    .anim-scale   { opacity:0; transform:scale(.88); transition: opacity .65s ease, transform .65s cubic-bezier(.16,1,.3,1); }
    .anim-flip    { opacity:0; transform:rotateX(-20deg) translateY(20px); transform-origin:top center; transition: opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1); }

    /* ── Délais stagger ── */
    .anim-d1 { transition-delay: .1s !important; }
    .anim-d2 { transition-delay: .2s !important; }
    .anim-d3 { transition-delay: .3s !important; }
    .anim-d4 { transition-delay: .4s !important; }
    .anim-d5 { transition-delay: .5s !important; }
    .anim-d6 { transition-delay: .6s !important; }

    /* ── État visible ── */
    .anim-fade.anim-visible,
    .anim-up.anim-visible,
    .anim-down.anim-visible,
    .anim-left.anim-visible,
    .anim-right.anim-visible,
    .anim-scale.anim-visible,
    .anim-flip.anim-visible {
      opacity: 1;
      transform: none;
    }

    /* ── Parallax hero ── */
    .hero-parallax { will-change: transform; }

    /* ── Highlight texte animé ── */
    .anim-highlight {
      background: linear-gradient(120deg, transparent 0%, rgba(201,168,76,.3) 0%);
      background-size: 200% 100%;
      background-position: 100% 0;
      transition: background-position 1s ease;
    }
    .anim-highlight.anim-visible {
      background-position: 0% 0;
    }

    /* ── Cards avec hover lift ── */
    .card-lift {
      transition: transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s ease;
      will-change: transform;
    }
    .card-lift:hover {
      transform: translateY(-6px);
      box-shadow: 0 16px 48px rgba(12,51,32,.12);
    }

    /* ── Ligne de séparation animée ── */
    .anim-line::after {
      content: '';
      display: block;
      width: 0;
      height: 3px;
      background: var(--or, #C9A84C);
      margin-top: .5rem;
      transition: width 1s cubic-bezier(.16,1,.3,1);
      border-radius: 2px;
    }
    .anim-line.anim-visible::after { width: 60px; }

    /* Respect reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .anim-fade, .anim-up, .anim-down, .anim-left, .anim-right, .anim-scale, .anim-flip {
        opacity: 1 !important;
        transform: none !important;
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);

  /* Observer principal */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('anim-visible');
      io.unobserve(e.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  /* Observer tous les éléments animés */
  const selectors = '.anim-fade,.anim-up,.anim-down,.anim-left,.anim-right,.anim-scale,.anim-flip,.anim-line,.anim-highlight';
  document.querySelectorAll(selectors).forEach(el => io.observe(el));

  /* Auto-stagger sur les grilles */
  document.querySelectorAll('.dash-grid, .gallery-grid, .services-grid, .avis-grid, .blog-grid').forEach(grid => {
    grid.querySelectorAll(':scope > *:not([class*="anim-"])').forEach((child, i) => {
      child.classList.add('anim-up', `anim-d${Math.min(i + 1, 6)}`);
      io.observe(child);
    });
  });

  /* Parallax léger sur le hero au scroll */
  const heroContent = document.querySelector('.hero-content');
  if (heroContent) {
    heroContent.classList.add('hero-parallax');
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < window.innerHeight) {
          heroContent.style.transform = `translateY(${y * 0.25}px)`;
          heroContent.style.opacity = 1 - (y / window.innerHeight) * 1.2;
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* Ajouter card-lift aux cards existantes */
  document.querySelectorAll('.avis-card, .service-card, .blog-card, .dash-card').forEach(c => {
    c.classList.add('card-lift');
  });

})();


/* ══════════════════════════════════════════════════════════
   2. VIDÉO HERO EN BOUCLE SILENCIEUSE
   Injecte une vidéo de fond dans la section hero
   si une URL est configurée dans site_settings
══════════════════════════════════════════════════════════ */
window.initHeroVideo = async function() {
  const hero = document.querySelector('.hero');
  if (!hero || !window.sb) return;

  try {
    const videoUrl = await sb.settings.get('hero_video_url').catch(() => null);
    if (!videoUrl) return;

    /* Créer le background vidéo */
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position:absolute;inset:0;overflow:hidden;z-index:0;
      pointer-events:none;
    `;

    const video = document.createElement('video');
    video.src = videoUrl;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('aria-hidden', 'true');
    video.style.cssText = `
      position:absolute;top:50%;left:50%;
      transform:translate(-50%,-50%);
      min-width:100%;min-height:100%;
      width:auto;height:auto;
      object-fit:cover;
      opacity:.35;
      filter:brightness(.7) saturate(.8);
    `;

    /* Overlay pour assurer la lisibilité du texte */
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:absolute;inset:0;
      background:linear-gradient(
        135deg,
        rgba(12,51,32,.75) 0%,
        rgba(12,51,32,.5) 50%,
        rgba(0,0,0,.4) 100%
      );
    `;

    wrapper.appendChild(video);
    wrapper.appendChild(overlay);

    /* S'assurer que le hero est positionné */
    if (getComputedStyle(hero).position === 'static') hero.style.position = 'relative';
    hero.insertBefore(wrapper, hero.firstChild);

    /* S'assurer que le contenu est au-dessus */
    document.querySelector('.hero-content')?.style.setProperty('position', 'relative');
    document.querySelector('.hero-content')?.style.setProperty('z-index', '1');

    /* Fallback si la vidéo ne charge pas */
    video.addEventListener('error', () => { wrapper.remove(); });

  } catch(e) {
    console.warn('[HeroVideo]', e.message);
  }
};

/* Charger la vidéo hero sur la page d'accueil */
if (window.location.pathname.match(/(index\.html|\/)?$/)) {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initHeroVideo, 300);
  });
}


/* ══════════════════════════════════════════════════════════
   3. COMPTEURS ANIMÉS ENRICHIS
   Easing, formatage local, déclenchement sur scroll
══════════════════════════════════════════════════════════ */
(function initEnhancedCounters() {

  /* Easing ease-out-expo */
  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function animateCounter(el, target, duration = 1800) {
    const suffix   = el.dataset.suffix || '';
    const prefix   = el.dataset.prefix || '';
    const decimals = el.dataset.decimals ? parseInt(el.dataset.decimals) : 0;
    const start    = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      const value = target * eased;
      const formatted = decimals
        ? value.toFixed(decimals)
        : Math.round(value).toLocaleString('fr-FR');
      el.textContent = prefix + formatted + suffix;
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  /* Observer les compteurs */
  if (!('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const target = parseFloat(e.target.dataset.target || 0);
      if (!isNaN(target) && target > 0) {
        animateCounter(e.target, target);
      }
      io.unobserve(e.target);
    });
  }, { threshold: 0.5 });

  /* Observer tous les compteurs (anciens et nouveaux) */
  document.querySelectorAll('[data-target]').forEach(el => {
    /* Remettre à zéro pour que l'animation parte de 0 */
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';
    el.textContent = prefix + '0' + suffix;
    io.observe(el);
  });

})();
