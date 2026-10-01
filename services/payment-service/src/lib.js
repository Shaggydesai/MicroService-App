// Shared helpers used by every ShopVerse service.
// NOTE: this file is copied into each service so every image builds independently.
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const promClient = require('prom-client');

const SERVICE = process.env.SERVICE_NAME || 'service';

// ---- Prometheus metrics (scraped from /metrics by a ServiceMonitor) ----
const registry = new promClient.Registry();
registry.setDefaultLabels({ service: SERVICE });
promClient.collectDefaultMetrics({ register: registry });

const httpDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

new promClient.Gauge({
  name: 'mongodb_connection_up',
  help: '1 when the MongoDB connection is ready',
  registers: [registry],
  collect() {
    this.set(mongoose.connection.readyState === 1 ? 1 : 0);
  },
});

// Business metrics, e.g. metrics.counter('orders_placed_total', 'Orders placed', ['payment_method'])
const metrics = {
  counter: (name, help, labelNames = []) => new promClient.Counter({ name, help, labelNames, registers: [registry] }),
  histogram: (name, help, labelNames = [], buckets) =>
    new promClient.Histogram({ name, help, labelNames, buckets, registers: [registry] }),
};

// ---- Continuous profiling (Grafana Pyroscope), enabled when PYROSCOPE_SERVER_ADDRESS is set ----
function startProfiling() {
  const serverAddress = process.env.PYROSCOPE_SERVER_ADDRESS;
  if (!serverAddress) return;
  try {
    const Pyroscope = require('@pyroscope/nodejs');
    Pyroscope.init({
      serverAddress,
      appName: process.env.PYROSCOPE_APP_NAME || `shopverse.${SERVICE}`,
      tags: {
        service: SERVICE,
        namespace: process.env.POD_NAMESPACE || 'local',
        version: process.env.APP_VERSION || 'dev',
      },
    });
    Pyroscope.start();
    log('info', 'pyroscope profiling started', { serverAddress });
  } catch (err) {
    log('warn', 'pyroscope profiling unavailable', { error: err.message });
  }
}

function log(level, msg, extra = {}) {
  process.stdout.write(
    JSON.stringify({ ts: new Date().toISOString(), level, service: SERVICE, msg, ...extra }) + '\n'
  );
}

function requireEnv(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') throw new Error(`Missing required env var ${name}`);
  return value;
}

// Verifies the bearer JWT issued by user-service and attaches req.user.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, requireEnv('JWT_SECRET'));
    req.user = { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
    req.token = token;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  return next();
}

// Service-to-service calls carry a shared token; these routes are never exposed by the gateway.
function requireInternal(req, res, next) {
  if (req.headers['x-internal-token'] !== requireEnv('INTERNAL_TOKEN')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

// Wraps async route handlers so rejected promises reach the error handler.
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Route template label (e.g. /api/orders/:orderNumber) keeps metric cardinality low.
// Express clears req.baseUrl when an async handler forwards an error, so fall back to the mount prefix.
function routeLabel(req) {
  if (!req.route) return 'unmatched';
  const base = req.baseUrl || (req.originalUrl.match(/^\/(api|internal)\/[^/?]+/) || [''])[0];
  return req.route.path === '/' ? base || '/' : `${base}${req.route.path}`;
}

function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path === '/healthz' || req.path === '/readyz' || req.path === '/metrics') return;
    httpDuration.observe(
      { method: req.method, route: routeLabel(req), status_code: res.statusCode },
      (Date.now() - start) / 1000
    );
    log('info', 'request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
}

function errorHandler(err, req, res, _next) {
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: err.message });
  }
  const status = err.status || 500;
  if (status >= 500) log('error', err.message, { stack: err.stack });
  return res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
}

function healthRoutes(app) {
  app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
  app.get('/readyz', (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready' });
  });
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });
}

async function connectMongo() {
  const uri = requireEnv('MONGO_URI');
  mongoose.set('strictQuery', true);
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      log('info', 'connected to MongoDB');
      return;
    } catch (err) {
      const wait = Math.min(attempt * 2000, 15000);
      log('warn', `MongoDB connection failed, retrying in ${wait}ms`, { error: err.message });
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

function start(app, { port, onReady } = {}) {
  startProfiling();
  const listenPort = Number(port || process.env.PORT || 8080);
  const server = app.listen(listenPort, () => log('info', `listening on :${listenPort}`));
  connectMongo()
    .then(() => onReady && onReady())
    .catch((err) => log('error', 'startup failed', { error: err.message }));

  const shutdown = (signal) => {
    log('info', `received ${signal}, shutting down`);
    server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  return server;
}

// Small fetch wrapper for calling sibling services.
async function callService(url, { method = 'GET', body, headers = {}, timeoutMs = 5000 } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-internal-token': process.env.INTERNAL_TOKEN || '',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, data.error || data.failureReason || `Upstream ${url} returned ${res.status}`);
  return data;
}

module.exports = {
  log,
  requireEnv,
  authenticate,
  requireAdmin,
  requireInternal,
  ah,
  HttpError,
  requestLogger,
  errorHandler,
  healthRoutes,
  start,
  callService,
  metrics,
};
