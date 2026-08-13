// src/config/socket.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

let io;

const initSocket = (server) => {
  const allowedOrigins = (process.env.SOCKET_CORS_ORIGIN || process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim().toLowerCase())
    .filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalizedOrigin = origin.toLowerCase();
        if (
          allowedOrigins.length === 0 ||
          allowedOrigins.includes(normalizedOrigin) ||
          normalizedOrigin === 'http://tauri.localhost' ||
          normalizedOrigin === 'https://tauri.localhost' ||
          normalizedOrigin === 'tauri://localhost' ||
          normalizedOrigin.startsWith('http://localhost:') ||
          normalizedOrigin.startsWith('http://127.0.0.1:') ||
          normalizedOrigin.endsWith('.trycloudflare.com')
        ) {
          return callback(null, true);
        }
        return callback(new Error(`Socket CORS blocked origin: ${origin}`));
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.hospitalId = decoded.hospitalId;
      socket.role = decoded.role;
      next();
    } catch (err) {
      logger.warn('Socket auth failed', { error: err.message });
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('Socket connected', { socketId: socket.id, userId: socket.userId });

    // Join hospital room for scoped events
    if (socket.hospitalId) socket.join(`hospital:${socket.hospitalId}`);

    socket.on('join:icu', () => {
      if (socket.hospitalId) socket.join(`icu:${socket.hospitalId}`);
    });
    socket.on('join:emergency', () => {
      if (socket.hospitalId) socket.join(`emergency:${socket.hospitalId}`);
    });
    socket.on('join:lab', () => {
      if (socket.hospitalId) socket.join(`lab:${socket.hospitalId}`);
    });
    socket.on('join:pharmacy', () => {
      if (socket.hospitalId) socket.join(`pharmacy:${socket.hospitalId}`);
    });
    socket.on('join:patients', () => {
      if (socket.hospitalId) socket.join(`patients:${socket.hospitalId}`);
    });
    socket.on('join:beds', () => {
      if (socket.hospitalId) socket.join(`beds:${socket.hospitalId}`);
    });
    socket.on('join:ot', () => {
      if (socket.hospitalId) socket.join(`ot:${socket.hospitalId}`);
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { socketId: socket.id, userId: socket.userId });
    });
  });

  return io;
};

const getIO = () => io;

// Helper functions for emitting events
const emitToHospital = (hospitalId, event, data) => {
  if (io) io.to(`hospital:${hospitalId}`).emit(event, data);
};

const emitToICU = (hospitalId, event, data) => {
  if (io) io.to(`icu:${hospitalId}`).emit(event, data);
};

const emitToPharmacy = (hospitalId, event, data) => {
  if (io) io.to(`pharmacy:${hospitalId}`).emit(event, data);
};

const emitToPatients = (hospitalId, event, data) => {
  if (io) io.to(`patients:${hospitalId}`).emit(event, data);
};

const emitToBeds = (hospitalId, event, data) => {
  if (io) io.to(`beds:${hospitalId}`).emit(event, data);
};

const emitToLab = (hospitalId, event, data) => {
  if (io) io.to(`lab:${hospitalId}`).emit(event, data);
};

const emitToOT = (hospitalId, event, data) => {
  if (io) io.to(`ot:${hospitalId}`).emit(event, data);
};

const emitToEmergency = (hospitalId, event, data) => {
  if (io) io.to(`emergency:${hospitalId}`).emit(event, data);
};

module.exports = { initSocket, getIO, emitToHospital, emitToICU, emitToEmergency, emitToPharmacy, emitToPatients, emitToBeds, emitToLab, emitToOT };
