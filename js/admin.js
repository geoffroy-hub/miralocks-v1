/* ============================================================
   Miralocks Admin — admin.js (Core)
   Contient : Constantes, Utilitaires, Auth, Navigation,
              Drawer, Thème — et charge les modules.
   Modules séparés :
     admin-rdv.js       — Rendez-vous & Dashboard
     admin-galerie.js   — Galerie photos
     admin-videos-note  — Vidéos dans ce fichier (sb2, ne pas déplacer)
     admin-avis.js      — Avis clients
     admin-settings.js  — Paramètres & Paiements
     admin-services.js  — Prestations
     admin-charts.js    — Graphiques Dashboard
   ============================================================ */
/* Helper : échappement HTML pour éviter les injections XSS */
const _escAdmin = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');


// Script Admin Global

    /* ── Constantes Globales ─────────────────────────────────── */
    const RDV_STATUTS = {
      en_attente: { label: 'En attente', color: '#f59e0b', bg: '#FEF3C7', icon: 'clock' },
      confirme: { label: 'Confirmé', color: '#10b981', bg: '#d1fae5', icon: 'check-circle' },
      annule: { label: 'Annulé', color: '#ef4444', bg: '#fee2e2', icon: 'times-circle' },
      termine: { label: 'Terminé', color: '#6b7280', bg: '#f3f4f6', icon: 'flag-checkered' },
    };

    /* ── Utilitaires ─────────────────────────────────────────── */
    const $ = id => document.getElementById(id);
    const toast = (msg, type = 'success') => {
      const t = $('toast');
      t.textContent = msg;
      t.className = `show ${type}`;
      clearTimeout(t._timer);
      t._timer = setTimeout(() => t.className = '', 3200);
    };
    const showToast = toast; // Alias pour compatibilité
    window.toast     = toast;   // ← exposition globale pour les modules externes
    window.showToast = toast;   // ← exposition globale pour les modules externes
    window.togglePassword = (id) => {
      const el = $(id);
      if (el) el.type = el.type === 'password' ? 'text' : 'password';
    };
    function openModal(name) {
      if (name === 'blog') {
        const editId = $('blog-edit-id');
        if (editId && !editId.value) openModal_Blog_new();
      } else if (name === 'services') {
        const editId = $('service-edit-id');
        if (editId && !editId.value) openModal_Service_new();
      } else if (name === 'videos') {
        const editId = $('video-edit-id');
        if (editId && !editId.value) openModal_Video_new();
      }
      const modal = document.getElementById(`modal-${name}`);
      if (modal) modal.classList.add('open');
    }
    window.openModal = openModal;

    function closeModal(name) {
      const modal = document.getElementById(`modal-${name}`);
      if (modal) modal.classList.remove('open');
    }
    window.closeModal = closeModal;
    const setLoading = (id, on) => {
      const btn = $(id);
      if (!btn) return;
      btn.disabled = on;
      btn.innerHTML = on
        ? '<div class="spinner" style="width:16px;height:16px;border-width:2px"></div> Enregistrement…'
        : '<i class="fas fa-save"></i> Enregistrer';
    };

    /* ── Performance : Lazy-load Stats Iframes ──────────────── */
    window.loadStatsIframes = function(container) {
      const iframe = container.querySelector('.stats-iframe');
      const placeholder = container.querySelector('.stats-placeholder');
      if (iframe && iframe.dataset.src) {
        iframe.src = iframe.dataset.src;
        iframe.removeAttribute('data-src');
        iframe.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
      }
    };

    /* ── SÉCURITÉ : IP et Appareil ───────────────────────────── */
    async function _getSecurityInfo() {
      let ip = 'IP inconnue';
      try {
        const r = await fetch('https://api.ipify.org?format=json');
        const data = await r.json();
        if (data && data.ip) ip = data.ip;
      } catch (e) { console.warn('IP fetch error:', e); }

      const ua = navigator.userAgent;
      let device = 'PC / Bureau';
      if (/android/i.test(ua)) device = '📱 Android';
      else if (/iPhone|iPad|iPod/i.test(ua)) device = '🍎 iPhone/iPad';
      else if (/windows/i.test(ua)) device = '💻 Windows PC';
      else if (/macintosh/i.test(ua)) device = '🖥️ Mac';
      else if (/linux/i.test(ua)) device = '🐧 Linux';
      
      return { ip, device };
    }

    /* ── AUTH ────────────────────────────────────────────────── */
    $('login-btn').addEventListener('click', async () => {
      const email = $('login-email').value.trim();
      const pass = $('login-pass').value;
      const err = $('login-error');
      const btn = $('login-btn');
      if (!email || !pass) { err.textContent = 'Remplissez tous les champs.'; err.classList.add('show'); return; }
      btn.disabled = true;
      $('login-btn-text').textContent = 'Connexion…';
      err.classList.remove('show');
      try {
        const sec = await _getSecurityInfo();
        const detail = `Email: ${email} | IP: ${sec.ip} | Appareil: ${sec.device}`;
        
        try {
          // Connexion Supabase 1 (principale) — obligatoire
          await sb.signIn(email, pass);
          // Connexion Supabase 2 (vidéos) — en parallèle, non bloquante
          sb2.signIn(email, pass).catch(e => console.warn('[sb2] Auth ignorée :', e.message));
          await histLog('connexion', 'Connexion réussie', detail);
          showAdmin();
        } catch (e) {
          // Log de la tentative échouée pour la sécurité
          await histLog('connexion', '⚠️ TENTATIVE DE CONNEXION ÉCHOUÉE', detail);
          throw e; // Relancer pour le traitement UI habituel
        }
      } catch (e) {
        err.textContent = e.message || 'Email ou mot de passe incorrect.';
        err.classList.add('show');
        btn.disabled = false;
        $('login-btn-text').textContent = 'Se connecter';
      }
    });
    $('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') $('login-btn').click(); });

    // Toggle afficher/masquer mot de passe
    $('toggle-pass').addEventListener('click', () => {
      const input = $('login-pass');
      const btn = $('toggle-pass');
      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '&#128683;'; // œil barré
        btn.setAttribute('aria-label', 'Masquer le mot de passe');
      } else {
        input.type = 'password';
        btn.innerHTML = '&#128065;'; // œil ouvert
        btn.setAttribute('aria-label', 'Afficher le mot de passe');
      }
    });

    $('logout-btn').addEventListener('click', async () => {
      // Déconnexion des deux instances Supabase en parallèle
      await Promise.allSettled([
        sb.signOut(),
        sb2.signOut(),
      ]);
      const adminEl = $('admin-page');
      adminEl.classList.add('hiding');
      setTimeout(() => {
        adminEl.style.display = 'none';
        adminEl.classList.remove('hiding');
        adminEl.style.minHeight = '';
        window.scrollTo(0, 0);
        $('login-page').style.display = 'flex';
        $('login-page').classList.add('showing');
        setTimeout(() => $('login-page').classList.remove('showing'), 350);
        // hamburger shown via CSS media query
        $('login-pass').value = '';
        $('login-btn').disabled = false;
        $('login-btn-text').textContent = 'Se connecter';
        $('login-error').classList.remove('show');
      }, 180);
    });

    function showAdmin() {
      // Transition : fade out login
      const loginEl = $('login-page');
      const adminEl = $('admin-page');

      loginEl.classList.add('hiding');

      setTimeout(() => {
        loginEl.style.display = 'none';
        loginEl.classList.remove('hiding');

        // Reset scroll avant d'afficher
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;

        adminEl.style.display = 'block';
        adminEl.classList.add('showing');
        setTimeout(() => adminEl.classList.remove('showing'), 350);

        // hamburger shown via CSS media query
        if (window.innerWidth <= 768) $('hamburger-btn').style.display = 'flex';

        const s = sb.getSession();
        $('admin-email-display').textContent = s?.email || '';

        // Forcer le recalcul du layout sur iOS
        adminEl.style.minHeight = '';
        adminEl.style.minHeight = window.innerHeight + 'px';
        window.addEventListener('resize', () => {
          adminEl.style.minHeight = window.innerHeight + 'px';
          // Cacher/montrer le hamburger selon la taille d'écran
          const btn = $('hamburger-btn');
          if (btn) btn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
          // Fermer le drawer si on passe en desktop
          if (window.innerWidth > 768) closeDrawer();
        });

        loadDashboard();
        loadBlog();
        setTimeout(() => { if (typeof loadVisitesDashboard === 'function') loadVisitesDashboard(); }, 500);
      }, 180);
    }

    // Auto-login si session valide (attend le rafraîchissement si nécessaire)
    window.addEventListener('DOMContentLoaded', async () => {
      initTheme();

      /* ── Listeners vidéo (DOM requis) ── */
      const vFileEl = document.getElementById('video-file');
      if (vFileEl) vFileEl.addEventListener('change', function () {
        const prev = document.getElementById('video-preview');
        if (prev && this.files[0]) {
          const url = URL.createObjectURL(this.files[0]);
          prev.innerHTML = `<div class="upload-preview-item"><video src="${url}" style="width:100%;height:80px;object-fit:cover;border-radius:8px"></video></div>`;
        }
      });
      const vThumbEl = document.getElementById('video-thumb-file');
      if (vThumbEl) vThumbEl.addEventListener('change', function () {
        const prev = document.getElementById('video-thumb-preview');
        if (prev && this.files[0]) {
          const url = URL.createObjectURL(this.files[0]);
          prev.innerHTML = `<div class="upload-preview-item"><img src="${url}"></div>`;
        }
      });

      try {
        const s = await sb.getValidSession();
        if (s) showAdmin();
      } catch (e) {
        console.warn('[Admin] Session invalide ou expirée');
      }
    });

    /* ── THÈME (Dark Mode) ─────────────────────────────────── */
    function initTheme() {
      const btn = $('theme-toggle');
      if (!btn) return;
      const html = document.documentElement;

      // Demander la permission pour les notifications au premier clic ou au chargement
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }

      const updateIcon = (theme) => {
        const icon = btn.querySelector('i');
        if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        // Force refresh charts if active
        if (typeof renderDashboardCharts === 'function' && $('panel-dashboard').classList.contains('active')) {
          renderDashboardCharts(_rdvCountsCache, _allRdvs);
        }
      };

      // Sync init
      updateIcon(html.dataset.theme || 'light');

      btn.addEventListener('click', () => {
        const newTheme = html.dataset.theme === 'dark' ? 'light' : 'dark';
        html.dataset.theme = newTheme;
        localStorage.setItem('Miralocks_theme', newTheme);
        updateIcon(newTheme);
      });
    }

    let _rdvCountsCache = {}; // Pour rafraîchir les charts au changement de thème

    /* ── NAVIGATION ──────────────────────────────────────────── */
    document.querySelectorAll('.nav-item[data-panel]').forEach(el => {
      el.addEventListener('click', () => {
        const panel = el.dataset.panel;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
        document.getElementById(`panel-${panel}`).classList.add('active');
        // Sync drawer
        document.querySelectorAll('.drawer-item[data-panel]').forEach(m => {
          m.classList.toggle('active', m.dataset.panel === panel);
        });
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.querySelector('.admin-main')?.scrollTo({ top: 0, behavior: 'smooth' });
        const load = {
          blog: loadBlog, galerie: loadGalerie, videos: loadVideos,
          avis: () => loadAvis(false), 
          dashboard: () => { loadDashboard(); setTimeout(() => { if (typeof loadVisitesDashboard === 'function') loadVisitesDashboard(); }, 500); },
          parametres: loadParametres, rendezvous: () => loadRdv('en_attente'),
          'rdv-planning': loadPlanning, 'services-admin': loadServicesAdmin,
          historique: loadHistorique, 
          'google-analytics': () => { if (typeof loadVisitesPanel === 'function') loadVisitesPanel(); },
          'bons-cadeaux': () => { if (window.BonsCadeaux) BonsCadeaux.renderPanel('bons-panel'); },
          'packs-seances': () => { if (window.PacksSeances) PacksSeances.renderPanel('packs-panel'); },
          'parrainage': () => { if (window.Parrainage) Parrainage.renderPanel('parrainage-panel'); },
          'assistant-ia': () => { if (typeof iaInit === 'function') iaInit(); },
          'chatbot-public-config': () => { if (typeof loadChatPublicSettings === 'function') loadChatPublicSettings(); }
        };
        load[panel]?.();
      });
    });

    /* ── DRAWER HAMBURGER ────────────────────────────────────── */
    function openDrawer() {
      const btn = document.getElementById('hamburger-btn');
      const drawer = document.getElementById('mobile-drawer');
      const overlay = document.getElementById('drawer-overlay');
      btn?.classList.add('open');
      btn?.setAttribute('aria-expanded', 'true');
      drawer?.classList.add('open');
      overlay?.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeDrawer() {
      const btn = document.getElementById('hamburger-btn');
      const drawer = document.getElementById('mobile-drawer');
      const overlay = document.getElementById('drawer-overlay');
      btn?.classList.remove('open');
      btn?.setAttribute('aria-expanded', 'false');
      drawer?.classList.remove('open');
      overlay?.classList.remove('open');
      document.body.style.overflow = '';
    }

    document.getElementById('hamburger-btn')?.addEventListener('click', () => {
      const isOpen = document.getElementById('mobile-drawer')?.classList.contains('open');
      isOpen ? closeDrawer() : openDrawer();
    });

    document.getElementById('drawer-overlay')?.addEventListener('click', closeDrawer);

    // Fermer avec Escape
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

    // Drawer items → trigger sidebar click + fermer
    document.querySelectorAll('.drawer-item[data-panel]').forEach(el => {
      el.addEventListener('click', () => {
        const panel = el.dataset.panel;
        closeDrawer();
        // Trigger la navigation principale
        const sidebarItem = document.querySelector(`.nav-item[data-panel="${panel}"]`);
        if (sidebarItem) {
          sidebarItem.click();
        } else {
          document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
          const panelEl = document.getElementById(`panel-${panel}`);
          if (panelEl) panelEl.classList.add('active');
          const load = {
            blog: loadBlog, galerie: loadGalerie, videos: loadVideos,
            avis: () => loadAvis(false), 
            dashboard: () => { loadDashboard(); setTimeout(() => { if (typeof loadVisitesDashboard === 'function') loadVisitesDashboard(); }, 500); },
            parametres: loadParametres, rendezvous: () => loadRdv('en_attente'),
            'rdv-planning': loadPlanning, 'services-admin': loadServicesAdmin,
            historique: loadHistorique, 
            'google-analytics': () => { if (typeof loadVisitesPanel === 'function') loadVisitesPanel(); },
            'bons-cadeaux': () => { if (window.BonsCadeaux) BonsCadeaux.renderPanel('bons-panel'); },
            'packs-seances': () => { if (window.PacksSeances) PacksSeances.renderPanel('packs-panel'); },
            'parrainage': () => { if (window.Parrainage) Parrainage.renderPanel('parrainage-panel'); },
            'assistant-ia': () => { if (typeof iaInit === 'function') iaInit(); },
            'chatbot-public-config': () => { if (typeof loadChatPublicSettings === 'function') loadChatPublicSettings(); }
          };
          load[panel]?.();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    /* Fermer modal sur overlay click */
    document.querySelectorAll('.modal-overlay').forEach(o => {
      o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
    });



    /* ── VIDÉOS ──────────────────────────────────────────────── */
    async function loadVideos() {
      const el = $('videos-list');
      el.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement…</div>';
      try {
        const vids = await sb2.videos.list(false);
        $('videos-count').textContent = `(${vids.length})`;
        if (!vids.length) {
          el.innerHTML = '<div class="empty-state"><i class="fas fa-video"></i><p>Aucune vidéo. Ajoutez-en !</p></div>';
          return;
        }
        el.innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Miniature</th><th>Titre</th><th>Source</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody>${vids.map(v => {
          const isLink = v.video_url && !v.video_url.includes('/storage/v1/object/');
          return `
        <tr>
          <td>${v.thumbnail_url
              ? `<img src="${v.thumbnail_url}" class="table-thumb" width="56" height="56" loading="lazy">`
              : `<div style="width:56px;height:56px;background:#111;border-radius:8px;display:flex;align-items:center;justify-content:center"><i class="fas fa-video" style="color:#555"></i></div>`}</td>
          <td><strong>${v.titre}</strong><br><small style="color:var(--gris-d)">${(v.description || '').slice(0, 60)}</small></td>
          <td>
            ${isLink ? `<span class="badge" style="background:#e0f2fe;color:#0369a1">Lien</span>` : `<span class="badge" style="background:#f1f5f9;color:#475569">Fichier</span>`}
          </td>
          <td><span class="badge ${v.publie ? 'badge-success' : 'badge-danger'}">${v.publie ? 'Publié' : 'Masqué'}</span></td>
          <td>${new Date(v.created_at).toLocaleDateString('fr')}</td>
          <td><div class="table-actions">
            <button class="btn btn-sm btn-icon" title="Modifier" onclick="editVideo(${v.id})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm ${v.publie ? 'btn-warning' : 'btn-success'} btn-icon" title="${v.publie ? 'Masquer' : 'Publier'}" onclick="toggleVideo(${v.id},${v.publie})"><i class="fas fa-${v.publie ? 'eye-slash' : 'eye'}"></i></button>
            <button class="btn btn-sm btn-danger btn-icon" title="Supprimer" onclick="deleteVideo(${v.id},'${v.video_url || ''}','${v.thumbnail_url || ''}')"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`;
        }).join('')}
      </tbody></table></div>`;
      } catch (e) { el.innerHTML = `<div style="color:var(--danger);padding:1rem">Erreur : ${_escAdmin(e.message)}</div>`; }
    }



    function updateVideoSourceUI() {
      const type = document.querySelector('input[name="video-source"]:checked').value;
      $('video-source-file-zone').style.display = type === 'file' ? 'block' : 'none';
      $('video-source-link-zone').style.display = type === 'link' ? 'block' : 'none';
    }

    function autoFetchYoutubeThumb() {
      const url = $('video-external-url').value.trim();
      if (!url.includes('youtube.com') && !url.includes('youtu.be')) return;
      let vid = '';
      if (url.includes('v=')) vid = url.split('v=')[1].split('&')[0];
      else if (url.includes('youtu.be/')) vid = url.split('youtu.be/')[1].split('?')[0];
      if (vid && !$('video-thumb-url').value) {
        const thumb = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
        $('video-thumb-preview').innerHTML = `<div class="upload-preview-item"><img src="${thumb}"></div>`;
        $('video-thumb-url').value = thumb;
      }
    }

    function openModal_Video_new() {
      $('video-edit-id').value = '';
      $('video-titre').value = '';
      $('video-desc').value = '';
      $('video-file').value = '';
      $('video-external-url').value = '';
      $('video-url').value = '';
      $('video-thumb-url').value = '';
      $('video-thumb-file').value = '';
      $('video-preview').innerHTML = '';
      $('video-thumb-preview').innerHTML = '';
      $('video-publie').checked = true;
      document.querySelector('input[name="video-source"][value="file"]').checked = true;
      updateVideoSourceUI();
      document.getElementById('modal-video-title').textContent = "Ajouter une vidéo";
      // Ouvrir le modal
      const modal = document.getElementById('modal-videos');
      if (modal) modal.classList.add('open');
    }
    window.openModal_Video_new = openModal_Video_new;

    async function editVideo(id) {
      try {
        const v = await sb2.videos.get(id);
        if (!v) return;

        $('video-edit-id').value = v.id;
        $('video-titre').value = v.titre || '';
        $('video-desc').value = v.description || '';
        $('video-url').value = v.video_url || '';
        $('video-thumb-url').value = v.thumbnail_url || '';
        $('video-publie').checked = v.publie;

        // Prévisualisations
        if (v.video_url) {
          $('video-preview').innerHTML = `<div class="upload-preview-item"><video src="${v.video_url}" style="width:100%;height:80px;object-fit:cover;border-radius:8px"></video></div>`;
          // Si c'est un lien externe
          if (!v.video_url.includes('/storage/v1/object/')) {
            document.querySelector('input[name="video-source"][value="link"]').checked = true;
            $('video-external-url').value = v.video_url;
          } else {
            document.querySelector('input[name="video-source"][value="file"]').checked = true;
          }
        }
        if (v.thumbnail_url) {
          $('video-thumb-preview').innerHTML = `<div class="upload-preview-item"><img src="${v.thumbnail_url}"></div>`;
        }
        
        updateVideoSourceUI();
        document.getElementById('modal-video-title').textContent = "Modifier la vidéo";
        const modal = document.getElementById('modal-videos');
        if (modal) modal.classList.add('open');
      } catch (e) { toast(e.message, 'error'); }
    }
    window.editVideo = editVideo;

    async function saveVideo() {
      const titre = $('video-titre').value.trim();
      if (!titre) { toast('Le titre est obligatoire', 'error'); return; }

      const type = document.querySelector('input[name="video-source"]:checked').value;
      const vFile = $('video-file').files[0];
      const externalUrl = $('video-external-url').value.trim();

      if (type === 'file' && !vFile && !$('video-url').value) {
        toast('Sélectionnez un fichier vidéo', 'error'); return;
      }
      if (type === 'link' && !externalUrl) {
        toast('Veuillez entrer un lien vidéo', 'error'); return;
      }

      // Vérifier la config Supabase 2 AVANT de commencer
      if (type === 'file' && vFile) {
        if (window.SUPABASE2_URL.includes('VOTRE_2EME_URL')) {
            toast("La seconde instance Supabase n'est pas encore configurée dans js/supabase2.js", 'error');
            return;
        }
      }

      try {
        const prog = $('video-progress');
        prog.style.display = 'block';
        showProgress('video', 20);

        let videoUrl = type === 'link' ? externalUrl : $('video-url').value;
        if (type === 'file' && vFile) {
          videoUrl = await sb2.upload('videos', vFile);
          showProgress('video', 60);
        }

        let thumbUrl = $('video-thumb-url').value;
        const tFile = $('video-thumb-file').files[0];
        if (tFile) {
          thumbUrl = await sb.upload('video-thumbs', tFile);
          showProgress('video', 90);
        }

        const data = {
          titre,
          description: $('video-desc').value.trim(),
          video_url: videoUrl,
          thumbnail_url: thumbUrl || null,
          publie: $('video-publie').checked,
        };

        const id = $('video-edit-id').value;
        if (id) await sb2.videos.update(id, data);
        else await sb2.videos.create(data);

        showProgress('video', 100);
        toast('Vidéo enregistrée !');
        closeModal('videos');
        loadVideos();
        loadDashboard();
      } catch (e) { toast(e.message, 'error'); }
      finally { hideProgress('video'); }
    }

    async function toggleVideo(id, current) {
      await sb2.videos.togglePublish(id, current);
      toast(current ? 'Vidéo masquée' : 'Vidéo publiée !');
      loadVideos();
    }
    async function deleteVideo(id, vUrl, tUrl) {
      if (!confirm('Supprimer cette vidéo ?')) return;
      
      // Suppression du fichier vidéo sur l'instance Supabase 2 (sb2)
      if (vUrl && window.SUPABASE2_URL && vUrl.includes(window.SUPABASE2_URL)) {
        try { await sb2.deleteFile(vUrl); } catch (e) { console.warn('Erreur suppression sb2:', e); }
      }
      // Suppression de la miniature sur l'instance principale (sb)
      if (tUrl) {
        try { await sb.deleteFile(tUrl); } catch (e) { console.warn('Erreur suppression thumb:', e); }
      }

      // sb2.videos.delete ne gère plus le storage — uniquement la suppression en base
      await sb2.videos.delete(id);
      toast('Vidéo supprimée', 'warning');
      loadVideos();
      loadDashboard();
    }

