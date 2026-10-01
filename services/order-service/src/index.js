process.env.SERVICE_NAME = process.env.SERVICE_NAME || 'order-service';
const { start } = require('./lib');
const { app } = require('./app');

start(app);
