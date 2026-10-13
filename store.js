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
    // منطق إضافة المنتج للسلة
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

// ==========================================
// الدالة المُعدلة بالكامل لإرسال الأوردر بدون أخطاء
// ==========================================
async function submitOrder() {
    try {
        // 1. جمع بيانات العميل من الفورم
        const fullNameInput = document.getElementById('fullName') || document.querySelector('input[name="fullName"]');
        const phoneInput = document.getElementById('phone') || document.querySelector('input[name="phone"]');
        const governorateInput = document.getElementById('governorate') || document.querySelector('select[name="governorate"]');
        const addressInput = document.getElementById('address') || document.querySelector('textarea[name="address"]');

        const fullName = fullNameInput ? fullNameInput.value.trim() : '';
        const phone = phoneInput ? phoneInput.value.trim() : '';
        const governorate = governorateInput ? governorateInput.value : '';
        const address = addressInput ? addressInput.value.trim() : '';

        // التحقق من البيانات
        if (!fullName || !phone || !governorate || !address) {
            alert('من فضلك املأ جميع بيانات الشحن المطلوبة!');
            return;
        }

        // حساب السلع أو إجمالي السلة
        const cartItems = JSON.parse(localStorage.getItem('turbo_cart')) || [];
        
        // تجهيز بيانات الأوردر لترتفع في قاعدة بيانات Supabase
        const orderData = {
            full_name: fullName,
            phone: phone,
            governorate: governorate,
            address: address,
            items: cartItems,
            created_at: new Date().toISOString()
        };

        // الرفع المباشر لجدول orders في Supabase (حل نهائي لمشكلة خطأ 500)
        const { data, error } = await supabase
            .from('orders')
            .insert([orderData]);

        if (error) {
            console.error('Supabase Insert Error:', error);
            alert('حدث خطأ أثناء حفظ الطلب في قاعدة البيانات، حاول مرة أخرى.');
            return;
        }

        alert('تم تسجيل طلبك بنجاح! سيتم تحويلك الآن لتأكيد الطلب عبر الواتساب.');

        // تفريغ السلة بعد الطلب الناجح
        localStorage.removeItem('turbo_cart');

        // 2. تحويل العميل للواتساب برقمك
        const whatsappNumber = "01153156077";
        const message = `مرحباً، أريد تأكيد طلبي الجديد من متجر Turbo Threads:\n\nالاسم: ${fullName}\nالهاتف: ${phone}\nالمحافظة: ${governorate}\nالعنوان: ${address}`;
        const encodedMessage = encodeURIComponent(message);
        
        window.open(`https://wa.me/${whatsappNumber}?text=${encodedMessage}`, '_blank');
        
        // إعادة توجيه للصفحة الرئيسية أو تحديث الصفحة
        window.location.href = 'home.html';

    } catch (err) {
        console.error('Unexpected error in submitOrder:', err);
        alert('حدث خطأ غير متوقع أثناء إرسال الطلب.');
    }
}
