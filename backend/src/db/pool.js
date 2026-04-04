const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: config.db.url,
  min: config.db.poolMin,
  max: config.db.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected DB pool error', { error: err.message });
});

/**
 * Execute a query. Returns rows array.
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('DB query', { text: text.slice(0, 80), duration, rows: res.rowCount });
  return res;
}

/**
 * Get a client for transactions. Remember to call client.release() after use.
 */
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  client.query = async (text, params) => {
    const start = Date.now();
    const res = await originalQuery(text, params);
    logger.debug('TX query', { text: text.slice(0, 80), duration: Date.now() - start });
    return res;
  };
  return client;
}

module.exports = { query, getClient, pool };
