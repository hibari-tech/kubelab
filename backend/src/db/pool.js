/**
 * PostgreSQL connection pool for KubeLab exchange.
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 100) {
    console.warn('Slow query', { text, duration: `${duration}ms`, rows: result.rowCount });
  }
  return result;
}

async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const release = client.release.bind(client);

  let released = false;
  client.query = (...args) => {
    if (released) throw new Error('Query called after client release');
    return originalQuery(...args);
  };
  client.release = () => {
    released = true;
    return release();
  };
  return client;
}

module.exports = { query, getClient, pool };
