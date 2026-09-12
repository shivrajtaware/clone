// src/server.js
require('dotenv').config();
require('express-async-errors');
const http = require('http');
const app = require('./app');
const { initSocket } = require('./config/socket');
const logger = require('./utils/logger');
const { prisma } = require('./config/db');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

initSocket(server);

// Bind explicitly on every interface so LAN/Tauri clients can reach the
// server after a restart on Windows as well as in containers.
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🏥 MediCore HMS Backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`API Base URL: http://localhost:${PORT}/api`);
});

// Graceful shutdown
const shutdown = async (signal) => {
  logger.warn(`${signal} received. Gracefully shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Database connection closed');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Force shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Global error handlers
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', { error: err.message, stack: err.stack });
  // Don't exit here, log and continue to catch more errors
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', { error: err.message, stack: err.stack });
  // Force exit on uncaught exception
  process.exit(1);
});
