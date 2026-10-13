/* Shared cart + safe DOM helpers for TURBO THREADS */
(() => {
  const STORAGE_KEY = 'turbo-threads-cart-v2';
  const config = window.TURBO_CONFIG || {};
  let cart = readCart();
  const $ = (selector, root = document) => root.querySelector(selector);

  function readCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(item => item && typeof item.name === 'string' && Number.isFinite(Number(item.price)) && Number(item.price) >= 0)
        .map(item => ({ id: String(item.id || item.name), name: item.name, price: Number(item.price), size: String(item.size || 'M'), quantity: Math.max(1, Math.min(99, Number.parseInt(item.quantity, 10) || 1)), image_url: String(item.image_url || '') }));
    } catch { return []; }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); }
    catch (error) { console.warn('Could not save cart:', error); }
  }
  function money(value) { return `${Number(value || 0).toLocaleString('en-US')} EGP`; }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function updateCart() {
    const container = $('#cart-items-container');
    const count = $('#cart-count');
    const totalLabel = $('#cart-total-price');
    const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (count) count.textContent = String(totalQty);
    if (totalLabel) totalLabel.textContent = money(total);
    if (!container) return;
    container.replaceChildren();
    if (!cart.length) {
      container.append(element('p', 'empty-cart', 'Your bag is currently empty.'));
      return;
    }
    cart.forEach((item, index) => {
      const row = element('div', 'cart-item');
      const details = element('div', 'cart-item-details');
      details.append(element('h4', '', item.name));
      details.append(element('span', '', `${money(item.price)} × ${item.quantity} · Size: ${item.size}`));
      const controls = element('div', 'cart-item-controls');
      const minus = element('button', 'qty-btn', '−');
      minus.type = 'button'; minus.setAttribute('aria-label', 'Decrease quantity');
      minus.addEventListener('click', () => changeQuantity(index, -1));
      const qty = element('span', 'cart-qty', String(item.quantity));
      const plus = element('button', 'qty-btn', '+');
      plus.type = 'button'; plus.setAttribute('aria-label', 'Increase quantity');
      plus.addEventListener('click', () => changeQuantity(index, 1));
      const remove = element('button', 'remove-item', 'Remove');
      remove.type = 'button'; remove.addEventListener('click', () => removeItem(index));
      controls.append(minus, qty, plus, remove);
      row.append(details, controls);
      container.append(row);
    });
  }
  function changeQuantity(index, delta) {
    const item = cart[index]; if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) cart.splice(index, 1);
    if (item.quantity > 99) item.quantity = 99;
    persist(); updateCart();
  }
  function removeItem(index) { cart.splice(index, 1); persist(); updateCart(); }
  function addToCart(product, size = 'M') {
    const price = Number(product.price);
    if (!product || !Number.isFinite(price) || price < 0) { alert('Product price is invalid. Please refresh the page.'); return; }
    const id = String(product.id ?? product.name ?? 'product');
    const name = String(product.name || 'Product');
    const existing = cart.find(item => item.id === id && item.size === size);
    if (existing) existing.quantity = Math.min(99, existing.quantity + 1);
    else cart.push({ id, name, price, size, quantity: 1, image_url: String(product.image_url || '') });
    persist(); updateCart(); openCart();
  }
  function openCart() { const modal = $('#cart-modal'); if (modal) modal.classList.add('active'); }
  function closeCart() { const modal = $('#cart-modal'); if (modal) modal.classList.remove('active'); }
  const SHIPPING_FEE = 90;
  const EGYPT_GOVERNORATES = [
    'Cairo','Giza','Alexandria','Qalyubia','Sharqia','Dakahlia','Gharbia','Monufia','Beheira','Kafr El Sheikh',
    'Damietta','Port Said','Ismailia','Suez','North Sinai','South Sinai','Fayoum','Beni Suef','Minya','Assiut',
    'Sohag','Qena','Luxor','Aswan','Red Sea','New Valley','Matrouh'
  ];
  function getSubtotal() { return cart.reduce((sum, item) => sum + item.price * item.quantity, 0); }
  function openCheckoutModal() {
    if (!cart.length) { alert('Your bag is currently empty!'); return; }
    const modal = $('#checkout-modal');
    const items = $('#checkout-summary-items');
    const subtotal = $('#checkout-subtotal');
    const total = $('#checkout-grand-total');
    if (!modal || !items) return;
    items.replaceChildren();
    cart.forEach(item => items.append(element('div', 'checkout-summary-row', `${item.name} · ${item.size} × ${item.quantity} — ${money(item.price * item.quantity)}`)));
    const sub = getSubtotal();
    if (subtotal) subtotal.textContent = money(sub);
    if (total) total.textContent = money(sub + SHIPPING_FEE);
    modal.classList.add('active');
  }
  function closeCheckoutModal() { $('#checkout-modal')?.classList.remove('active'); }
  function populateGovernorates() {
    const select = $('#checkout-governorate');
    if (!select || select.options.length > 1) return;
    EGYPT_GOVERNORATES.forEach(g => { const option = element('option', '', g); option.value = g; select.append(option); });
  }
  async function submitOrder(mode = 'website') {
    if (!cart.length) { alert('Your bag is currently empty!'); return; }
    const form = $('#checkout-form');
    const button = mode === 'whatsapp' ? $('#whatsapp-order-btn') : $('#place-order-btn');
    if (!form || !form.reportValidity()) return;
    const name = $('#checkout-name').value.trim();
    const phone = $('#checkout-phone').value.trim();
    const governorate = $('#checkout-governorate').value;
    const address = $('#checkout-address').value.trim();
    const payload = { name, phone, governorate, address, items: cart.map(item => ({ id: item.id, name: item.name, size: item.size, quantity: item.quantity, price: item.price })) };
    button.disabled = true;
    button.textContent = mode === 'whatsapp' ? 'Preparing WhatsApp…' : 'Sending order…';
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Could not place the order.');
      const subtotal = getSubtotal();
      const lines = cart.map(item => `- ${item.name} | Size: ${item.size} | Qty: ${item.quantity} | ${money(item.price * item.quantity)}`);
      const message = `Hello TURBO THREADS, I placed order ${result.orderId}.\n\nName: ${name}\nPhone: ${phone}\nGovernorate: ${governorate}\nAddress: ${address}\n\n${lines.join('\n')}\n\nSubtotal: ${money(subtotal)}\nShipping: ${money(SHIPPING_FEE)}\nGrand Total: ${money(subtotal + SHIPPING_FEE)}`;
      if (mode === 'whatsapp') {
        const wa = String(config.whatsappNumber || '').replace(/\D/g, '');
        if (!wa) throw new Error('WhatsApp number is not configured.');
        window.open(`https://wa.me/${wa}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
      }
      cart = []; persist(); updateCart(); closeCheckoutModal(); closeCart();
      alert(mode === 'whatsapp' ? `Order ${result.orderId} saved. WhatsApp will open now.` : `Order ${result.orderId} received successfully. We will contact you soon.`);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Could not place the order. Please try again.');
    } finally {
      button.disabled = false;
      button.textContent = mode === 'whatsapp' ? 'SAVE ORDER + CONTINUE TO WHATSAPP' : 'CONFIRM ORDER';
    }
  }
  function checkout() { populateGovernorates(); openCheckoutModal(); }
  function createSupabaseClient() {
    if (!window.supabase?.createClient) throw new Error('Supabase library did not load. Check your internet connection.');
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Missing Supabase config in store-config.js.');
    return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }
  function imageElement(url, alt, className = '') {
    const img = element('img', className); img.alt = alt || 'Product image'; img.loading = 'lazy';
    try { const parsed = new URL(String(url || ''), window.location.href); if (['https:', 'http:'].includes(parsed.protocol)) img.src = parsed.href; }
    catch { /* leave image blank if URL is invalid */ }
    img.addEventListener('error', () => { img.hidden = true; });
    return img;
  }
  function openModal(id) { const modal = document.getElementById(id); if (modal) modal.classList.add('active'); }
  function closeModal(id) { const modal = document.getElementById(id); if (modal) modal.classList.remove('active'); }
  window.TurboStore = { $, element, money, createSupabaseClient, addToCart, updateCart, openCart, closeCart, checkout, submitOrder, removeItem, openModal, closeModal, imageElement, getCart: () => cart.slice() };
  window.checkout = checkout;
  window.removeItem = removeItem;
  window.openSizeGuide = () => openModal('size-guide-modal');
  window.closeSizeGuide = () => closeModal('size-guide-modal');
  window.closeQuickView = () => closeModal('quick-view-modal');
  window.closeCheckout = closeCheckoutModal;
  window.submitOrder = submitOrder;
  document.addEventListener('DOMContentLoaded', () => {
    const open = $('#cart-btn'), close = $('#close-cart'), modal = $('#cart-modal'), checkoutModal = $('#checkout-modal'), checkoutClose = $('#close-checkout');
    open?.addEventListener('click', openCart);
    close?.addEventListener('click', closeCart);
    checkoutClose?.addEventListener('click', closeCheckoutModal);
    checkoutModal?.addEventListener('click', event => { if (event.target === checkoutModal) closeCheckoutModal(); });
    modal?.addEventListener('click', event => { if (event.target === modal) closeCart(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeCart(); closeCheckoutModal(); closeModal('quick-view-modal'); closeModal('size-guide-modal'); } });
    updateCart();
  });
})();
