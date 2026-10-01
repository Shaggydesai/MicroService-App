const express = require('express');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const promClient = require('prom-client');

const SERVICE = 'api-gateway';
const PORT = Number(process.env.PORT || 8080);

const log = (level, msg, extra = {}) =>
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level, service: SERVICE, msg, ...extra }) + '\n');

// Continuous profiling (Grafana Pyroscope), enabled when PYROSCOPE_SERVER_ADDRESS is set.
if (process.env.PYROSCOPE_SERVER_ADDRESS) {
  try {
    const Pyroscope = require('@pyroscope/nodejs');
    Pyroscope.init({
      serverAddress: process.env.PYROSCOPE_SERVER_ADDRESS,
      appName: process.env.PYROSCOPE_APP_NAME || `shopverse.${SERVICE}`,
      tags: { service: SERVICE, namespace: process.env.POD_NAMESPACE || 'local', version: process.env.APP_VERSION || 'dev' },
    });
    Pyroscope.start();
  } catch (err) {
    log('warn', 'pyroscope profiling unavailable', { error: err.message });
  }
}

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
const upstreamErrors = new promClient.Counter({
  name: 'gateway_upstream_errors_total',
  help: 'Requests that failed to reach an upstream service',
  labelNames: ['upstream'],
  registers: [registry],
});

// Public route prefix -> upstream service. Only /api/* is ever exposed; /internal/* stays private.
const ROUTES = {
  '/api/users': process.env.USER_SERVICE_URL || 'http://user-service:8080',
  '/api/products': process.env.PRODUCT_SERVICE_URL || 'http://product-service:8080',
  '/api/cart': process.env.CART_SERVICE_URL || 'http://cart-service:8080',
  '/api/orders': process.env.ORDER_SERVICE_URL || 'http://order-service:8080',
  '/api/payments': process.env.PAYMENT_SERVICE_URL || 'http://payment-service:8080',
};

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path === '/healthz' || req.path === '/readyz' || req.path === '/metrics') return;
    const route = Object.keys(ROUTES).find((p) => req.path === p || req.path.startsWith(`${p}/`)) || 'unmatched';
    httpDuration.observe({ method: req.method, route, status_code: res.statusCode }, (Date.now() - start) / 1000);
    log('info', 'request', { method: req.method, path: req.originalUrl, status: res.statusCode, ms: Date.now() - start });
  });
  next();
});

app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
app.get('/readyz', (req, res) => res.json({ status: 'ready' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 300),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

for (const [prefix, target] of Object.entries(ROUTES)) {
  app.use(
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathFilter: (path) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
      proxyTimeout: 15000,
      on: {
        error: (err, req, res) => {
          log('error', 'upstream error', { target, error: err.message });
          upstreamErrors.inc({ upstream: prefix });
          if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: 'Service temporarily unavailable' }));
        },
      },
    })
  );
}

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

const server = app.listen(PORT, () => log('info', `listening on :${PORT}`, { routes: ROUTES }));
const shutdown = (signal) => {
  log('info', `received ${signal}, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
