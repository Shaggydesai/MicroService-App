process.env.SERVICE_NAME = process.env.SERVICE_NAME || 'product-service';
const { start, log } = require('./lib');
const { app } = require('./app');
const { seedProducts } = require('./seed');

start(app, {
  onReady: () => {
    if (process.env.SEED_DATA === 'false') return;
    seedProducts().catch((err) => log('error', 'product seed failed', { error: err.message }));
  },
});
