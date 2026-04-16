/* ============================================================
   Miralocks Admin — admin-galerie.js
   Module : Galerie photos
   ============================================================ */
/* Helper : échappement HTML pour éviter les injections XSS */
const _escGal = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');


    /* ── GALERIE ─────────────────────────────────────────────── */
    async function loadGalerie() {
      const el = $('galerie-list');
      el.innerHTML = '<div class="loading"><div class="spinner"></div> Chargement…</div>';
      try {
        const photos = await sb.galerie.list(false);
        $('galerie-count').textContent = `(${photos.length})`;
        if (!photos.length) {
          el.innerHTML = '<div class="empty-state"><i class="fas fa-images"></i><p>Aucune photo. Ajoutez-en !</p></div>';
          return;
        }
        el.innerHTML = `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>Photo</th><th>Titre</th><th>Catégorie</th><th>Statut</th><th>Actions</th></tr></thead>
      <tbody>${photos.map(p => `
        <tr>
          <td><img src="${p.photo_url}" class="table-thumb" width="56" height="56" loading="lazy"></td>
          <td>${p.titre || '—'}</td>
          <td><span class="badge badge-warning">${p.categorie || '—'}</span></td>
          <td><span class="badge ${p.publie ? 'badge-success' : 'badge-danger'}">${p.publie ? 'Publié' : 'Masqué'}</span></td>
          <td><div class="table-actions">
            <button class="btn btn-sm ${p.publie ? 'btn-warning' : 'btn-success'} btn-icon" onclick="toggleGalerie(${p.id},${p.publie})"><i class="fas fa-${p.publie ? 'eye-slash' : 'eye'}"></i></button>
            <button class="btn btn-sm btn-outline btn-icon" onclick="copyInstagramPost(${JSON.stringify(p).replace(/"/g,'&quot;')})" title="Copier post Instagram"><i class="fab fa-instagram"></i></button>
            <button class="btn btn-sm btn-danger btn-icon" onclick="deleteGalerie(${p.id},'${p.photo_url}')"><i class="fas fa-trash"></i></button>
          </div></td>
        </tr>`).join('')}
      </tbody></table></div>`;
      } catch (e) { el.innerHTML = `<div style="color:var(--danger);padding:1rem">Erreur : ${_escGal(e.message)}</div>`; }
    }

    // Préview multi-photos
    $('galerie-photo-files').addEventListener('change', function () {
      const prev = $('galerie-preview');
      prev.innerHTML = '';
      Array.from(this.files).forEach(f => {
        const url = URL.createObjectURL(f);
        prev.innerHTML += `<div class="upload-preview-item"><img src="${url}"></div>`;
      });
    });

    async function saveGalerie() {
      const files = $('galerie-photo-files').files;
      if (!files.length) { toast('Sélectionnez au moins une photo', 'error'); return; }
      const prog = $('galerie-progress');
      const bar = $('galerie-progress-bar');
      prog.style.display = 'block';
      try {
        let done = 0;
        for (const file of files) {
          const url = await sb.upload('galerie', file);
          await sb.galerie.create({
            titre: $('galerie-titre').value.trim() || file.name.replace(/\.[^.]+$/, ''),
            categorie: $('galerie-cat').value,
            photo_url: url,
            publie: $('galerie-publie').checked,
            ordre: 0,
          });
          done++;
          bar.style.width = `${(done / files.length) * 100}%`;
        }
        toast(`${done} photo(s) ajoutée(s) !`);
        histLog('galerie', `${done} photo(s) ajoutée(s)`);
        closeModal('galerie');
        loadGalerie();
        loadDashboard();
      } catch (e) { toast(e.message, 'error'); }
      finally { prog.style.display = 'none'; bar.style.width = '0%'; $('galerie-photo-files').value = ''; $('galerie-preview').innerHTML = ''; }
    }

    async function toggleGalerie(id, current) {
      await sb.galerie.togglePublish(id, current);
      toast(current ? 'Photo masquée' : 'Photo publiée !');
      histLog('galerie', current ? 'Photo masquée' : 'Photo publiée', `#${id}`);
      loadGalerie();
    }
    async function deleteGalerie(id, url) {
      if (!confirm('Supprimer cette photo ?')) return;
      await sb.galerie.delete(id, url);
      toast('Photo supprimée', 'warning');
      histLog('galerie', 'Photo supprimée', `#${id}`);
      loadGalerie();
      loadDashboard();
    }


/* ══════════════════════════════════════════════════════════
   INSTAGRAM COPY-POST
   Génère un texte de post Instagram prêt à copier
   (pas d'API Meta requise — copier-coller manuel)
══════════════════════════════════════════════════════════ */
window.copyInstagramPost = function(photo) {
  const titre   = photo.titre   || 'Nouvelle réalisation MiraLocks';
  const desc    = photo.description || '';
  const cat     = photo.categorie || '';

  const emojis = { locks: '🌿', dreadlocks: '🌿', coiffure: '✨', avant_apres: '🔄', entretien: '💆‍♀️' };
  const emoji  = emojis[cat] || '🌿';

  const hashtags = [
    '#MiraLocks', '#LocksNaturels', '#DreadlocksLomé', '#CapillaireAfrica',
    '#ChevreuxNaturels', '#NaturalHair', '#LomeTogo', '#TogoBeauty',
    '#AfricanHair', '#LocksLife', '#NaturalLocs', '#InstituMiraLocks',
  ].join(' ');

  const post = `${emoji} ${titre}

${desc ? desc + '\n\n' : ''}✨ Prenez rendez-vous chez MiraLocks à Lomé
📍 Agoè Cacaveli, Lomé — Togo
📞 +228 97 98 90 01
🌐 mira-lecks.vercel.app

${hashtags}`;

  navigator.clipboard.writeText(post).then(() => {
    (window.toast || window.showToast)?.('Post Instagram copié ! Collez-le directement dans l\'appli 📋', 'success');
  }).catch(() => {
    /* Fallback si clipboard non disponible */
    const ta = document.createElement('textarea');
    ta.value = post;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    (window.toast || window.showToast)?.('Post Instagram copié !', 'success');
  });
};
