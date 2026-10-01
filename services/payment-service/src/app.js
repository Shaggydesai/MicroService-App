const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const {
  ah, HttpError, authenticate, requireInternal, requestLogger, errorHandler, healthRoutes, metrics,
} = require('./lib');

const paymentsTotal = metrics.counter('shopverse_payments_total', 'Payment attempts', ['method', 'status']);
for (const method of ['COD', 'CARD', 'UPI', 'NETBANKING']) {
  for (const status of ['PENDING', 'SUCCESS', 'FAILED']) paymentsTotal.inc({ method, status }, 0);
}

// Mock payment processor. Swap `processPayment` for a real gateway (Razorpay, Stripe, ...) later.
const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, required: true, unique: true },
    orderNumber: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    method: { type: String, enum: ['COD', 'CARD', 'UPI', 'NETBANKING'], required: true },
    status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'], required: true },
    failureReason: String,
  },
  { timestamps: true }
);
paymentSchema.set('toJSON', { versionKey: false });
const Payment = mongoose.model('Payment', paymentSchema);

const DECLINED_CARD = '4000000000000002';
const MAX_ONLINE_AMOUNT = Number(process.env.MAX_ONLINE_AMOUNT || 500000);

function processPayment({ method, amount, details = {} }) {
  if (method === 'COD') return { status: 'PENDING' };
  if (method === 'CARD' && String(details.cardNumber || '').replace(/\s/g, '') === DECLINED_CARD) {
    return { status: 'FAILED', failureReason: 'Card declined by issuer' };
  }
  if (method === 'UPI' && details.upiId && !/^[\w.-]+@[\w]+$/.test(details.upiId)) {
    return { status: 'FAILED', failureReason: 'Invalid UPI ID' };
  }
  if (amount > MAX_ONLINE_AMOUNT) return { status: 'FAILED', failureReason: 'Amount exceeds online payment limit' };
  return { status: 'SUCCESS' };
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(requestLogger);
healthRoutes(app);

const r = express.Router();
r.get('/', authenticate, ah(async (req, res) => {
  res.json(await Payment.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100));
}));
app.use('/api/payments', r);

const internal = express.Router();
internal.use(requireInternal);

internal.post('/charge', ah(async (req, res) => {
  const { orderNumber, userId, amount, method, details } = req.body || {};
  if (!orderNumber || !userId || !(amount >= 0) || !method) throw new HttpError(400, 'Invalid payment request');
  const result = processPayment({ method, amount, details });
  const payment = await Payment.create({
    paymentId: `pay_${crypto.randomBytes(8).toString('hex')}`,
    orderNumber,
    userId,
    amount,
    method,
    ...result,
  });
  paymentsTotal.inc({ method, status: payment.status });
  res.status(payment.status === 'FAILED' ? 402 : 201).json(payment);
}));

internal.post('/:paymentId/refund', ah(async (req, res) => {
  const payment = await Payment.findOne({ paymentId: req.params.paymentId });
  if (!payment) throw new HttpError(404, 'Payment not found');
  payment.status = payment.status === 'SUCCESS' ? 'REFUNDED' : 'FAILED';
  if (payment.status === 'FAILED') payment.failureReason = 'Cancelled before capture';
  await payment.save();
  res.json(payment);
}));

internal.post('/:paymentId/capture', ah(async (req, res) => {
  const payment = await Payment.findOneAndUpdate(
    { paymentId: req.params.paymentId, status: 'PENDING' },
    { status: 'SUCCESS' },
    { new: true }
  );
  if (!payment) throw new HttpError(404, 'Pending payment not found');
  res.json(payment);
}));

app.use('/internal/payments', internal);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = { app, processPayment };
