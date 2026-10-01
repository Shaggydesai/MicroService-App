const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const {
  ah, HttpError, authenticate, requireAdmin, requireEnv, requestLogger, errorHandler, healthRoutes, log, metrics,
} = require('./lib');

const registrations = metrics.counter('shopverse_users_registered_total', 'User registrations');
const logins = metrics.counter('shopverse_user_logins_total', 'Login attempts', ['result']);
logins.inc({ result: 'success' }, 0);
logins.inc({ result: 'failure' }, 0);

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Home' },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    phone: String,
    addresses: [addressSchema],
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    phone: this.phone,
    addresses: this.addresses,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model('User', userSchema);

function issueToken(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, name: user.name, role: user.role },
    requireEnv('JWT_SECRET'),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(requestLogger);
healthRoutes(app);

const r = express.Router();

r.post('/register', ah(async (req, res) => {
  const { name, email, password, phone } = req.body || {};
  if (!name || !email || !password) throw new HttpError(400, 'name, email and password are required');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Invalid email address');
  if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (await User.exists({ email: email.toLowerCase() })) throw new HttpError(409, 'Email already registered');
  const user = await User.create({ name, email, phone, passwordHash: await bcrypt.hash(password, 10) });
  registrations.inc();
  res.status(201).json({ token: issueToken(user), user: user.toPublic() });
}));

r.post('/login', ah(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new HttpError(400, 'email and password are required');
  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    logins.inc({ result: 'failure' });
    throw new HttpError(401, 'Invalid email or password');
  }
  logins.inc({ result: 'success' });
  res.json({ token: issueToken(user), user: user.toPublic() });
}));

r.get('/me', authenticate, ah(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(404, 'User not found');
  res.json(user.toPublic());
}));

r.put('/me', authenticate, ah(async (req, res) => {
  const { name, phone } = req.body || {};
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(404, 'User not found');
  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  await user.save();
  res.json(user.toPublic());
}));

r.post('/me/addresses', authenticate, ah(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(404, 'User not found');
  const address = { ...req.body };
  if (address.isDefault || user.addresses.length === 0) {
    user.addresses.forEach((a) => { a.isDefault = false; });
    address.isDefault = true;
  }
  user.addresses.push(address);
  await user.save();
  res.status(201).json(user.toPublic());
}));

r.delete('/me/addresses/:addressId', authenticate, ah(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(404, 'User not found');
  user.addresses.pull({ _id: req.params.addressId });
  await user.save();
  res.json(user.toPublic());
}));

r.get('/', authenticate, requireAdmin, ah(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(200);
  res.json(users.map((u) => u.toPublic()));
}));

app.use('/api/users', r);
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

// Creates the bootstrap admin account from env vars (idempotent).
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (await User.exists({ email: email.toLowerCase() })) return;
  await User.create({
    name: 'Admin',
    email,
    role: 'admin',
    passwordHash: await bcrypt.hash(password, 10),
  });
  log('info', 'seeded admin user', { email });
}

module.exports = { app, seedAdmin };
