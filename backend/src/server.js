require('dotenv').config();

const app    = require('./app');
const logger = require('./config/logger');
const { pool } = require('./config/database');

const PORT = parseInt(process.env.PORT || '4000', 10);

async function start() {
  // Verify database connection before starting
  try {
    await pool.query('SELECT 1');
    logger.info('✅ PostgreSQL connected');
  } catch (err) {
    logger.error('❌ Cannot connect to PostgreSQL:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`🚀 Thep Academy API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    logger.info(`   Health: http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await pool.end();
      logger.info('PostgreSQL pool closed');
      process.exit(0);
    });
    // Force close after 10 seconds
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

start();
