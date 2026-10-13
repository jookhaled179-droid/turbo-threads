// store.js - النسخة الكاملة والمعدلة لتسجيل الأوردرات مباشرة في Supabase

document.addEventListener('DOMContentLoaded', () => {
    // تحميل المنتجات أو إعداد الصفحة إذا وجد
    loadProducts();
    setupCartListeners();
});

// متغيرات عامة للسلة
let cart = JSON.parse(localStorage.getItem('turbo_cart')) || [];

// دالة جلب المنتجات وعرضها
async function loadProducts() {
    const productsContainer = document.getElementById('products-container');
    if (!productsContainer) return;

    try {
        const { data: products, error } = await supabase
            .from('products')
            .select('*');

        if (error) throw error;

        productsContainer.innerHTML = '';
        products.forEach(product => {
            productsContainer.innerHTML += `
                <div class="product-card">
                    <img src="${product.image_url || ''}" alt="${product.name}">
                    <h3>${product.name}</h3>
                    <p>${product.price} EGP</p>
                    <button onclick="addToCart('${product.id}')">Add to Cart</button>
                </div>
            `;
        });
    } catch (err) {
        console.error('Error loading products:', err);
    }
}

// إضافة منتج للسلة
function addToCart(productId) {
    console.log('Added product:', productId);
}

function setupCartListeners() {
    const confirmBtn = document.getElementById('confirmOrderBtn') || document.querySelector('.confirm-order-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', (e) => {
            e.preventDefault();
            submitOrder();
        });
    }
}

// دالة إرسال الأوردر بدون أخطاء
async function submitOrder() {
    try {
        const fullNameInput = document.getElementById('fullName') || document.querySelector('input[name="fullName"]');
        const phoneInput = document.getElementById('phone') || document.querySelector('input[name="phone"]');
        const governorateInput = document.getElementById('governorate') || document.querySelector('select[name="governorate"]');
        const addressInput = document.getElementById('address') || document.querySelector('textarea[name="address"]');

        const fullName = fullNameInput ? fullNameInput.value.trim() : '';
        const phone = phoneInput ? phoneInput.value.trim() : '';
        const governorate = governorateInput ? governorateInput.value : '';
        const address = addressInput ? addressInput.value.trim() : '';

        if (!fullName || !phone || !governorate || !address) {
            alert('من فضلك املأ جميع بيانات الشحن المطلوبة!');
            return;
        }

        const cartItems = JSON.parse(localStorage.getItem('turbo_cart')) || [];
        
        const orderData = {
            full_name: fullName,
            phone: phone,
            governorate: governorate,
            address: address,
            items: cartItems,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('orders')
            .insert([orderData]);

        if (error) {
            console.error('Supabase Insert Error:', error);
            alert('حدث خطأ أثناء حفظ الطلب في قاعدة البيانات، حاول مرة أخرى.');
            return;
        }

        alert('تم تسجيل طلبك بنجاح! سيتم تحويلك الآن لتأكيد الطلب عبر الواتساب.');

        localStorage.removeItem('turbo_cart');

        const whatsappNumber = "01153156077";
        const message = `مرحباً، أريد تأكيد طلبي الجديد من متجر Turbo Threads:\n\nالاسم: ${fullName}\nالهاتف: ${phone}\nالمحافظة: ${governorate}\nالعنوان: ${address}`;
        const encodedMessage = encodeURIComponent(message);
        
        window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
        
        window.location.href = 'home.html';

    } catch (err) {
        console.error('Unexpected error in submitOrder:', err);
        alert('حدث خطأ غير متوقع أثناء إرسال الطلب.');
    }
}
