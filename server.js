const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// Lightweight .env loader so the project works without an extra runtime dependency.
function loadEnvFile(file) {
  try {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index < 1) continue;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {}
}
loadEnvFile(path.join(__dirname, '.env'));

const app = express();
const PORT = process.env.PORT || 3000;
const htmlDirectory = path.join(__dirname, 'html');
const ordersFile = path.resolve(process.env.ORDER_DB_PATH || path.join(__dirname, 'data', 'orders.json'));
const adminPassword = String(process.env.ADMIN_PASSWORD || 'change-this-password');
const sessions = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(express.static(htmlDirectory, { extensions: ['html'] }));

function ensureOrdersFile() {
  fs.mkdirSync(path.dirname(ordersFile), { recursive: true });
  if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, '[]', 'utf8');
}
function readOrders() {
  ensureOrdersFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeOrders(orders) {
  ensureOrdersFile();
  const temp = `${ordersFile}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(orders, null, 2), 'utf8');
  fs.renameSync(temp, ordersFile);
}
function cleanText(value, max = 160) {
  return String(value ?? '').trim().replace(/[<>]/g, '').slice(0, max);
}
function validPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}
function auth(req, res, next) {
  const token = req.cookies?.turbo_admin;
  const session = token && sessions.get(token);
  if (!session || session.expires < Date.now()) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Tiny cookie parser; avoids another dependency.
app.use((req, _res, next) => {
  req.cookies = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach(part => {
    const [key, ...rest] = part.trim().split('=');
    if (key) req.cookies[key] = decodeURIComponent(rest.join('='));
  });
  next();
});

app.post('/api/orders', (req, res) => {
  const body = req.body || {};
  const name = cleanText(body.name, 100);
  const phone = cleanText(body.phone, 30);
  const governorate = cleanText(body.governorate, 80);
  const address = cleanText(body.address, 500);
  const items = Array.isArray(body.items) ? body.items : [];

  if (!name || name.length < 2) return res.status(400).json({ error: 'Please enter a valid name.' });
  if (!validPhone(phone)) return res.status(400).json({ error: 'Please enter a valid phone number.' });
  if (!governorate) return res.status(400).json({ error: 'Please choose your governorate.' });
  if (!address || address.length < 8) return res.status(400).json({ error: 'Please enter your detailed address.' });
  if (!items.length || items.length > 100) return res.status(400).json({ error: 'Your cart is empty.' });

  const safeItems = items.map(item => ({
    id: cleanText(item.id, 120),
    name: cleanText(item.name, 160),
    size: cleanText(item.size, 20),
    quantity: Math.max(1, Math.min(99, Number.parseInt(item.quantity, 10) || 1)),
    price: Math.max(0, Number(item.price) || 0)
  })).filter(item => item.name);

  if (!safeItems.length) return res.status(400).json({ error: 'Your cart is empty.' });
  const subtotal = safeItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = 90;
  const total = subtotal + shipping;
  const orders = readOrders();
  const order = {
    id: `TT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: 'new',
    customer: { name, phone, governorate, address },
    items: safeItems,
    subtotal,
    shipping,
    total
  };
  orders.unshift(order);
  writeOrders(orders);
  res.status(201).json({ ok: true, orderId: order.id, total: order.total });
});

app.post('/api/admin/login', (req, res) => {
  const password = String(req.body?.password || '');
  const passwordBuffer = Buffer.from(password);
  const adminBuffer = Buffer.from(adminPassword);
  if (!password || passwordBuffer.length !== adminBuffer.length || !crypto.timingSafeEqual(passwordBuffer, adminBuffer)) {
    return res.status(401).json({ error: 'Wrong password.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expires: Date.now() + 1000 * 60 * 60 * 12 });
  res.setHeader('Set-Cookie', `turbo_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  res.json({ ok: true });
});

app.post('/api/admin/logout', auth, (req, res) => {
  sessions.delete(req.cookies.turbo_admin);
  res.setHeader('Set-Cookie', 'turbo_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'turbo-threads', time: new Date().toISOString() }));

app.get('/api/admin/orders', auth, (_req, res) => res.json({ orders: readOrders() }));

app.patch('/api/admin/orders/:id', auth, (req, res) => {
  const allowed = new Set(['new', 'confirmed', 'shipped', 'delivered', 'cancelled']);
  const status = cleanText(req.body?.status, 20).toLowerCase();
  if (!allowed.has(status)) return res.status(400).json({ error: 'Invalid status.' });
  const orders = readOrders();
  const order = orders.find(item => item.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  order.status = status;
  order.updatedAt = new Date().toISOString();
  writeOrders(orders);
  res.json({ ok: true, order });
});

app.get('/admin', (_req, res) => res.sendFile(path.join(htmlDirectory, 'admin.html')));
app.get('/admin.html', (_req, res) => res.sendFile(path.join(htmlDirectory, 'admin.html')));
app.use((req, res, next) => {
  if (req.method === 'GET' && !path.extname(req.path)) return res.sendFile(path.join(htmlDirectory, 'index.html'));
  next();
});

ensureOrdersFile();
if (require.main === module) {
  app.listen(PORT, () => console.log(`TURBO THREADS running at http://localhost:${PORT}`));
}
module.exports = app;
