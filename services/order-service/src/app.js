const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const {
  ah, HttpError, authenticate, requireAdmin, requireEnv, requestLogger, errorHandler, healthRoutes, callService, log, metrics,
} = require('./lib');

const ordersPlaced = metrics.counter('shopverse_orders_placed_total', 'Orders placed', ['payment_method']);
const orderValue = metrics.histogram('shopverse_order_value_inr', 'Order value in INR', ['payment_method'],
  [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000]);
const revenue = metrics.counter('shopverse_revenue_inr_total', 'Gross order value in INR', ['payment_method']);
const checkoutFailures = metrics.counter('shopverse_checkout_failures_total', 'Failed checkouts', ['reason']);
const ordersCancelled = metrics.counter('shopverse_orders_cancelled_total', 'Orders cancelled by customers');
// Export every known series at 0 so increase()/rate() also count the very first event
for (const m of ['UPI', 'CARD', 'NETBANKING', 'COD']) {
  ordersPlaced.inc({ payment_method: m }, 0);
  revenue.inc({ payment_method: m }, 0);
}
for (const reason of ['stock', 'payment_declined', 'payment_error']) checkoutFailures.inc({ reason }, 0);

const STATUSES = ['CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
const CANCELLABLE = ['CONFIRMED', 'PACKED'];

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    items: [
      {
        _id: false,
        productId: String,
        name: String,
        image: String,
        price: Number,
        quantity: Number,
      },
    ],
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
    },
    amounts: { subtotal: Number, deliveryFee: Number, total: Number },
    payment: { paymentId: String, method: String, status: String },
    status: { type: String, enum: STATUSES, default: 'CONFIRMED' },
    history: [{ _id: false, status: String, at: { type: Date, default: Date.now } }],
  },
  { timestamps: true }
);
orderSchema.set('toJSON', { versionKey: false });
const Order = mongoose.model('Order', orderSchema);

const url = (name, fallback) => requireEnv(name, fallback);
const PRODUCT = () => url('PRODUCT_SERVICE_URL', 'http://product-service:8080');
const CART = () => url('CART_SERVICE_URL', 'http://cart-service:8080');
const PAYMENT = () => url('PAYMENT_SERVICE_URL', 'http://payment-service:8080');
const FREE_DELIVERY_ABOVE = Number(process.env.FREE_DELIVERY_ABOVE || 500);
const DELIVERY_FEE = Number(process.env.DELIVERY_FEE || 40);

const newOrderNumber = () =>
  `SV${Date.now().toString().slice(-8)}${crypto.randomInt(1000, 9999)}`;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(requestLogger);
healthRoutes(app);

const r = express.Router();
r.use(authenticate);

// Checkout saga: read cart -> reserve stock -> charge payment -> persist order -> clear cart.
// Each step compensates the previous ones on failure.
r.post('/', ah(async (req, res) => {
  const { shippingAddress, paymentMethod = 'COD', paymentDetails } = req.body || {};
  const required = ['fullName', 'phone', 'line1', 'city', 'state', 'pincode'];
  if (!shippingAddress || required.some((k) => !shippingAddress[k])) {
    throw new HttpError(400, `shippingAddress requires ${required.join(', ')}`);
  }

  const cart = await callService(`${CART()}/internal/cart/${req.user.id}`);
  if (!cart.items?.length) throw new HttpError(400, 'Your cart is empty');

  const lines = cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
  const reserved = await callService(`${PRODUCT()}/internal/products/reserve`, {
    method: 'POST',
    body: { items: lines },
  }).catch((err) => {
    checkoutFailures.inc({ reason: 'stock' });
    throw err;
  });

  const release = () =>
    callService(`${PRODUCT()}/internal/products/release`, { method: 'POST', body: { items: lines } })
      .catch((err) => log('error', 'stock release failed', { error: err.message }));

  const subtotal = reserved.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryFee = subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;
  const orderNumber = newOrderNumber();

  let payment;
  try {
    payment = await callService(`${PAYMENT()}/internal/payments/charge`, {
      method: 'POST',
      body: {
        orderNumber,
        userId: req.user.id,
        amount: subtotal + deliveryFee,
        method: paymentMethod,
        details: paymentDetails,
      },
    });
  } catch (err) {
    await release();
    checkoutFailures.inc({ reason: err.status === 402 ? 'payment_declined' : 'payment_error' });
    throw new HttpError(err.status === 402 ? 402 : 502, `Payment failed: ${err.message}`);
  }

  let order;
  try {
    order = await Order.create({
      orderNumber,
      userId: req.user.id,
      items: reserved.items,
      shippingAddress,
      amounts: { subtotal, deliveryFee, total: subtotal + deliveryFee },
      payment: { paymentId: payment.paymentId, method: payment.method, status: payment.status },
      history: [{ status: 'CONFIRMED' }],
    });
  } catch (err) {
    await release();
    await callService(`${PAYMENT()}/internal/payments/${payment.paymentId}/refund`, { method: 'POST' }).catch(() => {});
    throw err;
  }

  await callService(`${CART()}/internal/cart/${req.user.id}`, { method: 'DELETE' })
    .catch((err) => log('warn', 'cart clear failed', { error: err.message }));

  ordersPlaced.inc({ payment_method: paymentMethod });
  orderValue.observe({ payment_method: paymentMethod }, order.amounts.total);
  revenue.inc({ payment_method: paymentMethod }, order.amounts.total);
  log('info', 'order placed', { orderNumber, total: order.amounts.total });
  res.status(201).json(order);
}));

r.get('/', ah(async (req, res) => {
  res.json(await Order.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100));
}));

r.get('/admin/all', requireAdmin, ah(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(200));
}));

r.get('/:orderNumber', ah(async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber });
  if (!order || (order.userId !== req.user.id && req.user.role !== 'admin')) {
    throw new HttpError(404, 'Order not found');
  }
  res.json(order);
}));

r.post('/:orderNumber/cancel', ah(async (req, res) => {
  const order = await Order.findOne({ orderNumber: req.params.orderNumber, userId: req.user.id });
  if (!order) throw new HttpError(404, 'Order not found');
  if (!CANCELLABLE.includes(order.status)) throw new HttpError(409, `Order cannot be cancelled once ${order.status}`);

  await callService(`${PRODUCT()}/internal/products/release`, {
    method: 'POST',
    body: { items: order.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
  });
  const payment = await callService(`${PAYMENT()}/internal/payments/${order.payment.paymentId}/refund`, {
    method: 'POST',
  }).catch(() => null);

  order.status = 'CANCELLED';
  ordersCancelled.inc();
  if (payment) order.payment.status = payment.status;
  order.history.push({ status: 'CANCELLED' });
  await order.save();
  res.json(order);
}));

r.patch('/:orderNumber/status', requireAdmin, ah(async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status) || status === 'CANCELLED') throw new HttpError(400, 'Invalid status');
  const order = await Order.findOne({ orderNumber: req.params.orderNumber });
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.status === 'CANCELLED' || order.status === 'DELIVERED') {
    throw new HttpError(409, `Order is already ${order.status}`);
  }
  if (status === 'DELIVERED' && order.payment.status === 'PENDING') {
    const payment = await callService(`${PAYMENT()}/internal/payments/${order.payment.paymentId}/capture`, {
      method: 'POST',
    });
    order.payment.status = payment.status;
  }
  order.status = status;
  order.history.push({ status });
  await order.save();
  res.json(order);
}));

app.use('/api/orders', r);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = { app };
