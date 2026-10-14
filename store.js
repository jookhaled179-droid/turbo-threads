// store.js - shared storefront helpers, cart and checkout (orders are saved in Supabase)
(() => {
  const CART_KEY = 'turbo_cart';
  const SHIPPING_FEE = 90;
  const ORDERS_TABLE = 'orders';
  const GOVERNORATES = ['Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Sharqia', 'Dakahlia', 'Gharbia', 'Monufia', 'Beheira', 'Kafr El Sheikh', 'Damietta', 'Port Said', 'Ismailia', 'Suez', 'Faiyum', 'Beni Suef', 'Minya', 'Asyut', 'Sohag', 'Qena', 'Luxor', 'Aswan', 'Red Sea', 'New Valley', 'Matrouh', 'North Sinai', 'South Sinai'];

  const $ = selector => document.querySelector(selector);
  function element(tag, className = '', text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  const money = value => `${Number(value || 0).toLocaleString('en-US')} EGP`;
  function imageElement(src, alt, className = '') {
    const img = element('img', className); img.src = src || ''; img.alt = alt || 'TURBO THREADS product'; img.loading = 'lazy';
    img.addEventListener('error', () => { img.style.visibility = 'hidden'; }, { once: true });
    return img;
  }

  let client = null;
  function createSupabaseClient() {
    if (client) return client;
    const config = window.TURBO_CONFIG;
    if (!window.supabase || !config) throw new Error('Supabase library or store-config.js is missing.');
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    return client;
  }

  // ---------- Modals ----------
  function openModal(id) { const modal = document.getElementById(id); if (modal) modal.classList.add('active'); }
  function closeModal(id) { const modal = document.getElementById(id); if (modal) modal.classList.remove('active'); }

  // ---------- Cart ----------
  function loadCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY));
      return Array.isArray(saved) ? saved.filter(i => i && i.id !== undefined && Number(i.quantity) > 0) : [];
    } catch { return []; }
  }
  let cart = loadCart();
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {} renderCart(); }
  const cartSubtotal = () => cart.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);

  function addToCart(product, size = 'M') {
    if (!product) return;
    const existing = cart.find(i => String(i.id) === String(product.id) && i.size === size);
    if (existing) existing.quantity += 1;
    else cart.push({ id: product.id, name: product.name, price: Number(product.price), image_url: product.image_url || '', size, quantity: 1 });
    saveCart();
    openCart();
  }
  function changeQuantity(index, delta) {
    const item = cart[index]; if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) cart.splice(index, 1);
    saveCart();
  }

  function renderCart() {
    const count = $('#cart-count');
    if (count) count.textContent = String(cart.reduce((sum, i) => sum + Number(i.quantity), 0));
    const total = $('#cart-total-price');
    if (total) total.textContent = money(cartSubtotal());
    const container = $('#cart-items-container'); if (!container) return;
    container.replaceChildren();
    if (!cart.length) { container.append(element('p', 'empty-cart', 'Your bag is currently empty.')); return; }
    cart.forEach((item, index) => {
      const row = element('div', 'cart-item');
      const details = element('div', 'cart-item-details');
      details.append(element('h4', '', item.name), element('span', '', `Size ${item.size} · ${money(item.price)}`));
      const controls = element('div', 'cart-item-controls');
      const minus = element('button', 'qty-btn', '−'); minus.type = 'button'; minus.setAttribute('aria-label', `Decrease ${item.name}`);
      minus.addEventListener('click', () => changeQuantity(index, -1));
      const plus = element('button', 'qty-btn', '+'); plus.type = 'button'; plus.setAttribute('aria-label', `Increase ${item.name}`);
      plus.addEventListener('click', () => changeQuantity(index, 1));
      const remove = element('button', 'remove-item', 'Remove'); remove.type = 'button';
      remove.addEventListener('click', () => { cart.splice(index, 1); saveCart(); });
      controls.append(minus, element('span', 'cart-qty', String(item.quantity)), plus, remove);
      details.append(controls);
      row.append(details);
      container.append(row);
    });
  }
  function openCart() { const modal = $('#cart-modal'); if (modal) modal.classList.add('active'); }
  function closeCart() { const modal = $('#cart-modal'); if (modal) modal.classList.remove('active'); }

  // ---------- Checkout ----------
  function fillGovernorates() {
    const select = $('#checkout-governorate'); if (!select || select.options.length > 1) return;
    GOVERNORATES.forEach(name => { const option = element('option', '', name); option.value = name; select.append(option); });
  }
  function renderCheckoutSummary() {
    const items = $('#checkout-summary-items'); if (!items) return;
    items.replaceChildren();
    cart.forEach(i => {
      const row = element('div', 'checkout-total-line checkout-summary-row');
      row.append(element('span', '', `${i.name} · ${i.size} × ${i.quantity}`), element('strong', '', money(i.price * i.quantity)));
      items.append(row);
    });
    $('#checkout-subtotal').textContent = money(cartSubtotal());
    $('#checkout-grand-total').textContent = money(cartSubtotal() + SHIPPING_FEE);
  }
  function checkout() {
    if (!cart.length) { alert('Your bag is empty. Add a product first.'); return; }
    fillGovernorates();
    renderCheckoutSummary();
    closeCart();
    openModal('checkout-modal');
  }

  const normalizePhone = value => value.replace(/[\s-]/g, '').replace(/^\+?20(?=1)/, '0');
  const isValidEgyptianPhone = phone => /^01[0125]\d{8}$/.test(phone);

  // Re-read prices from the products table so a tampered localStorage cart can't change what is charged.
  async function pricedItems(supabase) {
    const ids = [...new Set(cart.map(i => i.id))];
    const { data, error } = await supabase.from(window.TURBO_CONFIG.tableName).select('id,name,price').in('id', ids);
    if (error) throw error;
    const byId = new Map((data || []).map(p => [String(p.id), p]));
    return cart.map(i => {
      const product = byId.get(String(i.id));
      if (!product) throw new Error(`"${i.name}" is no longer available. Remove it from your bag and try again.`);
      return { id: product.id, name: product.name, price: Number(product.price), size: String(i.size), quantity: Math.max(1, Math.floor(Number(i.quantity))) };
    });
  }

  let submitting = false;
  async function submitOrder(channel = 'website') {
    if (submitting) return;
    const form = $('#checkout-form');
    if (!cart.length) { alert('Your bag is empty.'); return; }
    if (form && !form.reportValidity()) return;
    const phoneInput = $('#checkout-phone');
    const phone = normalizePhone(phoneInput.value);
    if (!isValidEgyptianPhone(phone)) { alert('Enter a valid Egyptian mobile number, e.g. 01012345678.'); phoneInput.focus(); return; }

    const customer = {
      full_name: $('#checkout-name').value.trim(),
      phone,
      governorate: $('#checkout-governorate').value,
      address: $('#checkout-address').value.trim()
    };

    // Open WhatsApp tab now, inside the click, otherwise the browser blocks the popup after the await.
    const whatsappTab = channel === 'whatsapp' ? window.open('', '_blank') : null;
    const buttons = document.querySelectorAll('.checkout-actions button');
    submitting = true; buttons.forEach(b => { b.disabled = true; });
    try {
      const supabase = createSupabaseClient();
      const items = await pricedItems(supabase);
      const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const orderId = crypto.randomUUID();
      const order = { id: orderId, ...customer, items, subtotal, shipping: SHIPPING_FEE, total: subtotal + SHIPPING_FEE, channel, status: 'new' };
      const { error } = await supabase.from(ORDERS_TABLE).insert([order]);
      if (error) throw error;

      cart = []; saveCart();
      form?.reset();
      closeModal('checkout-modal');

      const ref = orderId.slice(0, 8).toUpperCase();
      if (whatsappTab) {
        const lines = items.map(i => `- ${i.name} (${i.size}) × ${i.quantity} = ${money(i.price * i.quantity)}`);
        const message = `Hello TURBO THREADS, I want to confirm order #${ref}\n\n${lines.join('\n')}\n\nSubtotal: ${money(subtotal)}\nShipping: ${money(SHIPPING_FEE)}\nTotal: ${money(order.total)}\n\nName: ${customer.full_name}\nPhone: ${customer.phone}\nGovernorate: ${customer.governorate}\nAddress: ${customer.address}`;
        whatsappTab.location.href = `https://wa.me/${window.TURBO_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
      } else {
        alert(`Your order #${ref} was placed successfully. We will contact you on ${customer.phone} to confirm.`);
      }
    } catch (err) {
      whatsappTab?.close();
      console.error('Could not place order:', err);
      alert(err && err.message && !err.code ? err.message : 'Could not save your order. Please try again or contact us on WhatsApp.');
    } finally {
      submitting = false; buttons.forEach(b => { b.disabled = false; });
    }
  }

  // ---------- Globals used by inline handlers and page scripts ----------
  window.TurboStore = { $, element, money, imageElement, createSupabaseClient, addToCart, openModal, closeModal };
  window.checkout = checkout;
  window.submitOrder = submitOrder;
  window.closeQuickView = () => closeModal('quick-view-modal');
  window.closeSizeGuide = () => closeModal('size-guide-modal');

  document.addEventListener('DOMContentLoaded', () => {
    renderCart();
    $('#cart-btn')?.addEventListener('click', openCart);
    $('#close-cart')?.addEventListener('click', closeCart);
    $('#close-checkout')?.addEventListener('click', () => closeModal('checkout-modal'));
    document.querySelectorAll('.modal-overlay').forEach(overlay => overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); closeCart(); } });
  });
  window.addEventListener('storage', e => { if (e.key === CART_KEY) { cart = loadCart(); renderCart(); } });
})();
