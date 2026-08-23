const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();

const runWithTenant = (hospitalId, callback) => storage.run({ hospitalId }, callback);
const getTenantId = () => storage.getStore()?.hospitalId || null;

module.exports = { runWithTenant, getTenantId };
