/* ============================================================
   Miralocks — boutique.js
   Gestion du panier, minimum de commande et CinetPay
   ============================================================ */

const Boutique = {
  cart: [],
  settings: {
    minOrder: 10000,
    deliveryFee: 1500,
    paymentMode: 'whatsapp'
  },

  async init() {
    console.log('[Boutique] Initialisation...');
    await this.loadSettings();
    this.loadCartFromStorage();
    await this.renderArticles();
    this.updateCartUI();
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
    } catch (e) { console.warn('Erreur réglages boutique:', e); }
  },

  loadCartFromStorage() {
    const saved = localStorage.getItem('miralocks_cart');
    if (saved) {
      try { this.cart = JSON.parse(saved); } catch (e) { this.cart = []; }
    }
  },

  saveCartToStorage() {
    localStorage.setItem('miralocks_cart', JSON.stringify(this.cart));
  },

  async renderArticles() {
    const container = document.querySelector('.services-grid') || document.querySelector('.container .grid');
    if (!container) return;

    try {
      const articles = await sb._get('boutique_articles', 'is_active=eq.true&order=created_at.desc');
      if (!articles || articles.length === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem"><h3>Bientôt disponible</h3><p>Revenez bientôt pour découvrir nos nouveaux produits !</p></div>';
        return;
      }

      container.innerHTML = articles.map((art, idx) => `
        <div class="service-card fade-in" style="display:flex;flex-direction:column;text-align:center;padding-top:2rem;animation-delay:${idx * 0.1}s">
           <div style="height:140px;display:flex;align-items:center;justify-content:center;margin-bottom:1rem">
             ${art.image_url ? 
               `<img src="${art.image_url}" style="max-height:100%;max-width:100%;object-fit:contain;border-radius:8px" alt="${_escBiz(art.nom)}">` : 
               `<div style="font-size:4rem">🧴</div>`}
           </div>
           <h3 style="font-family:var(--font-heading);color:var(--vert);font-size:1.3rem;">${_escBiz(art.nom)}</h3>
           <p style="color:var(--text);font-size:.9rem;padding:0 1rem;flex-grow:1;margin-top:.5rem;">${_escBiz(art.description || '')}</p>
           <div style="margin-top:1.5rem;margin-bottom:1rem;color:var(--or);font-weight:700;font-size:1.25rem;">${parseInt(art.prix).toLocaleString()} FCFA</div>
           <button onclick="Boutique.addToCart('${art.id}', '${art.nom.replace(/'/g, "\\'")}', ${art.prix})" class="btn btn-vert" style="margin:1rem;border-radius:2rem;display:inline-block;">
             <i class="fas fa-plus"></i> Ajouter au panier
           </button>
        </div>
      `).join('');
    } catch (e) {
      console.error('Erreur chargement articles:', e);
    }
  },

  addToCart(id, nom, prix) {
    const existing = this.cart.find(item => item.id === id);
    if (existing) {
      existing.qty++;
    } else {
      this.cart.push({ id, nom, prix, qty: 1 });
    }
    this.saveCartToStorage();
    this.updateCartUI();
    this.showToastPro('Article ajouté au panier 🛍️');
  },

  removeFromCart(id) {
    this.cart = this.cart.filter(item => item.id !== id);
    this.saveCartToStorage();
    this.updateCartUI();
  },

  updateQty(id, delta) {
    const item = this.cart.find(i => i.id === id);
    if (item) {
      item.qty += delta;
      if (item.qty <= 0) return this.removeFromCart(id);
      this.saveCartToStorage();
      this.updateCartUI();
    }
  },

  updateCartUI() {
    const totalQty = this.cart.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = this.cart.reduce((sum, item) => sum + (item.prix * item.qty), 0);
    
    // Floating Button
    let floatBtn = document.getElementById('cart-float');
    if (!floatBtn) {
      floatBtn = document.createElement('div');
      floatBtn.id = 'cart-float';
      floatBtn.onclick = () => this.toggleSidebar(true);
      floatBtn.style.cssText = 'position:fixed;bottom:90px;right:20px;z-index:998;background:var(--or);color:var(--vert);width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 16px rgba(0,0,0,0.2);cursor:pointer;transition:transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
      floatBtn.innerHTML = '<i class="fas fa-shopping-basket" style="font-size:1.5rem"></i><span id="cart-count" style="position:absolute;top:0;right:0;background:var(--vert);color:var(--or);width:22px;height:22px;border-radius:50%;font-size:0.75rem;font-weight:bold;display:flex;align-items:center;justify-content:center;border:2px solid var(--or)">0</span>';
      document.body.appendChild(floatBtn);
    }
    
    document.getElementById('cart-count').textContent = totalQty;
    floatBtn.style.transform = totalQty > 0 ? 'scale(1)' : 'scale(0)';

    // Update Sidebar content if open
    this.renderSidebarContent(totalPrice, totalQty);
  },

  toggleSidebar(open) {
    let sidebar = document.getElementById('cart-sidebar');
    if (!sidebar) {
      sidebar = document.createElement('div');
      sidebar.id = 'cart-sidebar';
      sidebar.style.cssText = 'position:fixed;top:0;right:-100%;width:100%;max-width:400px;height:100vh;background:var(--bg-card,#fff);z-index:1000;box-shadow:-8px 0 24px rgba(0,0,0,0.1);transition:right 0.3s ease;display:flex;flex-direction:column;padding:1.5rem';
      sidebar.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;border-bottom:1px solid #eee;padding-bottom:1rem">
          <h2 style="margin:0;color:var(--vert);font-family:var(--font-heading)">Mon Panier</h2>
          <button onclick="Boutique.toggleSidebar(false)" style="background:none;border:none;font-size:1.5rem;cursor:pointer">&times;</button>
        </div>
        <div id="cart-items" style="flex:1;overflow-y:auto;padding-right:0.5rem"></div>
        <div id="cart-summary" style="padding-top:1.5rem;border-top:1px solid #eee;margin-top:auto"></div>
      `;
      document.body.appendChild(sidebar);
      
      const overlay = document.createElement('div');
      overlay.id = 'cart-overlay';
      overlay.onclick = () => this.toggleSidebar(false);
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100vh;background:rgba(0,0,0,0.5);z-index:999;display:none';
      document.body.appendChild(overlay);
    }

    const overlay = document.getElementById('cart-overlay');
    sidebar.style.right = open ? '0' : '-100%';
    overlay.style.display = open ? 'block' : 'none';
    
    if (open) this.updateCartUI();
  },

  renderSidebarContent(total, qty) {
    const list = document.getElementById('cart-items');
    const summary = document.getElementById('cart-summary');
    if (!list || !summary) return;

    if (this.cart.length === 0) {
      list.innerHTML = '<div style="text-align:center;margin-top:2rem;color:#888"><i class="fas fa-shopping-cart" style="font-size:3rem;margin-bottom:1rem;opacity:0.2"></i><p>Votre panier est vide</p></div>';
      summary.innerHTML = '';
      return;
    }

    list.innerHTML = this.cart.map(item => `
      <div style="display:flex;gap:1rem;margin-bottom:1rem;background:#f9fafb;padding:0.75rem;border-radius:12px;align-items:center">
        <div style="flex:1">
          <div style="font-weight:600;font-size:0.95rem;color:var(--vert)">${_escBiz(item.nom)}</div>
          <div style="font-size:0.85rem;color:var(--or);font-weight:700">${item.prix.toLocaleString()} F / unité</div>
          <div style="display:flex;align-items:center;gap:0.75rem;margin-top:0.5rem">
            <button onclick="Boutique.updateQty('${item.id}', -1)" style="width:24px;height:24px;border-radius:50%;border:1px solid #ddd;background:#fff;cursor:pointer">-</button>
            <span style="font-weight:bold;min-width:20px;text-align:center">${item.qty}</span>
            <button onclick="Boutique.updateQty('${item.id}', 1)" style="width:24px;height:24px;border-radius:50%;border:1px solid #ddd;background:#fff;cursor:pointer">+</button>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800;font-size:1rem;color:var(--vert)">${(item.prix * item.qty).toLocaleString()} F</div>
          <button onclick="Boutique.removeFromCart('${item.id}')" style="background:none;border:none;color:#ff4d4d;font-size:.7rem;margin-top:.3rem;cursor:pointer">Supprimer</button>
        </div>
      </div>
    `).join('');

    const isMinMet = total >= this.settings.minOrder;
    const finalTotal = total + this.settings.deliveryFee;

    summary.innerHTML = `
      <div style="margin-bottom:0.5rem;display:flex;justify-content:space-between;font-size:0.9rem">
        <span>Sous-total</span>
        <span style="font-weight:600">${total.toLocaleString()} F</span>
      </div>
      <div style="margin-bottom:1rem;display:flex;justify-content:space-between;font-size:0.9rem">
        <span>Livraison (Lomé)</span>
        <span style="font-weight:600">${this.settings.deliveryFee.toLocaleString()} F</span>
      </div>
      <div style="margin-bottom:1.5rem;display:flex;justify-content:space-between;font-size:1.2rem;border-top:2px solid #eee;padding-top:0.75rem">
        <strong style="color:var(--vert)">TOTAL</strong>
        <strong style="color:var(--vert)">${finalTotal.toLocaleString()} FCFA</strong>
      </div>
      
      ${!isMinMet ? `
        <div style="background:#fff3cd;color:#856404;padding:0.75rem;border-radius:8px;font-size:0.8rem;margin-bottom:1rem;display:flex;gap:.5rem;border:1px solid #ffeeba">
          <i class="fas fa-exclamation-triangle"></i>
          <div>Minimum de commande : <strong>${this.settings.minOrder.toLocaleString()} F</strong>. Il vous manque <strong>${(this.settings.minOrder - total).toLocaleString()} F</strong>.</div>
        </div>
      ` : ''}

      <button id="checkout-btn" 
        ${!isMinMet ? 'disabled' : ''} 
        onclick="Boutique.startCheckout()"
        style="width:100%;padding:1rem;background:${isMinMet?'var(--vert)':'#ccc'};color:${isMinMet?'var(--or)':'#888'};border:none;border-radius:12px;font-weight:800;font-size:1.1rem;cursor:${isMinMet?'pointer':'not-allowed'};box-shadow:0 10px 20px rgba(0,0,0,0.1)">
        COMMANDER ${isMinMet ? '➔' : ''}
      </button>
    `;
  },

  async startCheckout() {
    const total = this.cart.reduce((sum, item) => sum + (item.prix * item.qty), 0);
    if (total < this.settings.minOrder) return;

    if (this.settings.paymentMode === 'cinetpay') {
      await this.initPaymentCinetPay(total + this.settings.deliveryFee);
    } else {
      this.finishOrderWhatsApp();
    }
  },

  async initPaymentCinetPay(amount) {
    try {
      const apiKey = await sb.settings.get('cinetpay_apikey');
      const siteId = await sb.settings.get('cinetpay_siteid');
      const mode = await sb.settings.get('cinetpay_mode') || 'TEST';

      if (!apiKey || !siteId) {
        toast('Configuration paiement incomplète, redirection WhatsApp...', 'warning');
        return this.finishOrderWhatsApp();
      }

      // Charger SDK si pas là
      if (typeof CinetPay === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://checkout.cinetpay.com/sdk/v1/sdk.cinetpay.js";
        document.head.appendChild(script);
        await new Promise(r => script.onload = r);
      }

      CinetPay.setConfig({
        apikey: apiKey,
        site_id: siteId,
        notify_url: window.location.href,
        mode: mode
      });

      CinetPay.getCheckout({
        transaction_id: 'MLK_SHOP_' + Math.floor(Math.random() * 10000000),
        amount: amount,
        currency: 'XOF',
        channels: 'ALL',
        description: 'Commande Boutique Miralocks',
        customer_name: "Client Miralocks",
        customer_surname: "Client",
      });

      CinetPay.waitResponse((data) => {
        if (data.status === 'ACCEPTED') {
          this.finishOrderWhatsApp(data.operator_id);
        } else {
          toast('Paiement non finalisé.', 'error');
        }
      });
      
    } catch (e) {
      console.error(e);
      this.finishOrderWhatsApp();
    }
  },

  finishOrderWhatsApp(transactionId = null) {
    const total = this.cart.reduce((sum, item) => sum + (item.prix * item.qty), 0);
    const delivery = this.settings.deliveryFee;
    const finalTotal = total + delivery;

    let itemsText = this.cart.map(i => `• ${i.qty}x ${i.nom} (${(i.prix * i.qty).toLocaleString()} F)`).join('%0A');
    
    let msg = `Bonjour Miralocks ! 👋%0A%0AJe souhaite commander sur la boutique :%0A%0A${itemsText}%0A%0A---%0A💰 Sous-total : ${total.toLocaleString()} F%0A🚚 Livraison : ${delivery.toLocaleString()} F%0A⭐ *TOTAL : ${finalTotal.toLocaleString()} FCFA*%0A---%0A`;
    
    if (transactionId) {
      msg += `%0A✅ *PAIEMENT EFFECTUÉ*%0ARéf transaction : ${transactionId}%0A`;
    } else {
      msg += `%0A⏳ Paiement prévu à la livraison (WhatsApp Direct)%0A`;
    }
    
    msg += `%0AMerci de me confirmer la livraison !`;

    const whatsappNum = "22897989001";
    window.open(`https://wa.me/${whatsappNum}?text=${msg}`, '_blank');
    
    // Clear cart and close
    this.cart = [];
    this.saveCartToStorage();
    this.updateCartUI();
    this.toggleSidebar(false);
  },

  showToastPro(msg) {
    if (window.toast || window.showToast) {
       (window.toast || window.showToast)(msg, 'success');
    } else {
       alert(msg);
    }
  }
};

// Helper injection
function _escBiz(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

document.addEventListener('DOMContentLoaded', () => {
  Boutique.init();
});
