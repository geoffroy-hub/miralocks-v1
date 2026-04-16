/* ============================================================
   Miralocks Admin — admin-avis.js
   Module : Avis clients
   ============================================================ */
/* Helper : échappement HTML pour éviter les injections XSS */
const _escAvis = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');


    /* ── AVIS ────────────────────────────────────────────────── */
    async function loadAvis(onlyApproved) {
      const el = $('avis-list');
      el.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement…</div>';
      try {
        const all = await sb.avis.list(false);
        const list = onlyApproved ? all.filter(a => a.approuve) : all.filter(a => !a.approuve);
        const pending = all.filter(a => !a.approuve).length;
        $('avis-count').textContent = `(${onlyApproved ? 'approuvés' : 'en attente'} : ${list.length})`;
        const badge = $('avis-badge');
        badge.textContent = pending;
        badge.style.display = pending > 0 ? 'inline-block' : 'none';
        // Sync badge mobile
        const mobileBadge = $('drawer-avis-badge');
        if (mobileBadge) {
          mobileBadge.textContent = pending;
          mobileBadge.style.display = pending > 0 ? 'inline-block' : 'none';
        }

        if (!list.length) {
          el.innerHTML = `<div class="empty-state"><i class="fas fa-star"></i><p>${onlyApproved ? 'Aucun avis approuvé' : 'Aucun avis en attente — tout est traité ✅'}</p></div>`;
          return;
        }
        el.innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Client</th><th>Note</th><th>Avis</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody>${list.map(a => `
        <tr>
          <td><strong>${escHtml(a.nom)}</strong><br><small>${escHtml(a.localite || '')}</small></td>
          <td><span class="stars">${'★'.repeat(a.etoiles || 5)}${'☆'.repeat(5 - (a.etoiles || 5))}</span></td>
          <td style="max-width:280px"><em style="font-size:.88rem;color:var(--gris-d)">"${escHtml((a.texte || '').slice(0, 120))}…"</em></td>
          <td style="white-space:nowrap">${new Date(a.created_at).toLocaleDateString('fr')}</td>
          <td><div class="table-actions">
            ${!a.approuve ? `<button class="btn btn-sm btn-success btn-icon" onclick="approveAvis(${a.id})" title="Approuver"><i class="fas fa-check"></i></button>` : ''}
            <button class="btn btn-sm btn-danger btn-icon" onclick="deleteAvis(${a.id})" title="Supprimer"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`).join('')}
      </tbody></table></div>`;
      } catch (e) { el.innerHTML = `<div style="color:var(--danger);padding:1rem">Erreur : ${_escAvis(e.message)}</div>`; }
    }

    async function approveAvis(id) {
      try {
        await sb.avis.approve(id);
        toast('Avis approuvé et publié !');
        histLog('avis', 'Avis approuvé', `#${id}`);
        loadAvis(false);
        loadDashboard();
      } catch (e) { toast(e.message, 'error'); }
    }
    async function deleteAvis(id) {
      if (!confirm('Supprimer cet avis ?')) return;
      try {
        await sb.avis.delete(id);
        toast('Avis supprimé', 'warning');
        histLog('avis', 'Avis supprimé', `#${id}`);
        loadAvis(false);
        loadDashboard();
      } catch (e) { toast(e.message, 'error'); }
    }

    async function saveAvisAdmin() {
      const nom = $('avis-admin-nom').value.trim();
      const texte = $('avis-admin-texte').value.trim();
      if (!nom) { toast('Le nom est obligatoire', 'error'); return; }
      if (!texte) { toast('Le témoignage est obligatoire', 'error'); return; }
      setLoading('avis-admin-save-btn', true);
      try {
        // Insertion directe avec token admin (contourne le INSERT public)
        const s = await sb.getValidSession();
        const r = await fetch(`${SUPABASE_URL}/rest/v1/avis_clients`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON,
            'Authorization': `Bearer ${s.token}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            nom,
            localite: $('avis-admin-localite').value.trim() || null,
            etoiles: +$('avis-admin-etoiles').value,
            texte,
            approuve: $('avis-admin-approuve').checked,
          }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.message || e.details || `Erreur ${r.status}`);
        }
        toast('Avis ajouté !');
        histLog('avis', 'Avis ajouté manuellement', nom);
        closeModal('avis');
        // Réinitialiser le formulaire
        $('avis-admin-nom').value = '';
        $('avis-admin-localite').value = '';
        $('avis-admin-texte').value = '';
        $('avis-admin-etoiles').value = '5';
        $('avis-admin-approuve').checked = true;
        loadAvis($('avis-admin-approuve').checked);
        loadDashboard();
      } catch (e) { toast(e.message, 'error'); }
      finally { setLoading('avis-admin-save-btn', false); }
    }

