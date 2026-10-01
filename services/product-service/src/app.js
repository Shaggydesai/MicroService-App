const express = require('express');
const mongoose = require('mongoose');
const {
  ah, HttpError, authenticate, requireAdmin, requireInternal, requestLogger, errorHandler, healthRoutes,
} = require('./lib');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    brand: { type: String, default: '' },
    category: { type: String, required: true, index: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: [String],
    highlights: [String],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true }
);
productSchema.index({ name: 'text', brand: 'text', description: 'text', category: 'text' });
productSchema.virtual('discountPercent').get(function discount() {
  return this.mrp > 0 ? Math.round(((this.mrp - this.price) / this.mrp) * 100) : 0;
});
productSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

const Product = mongoose.model('Product', productSchema);

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORTS = {
  relevance: { isFeatured: -1, ratingCount: -1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  rating: { rating: -1 },
  newest: { createdAt: -1 },
};

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
healthRoutes(app);

const r = express.Router();

r.get('/', ah(async (req, res) => {
  const { q, category, brand, minPrice, maxPrice, featured, sort = 'relevance' } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(60, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = {};
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: re }, { brand: re }, { category: re }, { description: re }];
  }
  if (category) filter.category = category;
  if (brand) filter.brand = { $in: String(brand).split(',') };
  if (featured === 'true') filter.isFeatured = true;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  const [items, total] = await Promise.all([
    Product.find(filter).sort(SORTS[sort] || SORTS.relevance).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
}));

r.get('/categories', ah(async (req, res) => {
  const cats = await Product.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 }, image: { $first: { $arrayElemAt: ['$images', 0] } } } },
    { $sort: { _id: 1 } },
  ]);
  res.json(cats.map((c) => ({ name: c._id, count: c.count, image: c.image })));
}));

r.get('/brands', ah(async (req, res) => {
  const filter = req.query.category ? { category: req.query.category } : {};
  res.json((await Product.distinct('brand', filter)).filter(Boolean).sort());
}));

r.get('/:id', ah(async (req, res) => {
  const { id } = req.params;
  const product = mongoose.isValidObjectId(id)
    ? await Product.findById(id)
    : await Product.findOne({ slug: id });
  if (!product) throw new HttpError(404, 'Product not found');
  res.json(product);
}));

r.post('/', authenticate, requireAdmin, ah(async (req, res) => {
  const body = { ...req.body };
  body.slug = body.slug || `${slugify(body.name)}-${Date.now().toString(36)}`;
  res.status(201).json(await Product.create(body));
}));

r.put('/:id', authenticate, requireAdmin, ah(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!product) throw new HttpError(404, 'Product not found');
  res.json(product);
}));

r.delete('/:id', authenticate, requireAdmin, ah(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found');
  res.status(204).end();
}));

app.use('/api/products', r);

// ---- Internal API (service-to-service only, not routed by the gateway) ----
const internal = express.Router();
internal.use(requireInternal);

internal.post('/lookup', ah(async (req, res) => {
  const ids = (req.body?.ids || []).filter((id) => mongoose.isValidObjectId(id));
  res.json(await Product.find({ _id: { $in: ids } }));
}));

// Atomically decrement stock for every item; rolls back on the first failure.
internal.post('/reserve', ah(async (req, res) => {
  const items = req.body?.items || [];
  const reserved = [];
  try {
    for (const { productId, quantity } of items) {
      const qty = Number(quantity);
      if (!mongoose.isValidObjectId(productId) || !(qty > 0)) throw new HttpError(400, 'Invalid item');
      const updated = await Product.findOneAndUpdate(
        { _id: productId, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true }
      );
      if (!updated) {
        const p = await Product.findById(productId);
        throw new HttpError(409, p ? `Only ${p.stock} left of "${p.name}"` : `Product ${productId} not found`);
      }
      reserved.push({ productId, quantity: qty, product: updated });
    }
  } catch (err) {
    await Promise.all(reserved.map((i) => Product.updateOne({ _id: i.productId }, { $inc: { stock: i.quantity } })));
    throw err;
  }
  res.json({
    items: reserved.map(({ productId, quantity, product }) => ({
      productId,
      quantity,
      name: product.name,
      price: product.price,
      image: product.images[0],
    })),
  });
}));

internal.post('/release', ah(async (req, res) => {
  const items = req.body?.items || [];
  await Promise.all(
    items.map((i) => Product.updateOne({ _id: i.productId }, { $inc: { stock: Number(i.quantity) } }))
  );
  res.json({ released: items.length });
}));

app.use('/internal/products', internal);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = { app, Product, slugify };
