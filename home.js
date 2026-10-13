(() => {
  const { $, element, money, createSupabaseClient, addToCart, openModal, imageElement } = window.TurboStore;
  let products = [];
  let selectedModalSize = 'M';
  let searchTerm = '';
  let sortMode = 'featured';

  function addCatalogControls() {
    const grid = $('#products-grid'); if (!grid || $('#catalog-controls')) return;
    const controls = element('div', 'catalog-controls'); controls.id = 'catalog-controls';
    const search = element('input', 'catalog-search'); search.type = 'search'; search.placeholder = 'Search designs...'; search.setAttribute('aria-label', 'Search products');
    search.addEventListener('input', () => { searchTerm = search.value.trim().toLowerCase(); renderProducts(); });
    const sort = element('select', 'catalog-sort'); sort.setAttribute('aria-label', 'Sort products');
    [['featured','Featured'],['price-low','Price: low to high'],['price-high','Price: high to low'],['name','Name: A to Z']].forEach(([value,label]) => { const opt = element('option','',label); opt.value=value; sort.append(opt); });
    sort.addEventListener('change', () => { sortMode = sort.value; renderProducts(); });
    controls.append(search, sort); grid.parentElement.insertBefore(controls, grid);
  }
  function productCard(product) {
    const card = element('article', 'product-card');
    const badge = element('div', 'product-badge', '100% COTTON');
    const imageWrap = element('button', 'product-img product-image-button'); imageWrap.type = 'button'; imageWrap.setAttribute('aria-label', `View ${product.name}`);
    imageWrap.append(imageElement(product.image_url, product.name));
    imageWrap.addEventListener('click', () => { window.location.href = `product.html?id=${encodeURIComponent(product.id)}`; });
    const info = element('div', 'product-info');
    const title = element('h3', '', product.name); title.tabIndex = 0; title.addEventListener('click', () => { window.location.href = `product.html?id=${encodeURIComponent(product.id)}`; });
    title.addEventListener('keydown', e => { if (e.key === 'Enter') title.click(); });
    info.append(title, element('p', 'product-desc', product.description || 'Premium streetwear made for car culture.'));
    const sizeBox = element('div', 'size-box');
    const sizeHead = element('div', 'size-box-head');
    sizeHead.append(element('span', 'size-label', 'SIZE'));
    sizeHead.append(element('span', 'size-hint', 'Choose your fit'));
    const sizeSelect = element('select', 'product-size');
    sizeSelect.setAttribute('aria-label', `Choose size for ${product.name}`);
    const sizeRail = element('div', 'size-rail');
    const sizes = parseSizes(product.sizes);
    sizes.forEach((size, index) => {
      const option = element('option', '', size); option.value = size; sizeSelect.append(option);
      const chip = element('button', 'size-chip', size); chip.type = 'button';
      chip.setAttribute('aria-label', `Select size ${size}`);
      chip.addEventListener('click', () => {
        sizeSelect.value = size;
        sizeRail.querySelectorAll('.size-chip').forEach(btn => btn.classList.remove('active'));
        chip.classList.add('active');
      });
      if (index === 0) chip.classList.add('active');
      sizeRail.append(chip);
    });
    sizeSelect.value = sizes[0] || 'M';
    sizeSelect.hidden = true;
    sizeBox.append(sizeHead, sizeRail, sizeSelect);
    info.append(sizeBox);
    const footer = element('div', 'product-footer'); footer.append(element('span', 'price', money(product.price)));
    const quick = element('button', 'quick-view-btn', 'Quick view'); quick.type = 'button'; quick.addEventListener('click', () => openQuickView(product));
    const add = element('button', 'add-to-cart', 'Add to bag'); add.type = 'button'; add.addEventListener('click', () => addToCart(product, sizeSelect.value));
    footer.append(quick, add); info.append(footer); card.append(badge, imageWrap, info); return card;
  }
  function parseSizes(value) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === 'string' && value.trim()) return value.replace(/[\[\]"]/g, '').split(',').map(s => s.trim()).filter(Boolean);
    return ['M', 'L', 'XL', '2XL'];
  }
  function renderProducts() {
    const grid = $('#products-grid'); if (!grid) return;
    let filtered = products.filter(p => String(p.name || '').toLowerCase().includes(searchTerm));
    if (sortMode === 'price-low') filtered.sort((a,b) => Number(a.price)-Number(b.price));
    if (sortMode === 'price-high') filtered.sort((a,b) => Number(b.price)-Number(a.price));
    if (sortMode === 'name') filtered.sort((a,b) => String(a.name).localeCompare(String(b.name)));
    grid.replaceChildren();
    if (!filtered.length) { grid.append(element('p', 'loading-text', 'No products match your search.')); return; }
    filtered.forEach(p => grid.append(productCard(p)));
  }
  function openQuickView(product) {
    selectedModalSize = 'M';
    const body = $('#quick-view-body'); if (!body) return;
    body.replaceChildren();
    const img = imageElement(product.image_url, product.name, 'modal-img');
    const info = element('div', 'quick-view-info');
    info.append(element('span', 'details-badge', '100% PREMIUM COTTON'), element('h2', '', product.name), element('p', 'details-price', money(product.price)), element('p', 'details-desc', product.description || 'Premium heavyweight streetwear inspired by car culture.'));
    const sizeLabel = element('label', 'quick-size-label', 'SELECT SIZE');
    const sizes = element('div', 'sizes-buttons-grid');
    parseSizes(product.sizes).forEach((size, index) => {
      const btn = element('button', `size-btn${index === 0 ? ' active' : ''}`, size); btn.type = 'button';
      if (index === 0) selectedModalSize = size;
      btn.addEventListener('click', () => { selectedModalSize = size; sizes.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn)); });
      sizes.append(btn);
    });
    const add = element('button', 'btn-add-bag', 'ADD TO BAG'); add.type = 'button'; add.addEventListener('click', () => { addToCart(product, selectedModalSize); window.closeQuickView(); });
    const details = element('a', 'quick-details-link', 'View full details'); details.href = `product.html?id=${encodeURIComponent(product.id)}`;
    info.append(sizeLabel, sizes, add, details); body.append(img, info); openModal('quick-view-modal');
  }
  window.openQuickView = id => { const product = products.find(p => String(p.id) === String(id)); if (product) openQuickView(product); };
  window.slideProducts = direction => { const grid = $('#products-grid'); if (grid) grid.scrollBy({ left: direction === 'left' ? -320 : 320, behavior: 'smooth' }); };

  async function loadProducts() {
    const grid = $('#products-grid'); if (!grid) return;
    addCatalogControls(); grid.replaceChildren(element('p', 'loading-text', 'Loading the latest collection...'));
    try {
      const client = createSupabaseClient();
      const { data, error } = await client.from(window.TURBO_CONFIG.tableName).select('*');
      if (error) throw error;
      products = (data || []).filter(p => p && p.id !== undefined && p.name && Number.isFinite(Number(p.price)));
      if (!products.length) { grid.replaceChildren(element('p', 'loading-text', 'No products are available yet.')); return; }
      renderProducts();
    } catch (error) {
      console.error('Could not load products:', error);
      grid.replaceChildren(element('p', 'loading-text', 'Could not load products. Check Supabase settings, table permissions, and your internet connection.'));
    }
  }
  document.addEventListener('DOMContentLoaded', () => { loadProducts(); initCyanRPM(); });
  function initCyanRPM() {
    const needle = $('#cyan-needle'), rpm = $('#cyan-rpm-val');
    if (!needle || !rpm) return;
    const values = [6200, 6800, 7200, 6500, 7000]; let i = 0;
    const update = () => { const value = values[i++ % values.length]; rpm.textContent = String(value); needle.style.transform = `rotate(${-100 + (value / 8000) * 200}deg)`; };
    update();
  }
})();
