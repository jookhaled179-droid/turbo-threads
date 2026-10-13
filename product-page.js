(() => {
  const { $, element, money, createSupabaseClient, addToCart, imageElement, openModal } = window.TurboStore;
  let currentProduct = null;
  let selectedSize = 'M';
  function parseSizes(value) {
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === 'string' && value.trim()) return value.replace(/[\[\]"]/g, '').split(',').map(s => s.trim()).filter(Boolean);
    return ['M', 'L', 'XL', '2XL'];
  }
  function renderProduct(product) {
    const container = $('#product-details-content'); if (!container) return;
    container.replaceChildren();
    const wrapper = element('div', 'product-details-wrapper');
    const imageBox = element('div', 'details-img-box'); imageBox.append(imageElement(product.image_url, product.name));
    const info = element('div', 'details-info-box');
    info.append(element('span', 'details-badge', '100% PREMIUM QUALITY'), element('h1', '', product.name), element('p', 'details-price', money(product.price)), element('p', 'details-desc', product.description || 'Premium heavyweight cotton apparel designed for car enthusiasts and street culture.'));
    const sizeBox = element('div', 'sizes-selection-box');
    const labelRow = element('div', 'product-size-label-row'); labelRow.append(element('strong', '', 'SELECT SIZE'));
    const guide = element('button', 'size-guide-link', 'View Size Guide'); guide.type = 'button'; guide.addEventListener('click', () => openModal('size-guide-modal')); labelRow.append(guide);
    const sizeButtons = element('div', 'sizes-buttons-grid');
    parseSizes(product.sizes).forEach((size, index) => {
      const button = element('button', `size-btn${index === 0 ? ' active' : ''}`, size); button.type = 'button';
      if (index === 0) selectedSize = size;
      button.addEventListener('click', () => { selectedSize = size; sizeButtons.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === button)); });
      sizeButtons.append(button);
    });
    sizeBox.append(labelRow, sizeButtons);
    const add = element('button', 'btn-add-bag', 'ADD TO BAG'); add.type = 'button'; add.addEventListener('click', () => addToCart(currentProduct, selectedSize));
    const back = element('a', 'quick-details-link', '← Back to collection'); back.href = 'index.html';
    info.append(sizeBox, add, back); wrapper.append(imageBox, info); container.append(wrapper);
  }
  async function loadProductDetails() {
    const container = $('#product-details-content'); if (!container) return;
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) { container.replaceChildren(element('p', 'loading-text', 'No product was selected. Return to the collection and choose a product.')); return; }
    try {
      const client = createSupabaseClient();
      const { data, error } = await client.from(window.TURBO_CONFIG.tableName).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) { container.replaceChildren(element('p', 'loading-text', 'Product not found. It may have been removed from the collection.')); return; }
      if (!Number.isFinite(Number(data.price))) throw new Error('Product has an invalid price.');
      currentProduct = data; renderProduct(data);
    } catch (error) {
      console.error('Could not load product:', error);
      container.replaceChildren(element('p', 'loading-text', 'Could not load this product. Check Supabase settings and table permissions.'));
    }
  }
  document.addEventListener('DOMContentLoaded', loadProductDetails);
})();
