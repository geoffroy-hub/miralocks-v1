/* ============================================================
   Miralocks Admin — admin-boutique.js
   Gestion dynamique des articles de la boutique
   ============================================================ */

window.BoutiqueAdmin = {
  articles: [],
  settings: {
    minOrder: 10000,
    deliveryFee: 1500,
    paymentMode: 'whatsapp'
  },

  async init() {
    console.log('[BoutiqueAdmin] Initialisation...');
    await this.loadSettings();
    await this.loadArticles();
  },

  async loadSettings() {
    try {
      const [minOrder, deliveryFee, paymentMode] = await Promise.all([
        sb.settings.get('boutique_min_order'),
        sb.settings.get('boutique_delivery_fee'),
        sb.settings.get('boutique_payment_mode')
      ]);
      
      if (minOrder) this.settings.minOrder = parseInt(minOrder);
      if (deliveryFee) this.settings.deliveryFee = parseInt(deliveryFee);
      if (paymentMode) this.settings.paymentMode = paymentMode;

      // Update UI in Paramètres
      if ($('shop-min-order')) $('shop-min-order').value = this.settings.minOrder;
      if ($('shop-delivery-fee')) $('shop-delivery-fee').value = this.settings.deliveryFee;
      if ($('shop-payment-mode')) $('shop-payment-mode').value = this.settings.paymentMode;
      
      // Update UI in Boutique Panel
      if ($('shop-min-order-display')) $('shop-min-order-display').textContent = this.settings.minOrder.toLocaleString() + ' F';
    } catch (e) {
      console.warn('[BoutiqueAdmin] Erreur chargement settings:', e);
    }
  },

  async saveSettings() {
    const minOrder = $('shop-min-order').value;
    const deliveryFee = $('shop-delivery-fee').value;
    const paymentMode = $('shop-payment-mode').value;

    const btn = $('shop-save-settings-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enregistrement...';

    try {
      await Promise.all([
        sb.settings.set('boutique_min_order', minOrder),
        sb.settings.set('boutique_delivery_fee', deliveryFee),
        sb.settings.set('boutique_payment_mode', paymentMode)
      ]);
      toast('Réglages boutique enregistrés !', 'success');
      await this.loadSettings();
    } catch (e) {
      toast('Erreur lors de l\'enregistrement', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer les réglages';
    }
  },

  async loadArticles() {
    const list = $('shop-articles-list');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner"></div> Chargement...</td></tr>';

    try {
      const articles = await sb._get('boutique_articles', 'order=created_at.desc');
      this.articles = articles || [];
      
      if ($('shop-total-articles')) $('shop-total-articles').textContent = this.articles.length;

      if (this.articles.length === 0) {
        list.innerHTML = '<tr><td colspan="5" class="text-center">Aucun article en vente.</td></tr>';
        return;
      }

      list.innerHTML = this.articles.map(art => `
        <tr>
          <td>
            <img src="${art.image_url || 'assets/logo-transparent.png'}" style="width:40px;height:40px;object-fit:cover;border-radius:4px" alt="">
          </td>
          <td>
            <strong>${_escBiz(art.nom)}</strong>
            <div style="font-size:.75rem;color:var(--gris-d);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_escBiz(art.description || '')}</div>
          </td>
          <td style="font-weight:600;color:var(--vert)">${parseInt(art.prix).toLocaleString()} F</td>
          <td>
            <span class="badge ${art.is_active ? 'badge-success' : 'badge-warning'}">
              ${art.is_active ? 'Actif' : 'Masqué'}
            </span>
          </td>
          <td style="text-align:right">
            <button class="btn btn-sm btn-outline" onclick="BoutiqueAdmin.openEditModal('${art.id}')"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-outline" style="color:red" onclick="BoutiqueAdmin.deleteArticle('${art.id}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      list.innerHTML = '<tr><td colspan="5" class="text-center" style="color:red">Erreur : ' + e.message + '</td></tr>';
    }
  },

  openAddModal() {
    this.renderModal();
  },

  openEditModal(id) {
    const art = this.articles.find(a => a.id === id);
    if (art) this.renderModal(art);
  },

  renderModal(article = null) {
    const isEdit = !!article;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
    modal.innerHTML = `
      <div style="background:var(--bg-card,#fff);border-radius:20px;padding:2rem;max-width:500px;width:100%;max-height:90vh;overflow-y:auto">
        <h2 style="margin:0 0 1.5rem;color:var(--vert)">${isEdit ? 'Modifier l\'article' : 'Nouvel Article'}</h2>
        <form id="shop-art-form">
          <div class="form-group">
            <label class="form-label">Nom de l'article *</label>
            <input type="text" id="art-nom" class="form-control" placeholder="Ex: Huile de croissance" value="${article?.nom || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Prix (FCFA) *</label>
            <input type="number" id="art-prix" class="form-control" placeholder="Ex: 5000" value="${article?.prix || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea id="art-desc" class="form-control" style="min-height:80px" placeholder="Détails du produit...">${article?.description || ''}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Image du produit</label>
            <div class="upload-zone" id="art-upload-zone" style="height:100px;padding:1rem">
              <input type="file" id="art-file" accept="image/*" onchange="BoutiqueAdmin.handleFileSelect(this)">
              <i class="fas fa-image" style="font-size:1.5rem"></i>
              <p style="font-size:.8rem">Cliquez pour ajouter une photo</p>
            </div>
            <div id="art-preview" style="margin-top:.5rem">
              ${article?.image_url ? `<img src="${article.image_url}" style="width:60px;height:60px;object-fit:cover;border-radius:6px">` : ''}
            </div>
            <input type="hidden" id="art-img-url" value="${article?.image_url || ''}">
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
              <input type="checkbox" id="art-active" ${article && !article.is_active ? '' : 'checked'} style="width:16px;height:16px"> Visibilité publique
            </label>
          </div>
          <div style="display:flex;gap:.75rem;margin-top:2rem;justify-content:flex-end">
            <button type="button" class="btn btn-outline" onclick="this.closest('[style*=fixed]').remove()">Annuler</button>
            <button type="submit" class="btn btn-or">${isEdit ? 'Mettre à jour' : 'Créer l\'article'}</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#shop-art-form').onsubmit = async (e) => {
      e.preventDefault();
      await this.saveArticle(article?.id);
      modal.remove();
    };
  },

  async handleFileSelect(input) {
    if (!input.files[0]) return;
    const file = input.files[0];
    const preview = $('art-preview');
    preview.innerHTML = '<div class="spinner"></div> Upload en cours...';

    try {
      const path = `boutique/product_${Date.now()}_${file.name}`;
      const url = await sb.upload(file, path);
      $('art-img-url').value = url;
      preview.innerHTML = `<img src="${url}" style="width:60px;height:60px;object-fit:cover;border-radius:6px">`;
    } catch (e) {
      toast('Erreur upload : ' + e.message, 'error');
      preview.innerHTML = '';
    }
  },

  async saveArticle(id = null) {
    const data = {
      nom: $('art-nom').value.trim(),
      prix: parseInt($('art-prix').value),
      description: $('art-desc').value.trim(),
      image_url: $('art-img-url').value,
      is_active: $('art-active').checked
    };

    try {
      if (id) {
        await sb._update('boutique_articles', data, `id=eq.${id}`);
        toast('Article mis à jour !', 'success');
      } else {
        await sb._post('boutique_articles', data);
        toast('Article créé !', 'success');
      }
      await this.loadArticles();
    } catch (e) {
      toast('Erreur : ' + e.message, 'error');
    }
  },

  async deleteArticle(id) {
    if (!confirm('Voulez-vous vraiment supprimer cet article ?')) return;
    try {
      await sb._delete('boutique_articles', `id=eq.${id}`);
      toast('Article supprimé', 'warning');
      await this.loadArticles();
    } catch (e) {
      toast('Erreur : ' + e.message, 'error');
    }
  }
};

// Enregistrement dans le Registry pour chargement automatique au switch de panel
if (window.ParamRegistry) {
  window.ParamRegistry.register(() => window.BoutiqueAdmin.loadSettings());
}

// Hook au changement de panel
document.addEventListener('DOMContentLoaded', () => {
  const origShowPanel = window.showPanel;
  window.showPanel = function(id) {
    origShowPanel.apply(this, arguments);
    if (id === 'boutique-admin') window.BoutiqueAdmin.loadArticles();
    if (id === 'parametres') window.BoutiqueAdmin.loadSettings();
  };
  
  // Init au besoin
  setTimeout(() => window.BoutiqueAdmin.init(), 1000);
});
