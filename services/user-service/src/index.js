process.env.SERVICE_NAME = process.env.SERVICE_NAME || 'user-service';
const { start, log } = require('./lib');
const { app, seedAdmin } = require('./app');

start(app, {
  onReady: () => seedAdmin().catch((err) => log('error', 'admin seed failed', { error: err.message })),
});
