const { Pool } = require('pg');

const pool = new Pool({
  host:            process.env.DB_HOST     || 'localhost',
  port:            parseInt(process.env.DB_PORT || '5432', 10),
  database:        process.env.DB_NAME     || 'thep_academy',
  user:            process.env.DB_USER     || 'postgres',
  password:        process.env.DB_PASSWORD || '',
  max:             parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis:    parseInt(process.env.DB_POOL_IDLE    || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE || '2000', 10),
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

/**
 * Execute a query with optional parameters.
 * @param {string} text  — SQL query string
 * @param {any[]}  params — Query parameters
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a client from the pool (for transactions).
 */
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
