/* ============================================================
   Miralocks Admin — admin-rdv.js
   Module : Rendez-vous, Dashboard, Statistiques, Notifications
   ============================================================ */
/* Helper : échappement HTML pour éviter les injections XSS */
const _escRdv = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');


    /* ── DASHBOARD ───────────────────────────────────────────── */
    async function loadDashboard() {
      const g = $('dash-grid');
      g.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement…</div>';
      try {
        const [blogs, photos, vids, avis, pending, rdvCounts, allRdvs, visiteStats] = await Promise.all([
          sb.blog.list(false),
          sb.galerie.list(false),
          sb2.videos.list(false),
          sb.avis.list(true),
          sb.avis.list(false),
          sb.rdv.counts(),
          sb.rdv.list(null),
          sb.visites.stats().catch(() => ({ mois: 0, total: 0 }))
        ]);

        window._visiteStatsCache = visiteStats;

        const relanceCount = allRdvs.filter(r => isToRelance(r)).length;
        const acompteCount = allRdvs.filter(r => r.pay_acompte).length;

        const pendingCount = pending.filter(a => !a.approuve).length;
        if (pendingCount > 0) {
          const badge = $('avis-badge');
          badge.textContent = pendingCount;
          badge.style.display = 'inline-block';
          // drawer badge
          const db = $('drawer-avis-badge');
          if (db) { db.textContent = pendingCount; db.style.display = 'inline-block'; }
          // hamburger red dot
          const hb = $('hamburger-badge');
          if (hb) hb.style.display = 'block';
        }
        /* Badge RDV en attente */
        if (rdvCounts.en_attente > 0) {
          const b = $('rdv-badge');
          b.textContent = rdvCounts.en_attente;
          b.style.display = 'inline-block';
          // drawer badge
          const db = $('drawer-rdv-badge');
          if (db) { db.textContent = rdvCounts.en_attente; db.style.display = 'inline-block'; }
          // hamburger red dot
          const hb = $('hamburger-badge');
          if (hb) hb.style.display = 'block';
        }
        const conv = visiteStats.mois > 0 ? ((rdvCounts.total / visiteStats.mois) * 100).toFixed(1) : 0;

        g.innerHTML = `
      <div class="dash-card" onclick="navTo('blog')"><div class="dash-card-icon">📝</div><div class="dash-card-num">${blogs.length}</div><div class="dash-card-label">Articles blog</div></div>
      <div class="dash-card" onclick="navTo('galerie')"><div class="dash-card-icon">📸</div><div class="dash-card-num">${photos.length}</div><div class="dash-card-label">Photos galerie</div></div>
      <div class="dash-card" onclick="navTo('avis')"><div class="dash-card-icon">⭐</div><div class="dash-card-num">${avis.length}</div><div class="dash-card-label">Avis approuvés</div></div>
      <div class="dash-card" onclick="navTo('rendezvous')" style="border-top:3px solid var(--or)"><div class="dash-card-icon">📅</div><div class="dash-card-num">${rdvCounts.total}</div><div class="dash-card-label">Rendez-vous total</div></div>
      <div class="dash-card" onclick="navTo('rendezvous')" style="border-top:3px solid #f59e0b"><div class="dash-card-icon">⏳</div><div class="dash-card-num">${rdvCounts.en_attente}</div><div class="dash-card-label">RDV en attente</div></div>
      <div class="dash-card" onclick="navTo('rendezvous')" style="border-top:3px solid #fde047"><div class="dash-card-icon">⏰</div><div class="dash-card-num">${relanceCount}</div><div class="dash-card-label">À relancer</div></div>
      <div class="dash-card" onclick="navTo('rendezvous')" style="border-top:3px solid var(--success)"><div class="dash-card-icon">🛡️</div><div class="dash-card-num">${acompteCount}</div><div class="dash-card-label">Acomptes reçus</div></div>
      <div class="dash-card" onclick="navTo('google-analytics')" style="border-top:3px solid #3b82f6"><div class="dash-card-icon">🌐</div><div class="dash-card-num">${visiteStats.mois}</div><div class="dash-card-label">Visites (30 jours)</div></div>
      <div class="dash-card" style="border-top:3px solid #8b5cf6; cursor:default"><div class="dash-card-icon">📈</div><div class="dash-card-num">${conv}%</div><div class="dash-card-label">Taux de Conversion</div></div>
    `;

        renderDashboardCharts(rdvCounts, allRdvs);
        initRdvWatcher(rdvCounts.en_attente);

        /* ── Widget "Aujourd'hui" ── */
        const todayWidget = $('dash-today');
        if (todayWidget) {
          const todayStr = new Date().toISOString().slice(0, 10);
          const todayRdvs = allRdvs.filter(r => r.date_rdv === todayStr && r.statut !== 'annule');
          if (todayRdvs.length > 0) {
            const rows = todayRdvs.map(r => {
              const statutBadge = RDV_STATUTS[r.statut] || { label: r.statut, color: '#888' };
              const phone = r.tel || '';
              const safePhone = escAttr(phone);
              const waLink = phone ? escAttr(`https://wa.me/${phone.replace(/[^0-9+]/g, '')}`) : '#';
              return `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;background:var(--bg-card, #fff);border-radius:10px;margin-bottom:.5rem;border-left:4px solid ${statutBadge.color};flex-wrap:wrap;gap:.5rem">
                  <div style="flex:1;min-width:180px">
                    <strong style="color:var(--text, #0C3320)">${escHtml(r.nom)}</strong>
                    <div style="font-size:.82rem;color:var(--gris-d, #888);margin-top:2px">
                      🕐 ${r.heure || '—'} · ${escHtml(r.service || '')}
                    </div>
                  </div>
                  <div style="display:flex;gap:.4rem;flex-shrink:0">
                    <span class="badge" style="background:${statutBadge.color};color:#fff;font-size:.7rem;padding:3px 8px;border-radius:20px">${statutBadge.label}</span>
                    ${phone ? `<a href="tel:${safePhone}" class="btn btn-sm btn-outline" style="padding:4px 8px;font-size:.75rem" title="Appeler"><i class="fas fa-phone"></i></a>` : ''}
                    ${phone ? `<a href="${waLink}" target="_blank" class="btn btn-sm" style="padding:4px 8px;font-size:.75rem;background:#25D366;color:#fff;border:none" title="WhatsApp"><i class="fab fa-whatsapp"></i></a>` : ''}
                  </div>
                </div>`;
            }).join('');

            todayWidget.innerHTML = `
              <div style="background:linear-gradient(135deg, rgba(12,51,32,0.04), rgba(201,168,76,0.08));border:1px solid rgba(201,168,76,0.2);border-radius:var(--rayon-lg, 16px);padding:1.25rem 1.5rem">
                <h3 style="margin:0 0 1rem;font-size:1rem;color:var(--vert, #0C3320);display:flex;align-items:center;gap:.5rem">
                  <i class="fas fa-calendar-day" style="color:var(--or, #C9A84C)"></i> Rendez-vous aujourd'hui
                  <span style="background:var(--or, #C9A84C);color:var(--vert, #0C3320);font-size:.75rem;padding:2px 10px;border-radius:20px;font-weight:700">${todayRdvs.length}</span>
                </h3>
                ${rows}
              </div>`;
          } else {
            todayWidget.innerHTML = `
              <div style="background:rgba(12,51,32,0.03);border:1px dashed rgba(12,51,32,0.15);border-radius:var(--rayon-lg, 16px);padding:1.25rem 1.5rem;text-align:center;color:var(--gris-d, #888)">
                <i class="fas fa-calendar-check" style="font-size:1.5rem;margin-bottom:.5rem;display:block;opacity:.4"></i>
                Aucun rendez-vous prévu pour aujourd'hui
              </div>`;
          }
        }

        /* ── Visites (Désactivé au profit de Google Analytics) ── */
        const alerts = [];
        if (pendingCount > 0) alerts.push(`<strong>${pendingCount} avis</strong> en attente d'approbation <button class="btn btn-warning btn-sm" onclick="navTo('avis')" style="margin-left:.75rem">Modérer</button>`);
        if (rdvCounts.en_attente > 0) alerts.push(`<strong>${rdvCounts.en_attente} rendez-vous</strong> en attente de confirmation <button class="btn btn-sm" onclick="navTo('rendezvous')" style="margin-left:.75rem;background:var(--or);color:var(--vert)">Voir</button>`);
        if (alerts.length) {
          $('dash-pending').innerHTML = alerts.map(a => `
        <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:var(--r);padding:1rem 1.25rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:.6rem">
          <span style="color:#92400E"><i class="fas fa-bell"></i> ${a}</span>
        </div>`).join('');
        } else { $('dash-pending').innerHTML = ''; }
      } catch (e) {
        g.innerHTML = `<div style="color:var(--danger);padding:1rem">Erreur : ${_escRdv(e.message)}</div>`;
      }
    }
    function navTo(panel) {
      document.querySelector(`.nav-item[data-panel="${panel}"]`)?.click();
    }

    /* ══════════════════════════════════════════
       RENDEZ-VOUS
    ══════════════════════════════════════════ */
    let _rdvStatutActif = 'en_attente';

    async function loadRdv(statut) {
      _rdvStatutActif = statut;
      const el = $('rdv-list');
      el.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement…</div>';

      /* Activer le bon bouton filtre */
      ['attente', 'confirme', 'termine', 'annule', 'all'].forEach(s => {
        const btn = $(`btn-rdv-${s}`);
        if (btn) btn.style.cssText = '';
      });
      const activeBtnId = statut ? `btn-rdv-${statut === 'en_attente' ? 'attente' : statut}` : 'btn-rdv-all';
      const activeBtn = $(activeBtnId);
      if (activeBtn) activeBtn.style.cssText = 'background:var(--vert);color:var(--or);border-color:var(--vert)';

      try {
        /* ── Auto-terminer les RDV confirmés dont la date est passée ── */
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const allConfirmes = await sb.rdv.list('confirme');
        for (const r of allConfirmes) {
          if (!r.date_rdv) continue;
          const rdvDate = parseLocalDate(r.date_rdv, 'T23:59:59');
          if (rdvDate && rdvDate < today) {
            await sb.rdv.setStatut(r.id, 'termine').catch(() => { });
          }
        }

        const rdvs = await sb.rdv.list(statut);
        $('rdv-count').textContent = `(${rdvs.length})`;

        if (!rdvs.length) {
          el.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-check"></i><p>Aucun rendez-vous${statut ? ' dans cette catégorie' : ''}.</p></div>`;
          return;
        }

        el.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Date / Heure</th>
            <th>Client</th>
            <th>Sérvice</th>
            <th>Paiement / Suivi</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr></thead>
          <tbody id="rdv-tbody">
            ${rdvs.map(r => {
          const st = RDV_STATUTS[r.statut] || RDV_STATUTS.en_attente;
          const parsedDate = parseLocalDate(r.date_rdv);
          const dateStr = parsedDate ? parsedDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—';
          const safeTel = escAttr(r.tel || '');
          return `
                <tr class="rdv-row ${isToRelance(r) ? 'relance-needed' : ''}" id="rdv-row-${r.id}" onclick="rdvToggle(${r.id})">
                  <td><strong>${dateStr}</strong> — ${r.heure || '??'}</td>
                  <td><strong>${escHtml(r.nom)}</strong></td>
                  <td><span class="rdv-one-line">${escHtml(r.service)}</span></td>
                  <td>
                    <div style="display:flex; gap:0.4rem; flex-wrap:wrap">
                      ${r.pay_acompte || r.acompte_montant ? `
                        <span class="badge" style="background:#dcfce7; color:#166534; border:1px solid #bbf7d0;" title="Acompte payé">
                          <i class="fas fa-shield-alt"></i> Acompte
                        </span>
                      ` : ''}
                      ${isToRelance(r) ? `
                        <span class="badge" style="background:#fef9c3; color:#854d0e; border:1px solid #fde047;" title="Client à relancer (1.5 mois)">
                          <i class="fas fa-clock-rotate-left"></i> Relance
                        </span>
                      ` : ''}
                    </div>
                  </td>
                  <td>
                    <span style="display:inline-flex;align-items:center;gap:.35rem;padding:.2rem .6rem;border-radius:20px;font-size:.75rem;font-weight:600;background:${st.bg};color:${st.color}">
                      <i class="fas fa-${st.icon}"></i> ${st.label}
                    </span>
                  </td>
                  <td>
                    <div class="table-actions" onclick="event.stopPropagation()">
                      <button class="btn btn-sm btn-outline btn-icon" onclick="rdvToggle(${r.id})" title="Voir détails"><i class="fas fa-eye"></i></button>
                    </div>
                  </td>
                </tr>
                <tr class="rdv-details" id="rdv-details-${r.id}">
                  <td colspan="5">
                    <div style="display:flex;gap:2rem;flex-wrap:wrap">
                      <div style="flex:1;min-width:300px">
                        <h4 style="color:var(--vert);margin-bottom:.75rem">Informations du Client</h4>
                        <p><strong>Nom :</strong> ${escHtml(r.nom)}</p>
                        <p><strong>Téléphone :</strong> <a href="tel:${safeTel}">${escHtml(r.tel)}</a></p>
                        ${r.email ? `<p><strong>Email :</strong> <a href="mailto:${escAttr(r.email)}">${escHtml(r.email)}</a></p>` : ''}
                        <p><strong>Date :</strong> ${escHtml(r.date_rdv)} à ${escHtml(r.heure || 'non précisée')}</p>
                        <p><strong>Service :</strong> ${escHtml(r.service)}</p>
                        <div style="margin-top:1.25rem;padding:1rem;background:#f0f7f3;border-radius:10px;border-left:4px solid var(--vert)">
                          <h5 style="margin-bottom:.5rem;color:var(--vert)">Message du client :</h5>
                          <p style="font-style:italic">"${escHtml(r.message || 'Aucun message particulier.')}"</p>
                        </div>
                        ${r.note_admin ? `<div style="margin-top:1rem;padding:1rem;background:#fff8e6;border-radius:10px;border-left:4px solid #f59e0b"><h5 style="margin-bottom:.5rem;color:#92400e">Note admin :</h5><p>${escHtml(r.note_admin)}</p></div>` : ''}
                        <div class="table-actions" style="margin-top:1.5rem">
                         ${r.statut === 'en_attente' ? `
                            <button class="btn btn-success btn-sm" onclick="rdvSetStatut(${r.id},'confirme')"><i class="fas fa-check"></i> Confirmer</button>
                            <button class="btn btn-danger btn-sm" onclick="rdvSetStatut(${r.id},'annule')"><i class="fas fa-times"></i> Annuler</button>
                          ` : ''}
                          <button class="btn btn-outline btn-sm" onclick="rdvContact(${JSON.stringify(r).replace(/"/g, '&quot;')})"><i class="fab fa-whatsapp"></i> WhatsApp</button>
                          <button class="btn btn-outline btn-sm" onclick="sendTrackingLink(${r.id})" title="Envoyer le lien de suivi au client"><i class="fas fa-link"></i> Suivi</button>
                          <button class="btn btn-outline btn-sm" onclick="openFicheClient('${safeTel}','${escAttr(r.nom)}')" title="Fiche client complète"><i class="fas fa-user"></i> Fiche</button>
                          <button class="btn btn-outline btn-sm" onclick="generateFacture(${r.id})" title="Générer la facture PDF"><i class="fas fa-receipt"></i> Facture</button>
                          <button class="btn btn-outline btn-sm" onclick="rdvNote(${r.id}, ${JSON.stringify(r.note_admin || '').replace(/"/g, '&quot;')})"><i class="fas fa-sticky-note"></i> Note</button>
                          <button class="btn btn-outline btn-sm" onclick="rdvDelete(${r.id})"><i class="fas fa-trash" style="color:var(--danger)"></i> Supprimer</button>
                        </div>
                      </div>
                      ${r.photo_url ? `
                        <div style="flex:0 0 200px">
                          <h4 style="color:var(--vert);margin-bottom:.75rem">Photo envoyée</h4>
                          <a href="${escAttr(r.photo_url)}" target="_blank">
                            <img src="${escAttr(r.photo_url)}" class="photo-preview-admin" alt="Photo client">
                          </a>
                        </div>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
        }).join('')}
          </tbody>
        </table>
      </div>`;
      } catch (e) {
        el.innerHTML = `<div style="color:var(--danger);padding:1rem">Erreur : ${_escRdv(e.message)}</div>`;
      }
    }

    function escHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Helper: parser date sans décalage timezone
    function parseLocalDate(dateStr, timeSuffix = 'T12:00:00') {
      if (!dateStr) return null;
      // Parser directement sans conversion timezone
      const parts = dateStr.split('-');
      if (parts.length !== 3) return null;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }

    // Escape pour les attributs HTML
    function escAttr(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function rdvToggle(id) {
      const row = $(`rdv-row-${id}`);
      const details = $(`rdv-details-${id}`);
      if (!row || !details) return;

      const isOpen = row.classList.contains('rdv-expanded');

      // Fermer les autres (optionnel, mais propre)
      document.querySelectorAll('.rdv-row').forEach(r => r.classList.remove('rdv-expanded'));

      if (!isOpen) {
        row.classList.add('rdv-expanded');
      }
    }

    async function rdvSetStatut(id, statut) {
      const labels = { confirme: 'Confirmer', annule: 'Annuler', termine: 'Marquer terminé' };
      if (!confirm(`${labels[statut] || statut} ce rendez-vous ?`)) return;
      try {
        /* Récupérer les infos du RDV pour l'email */
        const rdvs = await sb.rdv.list(null);
        const rdv = rdvs.find(r => r.id === id);

        await sb.rdv.setStatut(id, statut);
        showToast(`Statut mis à jour : ${RDV_STATUTS[statut]?.label}`, 'success');

        /* ── Historique ── */
        const actionLabel = { confirme: 'RDV confirmé', annule: 'RDV annulé', termine: 'RDV marqué terminé' };
        histLog('rdv', actionLabel[statut] || `RDV → ${statut}`, rdv ? `${rdv.nom} — ${rdv.date_rdv} — ${rdv.service}` : `#${id}`);

        /* ── Envoi email automatique via Edge Function send-status ── */
        if (rdv && rdv.email && (statut === 'confirme' || statut === 'annule')) {
          try {
            await sb.invoke('send-status', {
              nom: rdv.nom,
              email: rdv.email,
              tel: rdv.tel,
              service: rdv.service,
              date_rdv: rdv.date_rdv,
              heure: rdv.heure,
              statut,
            });
            showToast(`Email ${statut === 'confirme' ? 'de confirmation' : "d'annulation"} envoyé à ${rdv.email}`, 'success');
          } catch (mailErr) {
            showToast('Statut mis à jour mais email non envoyé : ' + mailErr.message, 'warning');
          }
        }

        loadRdv(_rdvStatutActif);
      } catch (e) {
        showToast('Erreur : ' + e.message, 'error');
      }
    }

    async function rdvNote(id, noteActuelle) {
      const note = prompt('Note interne (visible uniquement dans l\'admin) :', noteActuelle || '');
      if (note === null) return;
      try {
        await sb.rdv.setNote(id, note);
        showToast('Note enregistrée', 'success');
        histLog('rdv', 'Note admin ajoutée', `RDV #${id}`);
        loadRdv(_rdvStatutActif);
      } catch (e) {
        showToast('Erreur : ' + e.message, 'error');
      }
    }

    /* ── Helper Suivi (Relance 1.5 mois) ── */
    function isToRelance(r) {
      if (r.statut !== 'termine') return false;
      if (!r.date_rdv) return false;
      const rdvDate = parseLocalDate(r.date_rdv);
      if (!rdvDate) return false;
      const diffDays = Math.floor((new Date() - rdvDate) / (1000 * 60 * 60 * 24));
      return diffDays >= 45; // 1.5 mois (45 jours)
    }

    async function rdvDelete(id) {
      if (!confirm('Supprimer définitivement ce rendez-vous ?')) return;
      try {
        await sb.rdv.delete(id);
        showToast('Rendez-vous supprimé', 'success');
        histLog('rdv', 'RDV supprimé', `#${id}`);
        loadRdv(_rdvStatutActif);
      } catch (e) {
        showToast('Erreur : ' + e.message, 'error');
      }
    }

    function rdvContact(rdv) {
      let msg;
      if (rdv.statut === 'annule') {
        msg =
          `Bonjour ${rdv.nom} 👋\n\n` +
          `Nous sommes désolés de vous informer que votre rendez-vous du ${rdv.date_rdv} chez MiraLocks n'a pas pu être confirmé.\n\n` +
          `N'hésitez pas à reprendre rendez-vous sur notre site ou à nous contacter directement.\n\n` +
          `Nous espérons vous voir très bientôt ! 🌿`;
      } else {
        msg =
          `Bonjour ${rdv.nom} 👋\n\nNous avons bien reçu votre demande de rendez-vous chez Miralocks.\n\n` +
          `📅 *Date* : ${rdv.date_rdv}\n🕐 *Heure* : ${rdv.heure || 'À confirmer'}\n💆 *Service* : ${rdv.service}\n\n` +
          `Nous vous confirmons votre rendez-vous. À très bientôt ! 🌿`;
      }
      window.open(`https://wa.me/${rdv.tel.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
      histLog('rdv', rdv.statut === 'annule' ? 'Message WhatsApp annulation envoyé' : 'Message WhatsApp confirmation envoyé', `${rdv.nom} — ${rdv.tel}`);
    }

    /* ── STATISTIQUES DASHBOARD (Graphiques — Voir admin-charts.js) ────────── */
    window._rdvCountsCache = {};
    window._allRdvs = [];



    /* ── SURVEILLANCE DES NOUVEAUX RDV (Notifications) ────────── */
    let _rdvWatcher = { interval: null, lastCount: 0 };
    function initRdvWatcher(initialCount) {
      _rdvWatcher.lastCount = initialCount;
      if (_rdvWatcher.interval) return;
      _rdvWatcher.interval = setInterval(async () => {
        try {
          const c = await sb.rdv.counts();
          if (c.en_attente > _rdvWatcher.lastCount) {
            // Nouveau RDV détecté !
            playRdvSound();
            showToast(`Nouveau rendez-vous ! (${c.en_attente - _rdvWatcher.lastCount})`, 'success');

            // Notification système
            if ("Notification" in window && Notification.permission === "granted") {
              const diff = c.en_attente - _rdvWatcher.lastCount;
              new Notification("Miralocks", {
                body: `Vous avez ${diff} nouveau(x) rendez-vous en attente.`,
                icon: 'assets/logo-vert.png'
              });
            }

            _rdvWatcher.lastCount = c.en_attente;
            // Rafraîchir les compteurs discrets
            if ($('rdv-badge')) $('rdv-badge').textContent = c.en_attente;
            if ($('drawer-rdv-badge')) $('drawer-rdv-badge').textContent = c.en_attente;
          }
        } catch (e) { }
      }, 60000); // Toutes les minutes
    }

    function playRdvSound() {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
      audio.play().catch(e => console.warn('Audio play blocked:', e));
    }
    async function loadBlog() {
      const el = $('blog-list');
      el.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement…</div>';
      try {
        const posts = await sb.blog.list(false);
        $('blog-count').textContent = `(${posts.length})`;
        if (!posts.length) {
          el.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><p>Aucun article. Créez le premier !</p></div>';
          return;
        }
        el.innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Photo</th><th>Titre</th><th>Catégorie</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody>${posts.map(p => `
        <tr>
          <td>${p.photo_url ? `<img src="${p.photo_url}" class="table-thumb" width="56" height="56" loading="lazy">` : '<div style="width:56px;height:56px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center"><i class="fas fa-image" style="color:#ccc"></i></div>'}</td>
          <td><strong>${p.titre}</strong><br><small style="color:var(--gris-d)">${(p.extrait || '').slice(0, 60)}…</small></td>
          <td><span class="badge badge-warning">${p.categorie || '—'}</span></td>
          <td><span class="badge ${p.publie ? 'badge-success' : 'badge-danger'}">${p.publie ? 'Publié' : 'Brouillon'}</span></td>
          <td style="white-space:nowrap">${new Date(p.created_at).toLocaleDateString('fr')}</td>
          <td><div class="table-actions">
            <button class="btn btn-sm btn-outline btn-icon" onclick="editBlog(${p.id})" title="Modifier"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm ${p.publie ? 'btn-warning' : 'btn-success'} btn-icon" onclick="toggleBlog(${p.id},${p.publie})" title="${p.publie ? 'Dépublier' : 'Publier'}"><i class="fas fa-${p.publie ? 'eye-slash' : 'eye'}"></i></button>
            <button class="btn btn-sm btn-danger btn-icon" onclick="deleteBlog(${p.id},'${p.photo_url || ''}')" title="Supprimer"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`).join('')}
      </tbody></table></div>`;
      } catch (e) { el.innerHTML = `<div style="color:var(--danger);padding:1rem">Erreur : ${_escRdv(e.message)}</div>`; }
    }

    function openModal_Blog_new() {
      $('modal-blog-title').textContent = 'Nouvel article';
      $('blog-edit-id').value = '';
      ['blog-titre', 'blog-extrait', 'blog-contenu'].forEach(id => $(id).value = '');
      $('blog-photo-url').value = '';
      $('blog-preview').innerHTML = '';
      $('blog-publie').checked = false;
      openModal('blog');
    }
    // Extension de openModal pour les modules spécifiques
    const _originalOpenModal = window.openModal;
    window.openModal = (name) => {
      // Blog
      if (name === 'blog') {
        const editId = $('blog-edit-id');
        if (editId && !editId.value) openModal_Blog_new();
      }
      // Services
      else if (name === 'services') {
        const editId = $('service-edit-id');
        if (editId && !editId.value) openModal_Service_new();
      }
      // Videos
      else if (name === 'videos') {
        const editId = $('video-edit-id');
        if (editId && !editId.value) openModal_Video_new();
      }
      // fallback original
      else {
        _originalOpenModal(name);
      }
    };

    async function editBlog(id) {
      const p = await sb.blog.get(id);
      if (!p) return;
      $('modal-blog-title').textContent = 'Modifier l\'article';
      $('blog-edit-id').value = p.id;
      $('blog-titre').value = p.titre || '';
      $('blog-extrait').value = p.extrait || '';
      $('blog-contenu').value = p.contenu || '';
      $('blog-cat').value = p.categorie || 'Entretien';
      $('blog-publie').checked = !!p.publie;
      $('blog-photo-url').value = p.photo_url || '';
      $('blog-preview').innerHTML = p.photo_url
        ? `<div class="upload-preview-item"><img src="${p.photo_url}"><div class="remove-file" onclick="$('blog-photo-url').value='';$('blog-preview').innerHTML=''">×</div></div>`
        : '';
      openModal('blog');
    }

    async function saveBlog() {
      const titre = $('blog-titre').value.trim();
      if (!titre) { toast('Le titre est obligatoire', 'error'); return; }
      setLoading('blog-save-btn', true);
      try {
        // Upload photo si nouveau fichier
        const file = $('blog-photo-file').files[0];
        let photoUrl = $('blog-photo-url').value;
        if (file) {
          showProgress('blog', 30);
          photoUrl = await sb.upload('blog', file);
          showProgress('blog', 100);
        }
        const data = {
          titre,
          extrait: $('blog-extrait').value.trim(),
          contenu: $('blog-contenu').value.trim(),
          categorie: $('blog-cat').value,
          publie: $('blog-publie').checked,
          photo_url: photoUrl || null,
        };
        const id = $('blog-edit-id').value;
        if (id) await sb.blog.update(id, data);
        else await sb.blog.create(data);
        toast(id ? 'Article mis à jour !' : 'Article créé !');
        histLog('blog', id ? 'Article mis à jour' : 'Article créé', titre);
        closeModal('blog');
        loadBlog();
        loadDashboard();
      } catch (e) { toast(e.message, 'error'); }
      finally { setLoading('blog-save-btn', false); hideProgress('blog'); $('blog-photo-file').value = ''; }
    }

    async function toggleBlog(id, current) {
      await sb.blog.togglePublish(id, current);
      toast(current ? 'Article dépublié' : 'Article publié !');
      histLog('blog', current ? 'Article dépublié' : 'Article publié', `#${id}`);
      loadBlog();
    }

    async function deleteBlog(id, photoUrl) {
      if (!confirm('Supprimer cet article définitivement ?')) return;
      await sb.blog.delete(id, photoUrl);
      toast('Article supprimé', 'warning');
      histLog('blog', 'Article supprimé', `#${id}`);
      loadBlog();
      loadDashboard();
    }

