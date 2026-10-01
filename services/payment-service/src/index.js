process.env.SERVICE_NAME = process.env.SERVICE_NAME || 'payment-service';
const { start } = require('./lib');
const { app } = require('./app');

start(app);
