const express = require('express');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

const SERVICE = 'api-gateway';
const PORT = Number(process.env.PORT || 8080);

const log = (level, msg, extra = {}) =>
  process.stdout.write(JSON.stringify({ ts: new Date().toISOString(), level, service: SERVICE, msg, ...extra }) + '\n');

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
    if (req.path === '/healthz' || req.path === '/readyz') return;
    log('info', 'request', { method: req.method, path: req.originalUrl, status: res.statusCode, ms: Date.now() - start });
  });
  next();
});

app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
app.get('/readyz', (req, res) => res.json({ status: 'ready' }));

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
