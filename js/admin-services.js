/* ============================================================
   Miralocks Admin — admin-services.js
   Module : Gestion des prestations + PWA install
   ============================================================ */
/* Helper : échappement HTML pour éviter les injections XSS */
const _escSvc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');


    /* ── GESTION DES PRESTATIONS ───────────────────────────── */
    async function loadServicesAdmin() {
      const el = document.getElementById('services-admin-list');
      el.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement…</div>';
      try {
        const svcs = await sb.services.list(false);
        if (!svcs.length) {
          el.innerHTML = '<div class="empty-state"><i class="fas fa-cut"></i><p>Aucune prestation configurée.</p></div>';
          return;
        }
        el.innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Ordre</th><th>Nom</th><th>Catégorie</th><th>Prix</th><th>Statut</th><th>Actions</th></tr></thead>
      <tbody>${svcs.map(s => `
        <tr>
          <td>${s.ordre}</td>
          <td><strong>${s.nom}</strong></td>
          <td><span class="badge badge-warning">${s.categorie || '—'}</span></td>
          <td>${s.prix ? `<strong>${s.prix}</strong> FCFA` : '—'}</td>
          <td><span class="badge ${s.actif ? 'badge-success' : 'badge-danger'}">${s.actif ? 'Actif' : 'Inactif'}</span></td>
          <td><div class="table-actions">
            <button class="btn btn-sm btn-outline btn-icon" title="Notes internes" onclick="window.ServiceNotes?.renderModal('${(s.nom || '').replace(/'/g, "\\'")}')"><i class="fas fa-clipboard-list"></i></button>
            <button class="btn btn-sm btn-outline btn-icon" onclick="editService(${s.id})"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-danger btn-icon" onclick="deleteService(${s.id})"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`).join('')}
      </tbody></table></div>`;
      } catch (e) { el.innerHTML = `<div style="color:var(--danger);padding:1rem">Erreur : ${_escSvc(e.message)}</div>`; }
    }

    function openModal_Service_new() {
      const title = document.getElementById('modal-services-title');
      if (title) title.textContent = 'Nouvelle prestation';
      const editId = document.getElementById('service-edit-id');
      if (editId) editId.value = '';
      ['service-nom', 'service-cat', 'service-prix'].forEach(id => {
        const field = document.getElementById(id);
        if (field) field.value = '';
      });
      const ordre = document.getElementById('service-ordre');
      if (ordre) ordre.value = 0;
      const actif = document.getElementById('service-actif');
      if (actif) actif.checked = true;
      openModal('services');
    }

    async function editService(id) {
      try {
        const svcs = await sb.services.list(false);
        const s = svcs.find(x => x.id == id);
        if (!s) return;
        document.getElementById('modal-services-title').textContent = 'Modifier la prestation';
        document.getElementById('service-edit-id').value = s.id;
        document.getElementById('service-nom').value = s.nom || '';
        document.getElementById('service-cat').value = s.categorie || '';
        document.getElementById('service-prix').value = s.prix || '';
        document.getElementById('service-ordre').value = s.ordre || 0;
        document.getElementById('service-actif').checked = !!s.actif;
        openModal('services');
      } catch (e) { toast(e.message, 'error'); }
    }

    async function saveService() {
      const nom = document.getElementById('service-nom').value.trim();
      if (!nom) { toast('Le nom est obligatoire', 'error'); return; }
      const idValue = document.getElementById('service-edit-id').value;
      const data = {
        nom,
        categorie: document.getElementById('service-cat').value.trim(),
        prix: document.getElementById('service-prix').value.trim(),
        ordre: parseInt(document.getElementById('service-ordre').value) || 0,
        actif: document.getElementById('service-actif').checked
      };
      setLoading('service-save-btn', true);
      try {
        if (idValue) await sb.services.update(idValue, data);
        else await sb.services.create(data);
        toast('Prestation enregistrée');
        await histLog('service', idValue ? 'Prestation mise à jour' : 'Prestation créée', nom);
        closeModal('services');
        loadServicesAdmin();
      } catch (e) { toast(e.message, 'error'); }
      finally { setLoading('service-save-btn', false); }
    }

    async function deleteService(id) {
      if (!confirm('Supprimer cette prestation ?')) return;
      try {
        await sb.services.delete(id);
        toast('Prestation supprimée', 'warning');
        await histLog('service', 'Prestation supprimée', `#${id}`);
        loadServicesAdmin();
      } catch (e) { toast(e.message, 'error'); }
    }

    async function exportRdvCSV() {
      try {
        const rdvs = await sb.rdv.list();
        if (!rdvs.length) { toast('Aucun rendez-vous à exporter', 'info'); return; }

        // Header (format CSV avec ";" pour l'ouverture Excel FR directe)
        const headers = ['ID', 'Nom', 'Tel', 'Email', 'Service', 'Date', 'Heure', 'Statut', 'Message', 'Note Admin', 'Date Creation'];
        const rows = rdvs.map(r => [
          r.id,
          `"${(r.nom || '').replace(/"/g, '""')}"`,
          `"${r.tel || ''}"`,
          r.email || '',
          `"${(r.service || '').replace(/"/g, '""')}"`,
          r.date_rdv,
          r.heure || '',
          r.statut,
          `"${(r.message || '').replace(/"/g, '""')}"`,
          `"${(r.note_admin || '').replace(/"/g, '""')}"`,
          r.created_at
        ]);

        const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `miralocks_rdv_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) { toast('Erreur export : ' + e.message, 'error'); }
    }

    /* ══════════════════════════════════════════════════════════
       HISTORIQUE DU SITE — stocké dans Supabase (table: historique)
       ══════════════════════════════════════════════════════════ */

    const HIST_TYPES = {
      rdv: { icon: 'calendar-check', color: '#10b981', label: 'Rendez-vous' },
      blog: { icon: 'newspaper', color: '#3b82f6', label: 'Blog' },
      galerie: { icon: 'images', color: '#8b5cf6', label: 'Galerie' },
      avis: { icon: 'star', color: '#f59e0b', label: 'Avis' },
      service: { icon: 'cut', color: '#ec4899', label: 'Prestation' },
      connexion: { icon: 'sign-in-alt', color: '#6b7280', label: 'Connexion' },
      autre: { icon: 'info-circle', color: '#0C3320', label: 'Autre' },
    };

    /* histLog() est définie globalement dans supabase.js — ne pas redéfinir ici */

    async function loadHistorique() {
      const el = $('historique-list');
      if (!el) return;
      el.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement…</div>';

      const filtre = $('historique-filtre')?.value || '';
      const params = filtre
        ? `type=eq.${filtre}&order=created_at.desc&limit=500`
        : `order=created_at.desc&limit=500`;

      try {
        const hist = await sb._get('historique', params);
        if ($('historique-count')) $('historique-count').textContent = `(${hist.length})`;

        if (!hist.length) {
          el.innerHTML = `<div class="empty-state"><i class="fas fa-history"></i><p>Aucune action enregistrée${filtre ? ' pour ce filtre' : ''}.</p></div>`;
          return;
        }

        el.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Date / Heure</th>
            <th>Catégorie</th>
            <th>Action</th>
            <th>Détail</th>
          </tr></thead>
          <tbody>
            ${hist.map(h => {
          const t = HIST_TYPES[h.type] || HIST_TYPES.autre;
          const d = new Date(h.created_at);
          const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
          const heureStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          return `
                <tr>
                  <td style="white-space:nowrap"><strong>${dateStr}</strong><br><span style="color:var(--gris-d);font-size:.8rem">${heureStr}</span></td>
                  <td>
                    <span style="display:inline-flex;align-items:center;gap:.35rem;padding:.2rem .65rem;border-radius:20px;font-size:.75rem;font-weight:600;background:${t.color}18;color:${t.color}">
                      <i class="fas fa-${t.icon}"></i> ${t.label}
                    </span>
                  </td>
                  <td><span style="${h.message?.includes('ÉCHOUÉE') ? 'color:var(--danger);font-weight:700' : ''}">${escHtml(h.message)}</span></td>
                  <td style="color:var(--gris-d);font-size:.82rem">${escHtml(h.detail || '—')}</td>
                </tr>`;
        }).join('')}
          </tbody>
        </table>
      </div>`;
      } catch (e) {
        let msg = e.message;
        if (msg.includes('permission denied')) {
          msg = 'Accès Refusé : Vous n\'avez pas les permissions nécessaires sur la table "historique". Vérifiez les droits USAGE sur le schéma public.';
        }
        el.innerHTML = `<div style="color:var(--danger);padding:1.25rem;background:#fee2e2;border-radius:12px;border:1px solid #fca5a5;display:flex;align-items:center;gap:.75rem">
          <i class="fas fa-exclamation-triangle"></i>
          <div><strong>Erreur :</strong> ${msg}</div>
        </div>`;
      }
    }

    async function exportHistorique() {
      try {
        const hist = await sb._get('historique', 'order=created_at.desc&limit=500');
        if (!hist.length) { toast('Aucun historique à exporter', 'info'); return; }
        const headers = ['Date', 'Heure', 'Catégorie', 'Action', 'Détail'];
        const rows = hist.map(h => {
          const d = new Date(h.created_at);
          return [
            d.toLocaleDateString('fr-FR'),
            d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            HIST_TYPES[h.type]?.label || h.type,
            `"${(h.message || '').replace(/"/g, '""')}"`,
            `"${(h.detail || '').replace(/"/g, '""')}"`,
          ].join(';');
        });
        const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `miralocks_historique_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast('Historique exporté', 'success');
      } catch (e) { toast('Erreur export : ' + e.message, 'error'); }
    }

    async function clearHistorique() {
      if (!confirm('Vider tout l\'historique ? Cette action est irréversible.')) return;
      try {
        const s = await sb.getValidSession();
        await fetch(`${SUPABASE_URL}/rest/v1/historique?id=gt.0`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_ANON,
            'Authorization': `Bearer ${s.token}`,
          }
        });
        loadHistorique();
        toast('Historique vidé', 'warning');
      } catch (e) { toast('Erreur : ' + e.message, 'error'); }
  }

    /* ── PWA Installation Logic ── */
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
        installBtn.addEventListener('click', () => {
          alert("Sur iPhone/iPad :\n\n1. Touchez l'icône de partage ⍗ en bas de l'écran.\n2. Choisissez 'Sur l'écran d'accueil' ➕.");
        });
      }

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.style.display = 'inline-flex';
        installBtn.style.alignItems = 'center';
      });

      installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[PWA Admin] Résultat: ${outcome}`);
        deferredPrompt = null;
        installBtn.style.display = 'none';
      });

      window.addEventListener('appinstalled', () => {
        console.log('[PWA Admin] App installée !');
        installBtn.style.display = 'none';
      });

    })();
