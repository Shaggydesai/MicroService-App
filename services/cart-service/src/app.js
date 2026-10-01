const express = require('express');
const mongoose = require('mongoose');
const {
  ah, HttpError, authenticate, requireInternal, requireEnv, requestLogger, errorHandler, healthRoutes, callService,
} = require('./lib');

const cartSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    items: [
      {
        _id: false,
        productId: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1, max: 10 },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);
const Cart = mongoose.model('Cart', cartSchema);

const productUrl = () => requireEnv('PRODUCT_SERVICE_URL', 'http://product-service:8080');

// Joins cart lines with live product data so prices/stock are always current.
async function hydrate(cart) {
  const items = cart?.items || [];
  if (items.length === 0) return { items: [], summary: { count: 0, mrp: 0, discount: 0, total: 0 } };
  const products = await callService(`${productUrl()}/internal/products/lookup`, {
    method: 'POST',
    body: { ids: items.map((i) => i.productId) },
  });
  const byId = new Map(products.map((p) => [String(p.id), p]));
  const lines = items
    .filter((i) => byId.has(i.productId))
    .map((i) => {
      const p = byId.get(i.productId);
      return {
        productId: i.productId,
        quantity: i.quantity,
        name: p.name,
        brand: p.brand,
        image: p.images?.[0],
        price: p.price,
        mrp: p.mrp,
        stock: p.stock,
        inStock: p.stock >= i.quantity,
      };
    });
  const mrp = lines.reduce((s, l) => s + l.mrp * l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  return {
    items: lines,
    summary: { count: lines.reduce((s, l) => s + l.quantity, 0), mrp, discount: mrp - total, total },
  };
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(requestLogger);
healthRoutes(app);

const r = express.Router();
r.use(authenticate);

r.get('/', ah(async (req, res) => {
  res.json(await hydrate(await Cart.findOne({ userId: req.user.id })));
}));

r.post('/items', ah(async (req, res) => {
  const { productId } = req.body || {};
  const quantity = Number(req.body?.quantity || 1);
  if (!mongoose.isValidObjectId(productId)) throw new HttpError(400, 'Invalid productId');
  if (!Number.isInteger(quantity) || quantity < 1) throw new HttpError(400, 'Invalid quantity');
  const [product] = await callService(`${productUrl()}/internal/products/lookup`, {
    method: 'POST',
    body: { ids: [productId] },
  });
  if (!product) throw new HttpError(404, 'Product not found');

  const cart = (await Cart.findOne({ userId: req.user.id })) || new Cart({ userId: req.user.id, items: [] });
  const line = cart.items.find((i) => i.productId === productId);
  const newQty = Math.min(10, (line?.quantity || 0) + quantity);
  if (newQty > product.stock) throw new HttpError(409, `Only ${product.stock} in stock`);
  if (line) line.quantity = newQty;
  else cart.items.push({ productId, quantity: newQty });
  await cart.save();
  res.status(201).json(await hydrate(cart));
}));

r.patch('/items/:productId', ah(async (req, res) => {
  const quantity = Number(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new HttpError(400, 'Quantity must be 1-10');
  const cart = await Cart.findOne({ userId: req.user.id });
  const line = cart?.items.find((i) => i.productId === req.params.productId);
  if (!line) throw new HttpError(404, 'Item not in cart');
  line.quantity = quantity;
  await cart.save();
  res.json(await hydrate(cart));
}));

r.delete('/items/:productId', ah(async (req, res) => {
  const cart = await Cart.findOneAndUpdate(
    { userId: req.user.id },
    { $pull: { items: { productId: req.params.productId } } },
    { new: true }
  );
  res.json(await hydrate(cart));
}));

r.delete('/', ah(async (req, res) => {
  await Cart.updateOne({ userId: req.user.id }, { $set: { items: [] } });
  res.json(await hydrate(null));
}));

app.use('/api/cart', r);

// ---- Internal API ----
const internal = express.Router();
internal.use(requireInternal);
internal.get('/:userId', ah(async (req, res) => {
  res.json(await hydrate(await Cart.findOne({ userId: req.params.userId })));
}));
internal.delete('/:userId', ah(async (req, res) => {
  await Cart.updateOne({ userId: req.params.userId }, { $set: { items: [] } });
  res.json({ cleared: true });
}));
app.use('/internal/cart', internal);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = { app };
