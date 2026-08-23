// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { prisma } = require('../config/db');
const logger = require('../utils/logger');
const { getAllowedModules } = require('../utils/modulePermissions');
const { v4: uuidv4 } = require('uuid');

// Validation helpers
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (password) => password && password.length >= 8;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateTokens = (user, sessionId) => {
  const payload = { userId: user.id, role: user.role, hospitalId: user.hospital_id, sessionId };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
  return { token, refreshToken };
};

const sessionView = (session) => ({
  id: session.id,
  device_name: session.device_name || 'Unknown device',
  user_agent: session.user_agent,
  ip_address: session.ip_address,
  created_at: session.created_at,
  last_used_at: session.last_used_at,
  expires_at: session.expires_at,
});

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    if (!validateEmail(email)) return res.status(400).json({ success: false, message: 'Invalid email format' });

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        hospital: { select: { id: true, name: true, code: true, address: true, city: true, state: true, pincode: true, phone: true, gstin: true, is_active: true, license_end: true, modules_enabled: true, logo: true } },
        department: { select: { id: true, name: true, code: true } },
        doctor_profile: true,
      },
    });

    if (!user) {
      logger.warn('Login failed: user not found', { email: email.toLowerCase() });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.is_active) {
      logger.warn('Login failed: account inactive', { userId: user.id });
      return res.status(403).json({ success: false, message: 'Account is inactive. Contact administrator.' });
    }

    // Check hospital license (skip for super admin)
    if (user.role !== 'SUPER_ADMIN' && user.hospital) {
      if (!user.hospital.is_active) return res.status(403).json({ success: false, message: 'Hospital account is suspended.' });
      if (new Date(user.hospital.license_end) < new Date()) {
        return res.status(403).json({ success: false, message: 'Hospital license has expired. Contact MediCore support.' });
      }
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      logger.warn('Login failed: invalid password', { userId: user.id });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const sessionId = uuidv4();
    const { token, refreshToken } = generateTokens(user, sessionId);
    const refreshPayload = jwt.decode(refreshToken);

    // Each device keeps its own refresh session. Logging in on a second client
    // must not invalidate a nurse/admin already working on another client.
    await prisma.$transaction([
      prisma.refreshSession.deleteMany({ where: { expires_at: { lt: new Date() } } }),
      prisma.refreshSession.create({
        data: {
          id: sessionId,
          user_id: user.id,
          token_hash: hashToken(refreshToken),
          expires_at: new Date(refreshPayload.exp * 1000),
          user_agent: req.get('user-agent')?.slice(0, 500),
          ip_address: req.ip,
          device_name: req.body.deviceName?.toString().slice(0, 100) || null,
          last_used_at: new Date(),
        },
      }),
      prisma.user.update({ where: { id: user.id }, data: { refresh_token: null, last_login: new Date() } }),
    ]);
    logger.info('User logged in', { userId: user.id, role: user.role });

    const { password: _, refresh_token: __, ...safeUser } = user;
    safeUser.allowed_modules = await getAllowedModules(prisma, user);

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: safeUser, token, refreshToken },
    });
  } catch (err) {
    logger.error('Login error', { error: err.message });
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    if (!decoded.sessionId) {
      return res.status(401).json({ success: false, message: 'Please sign in again.' });
    }
    const session = await prisma.refreshSession.findUnique({
      where: { id: decoded.sessionId },
      include: { user: true },
    });
    if (!session || session.user_id !== decoded.userId || session.revoked_at || session.expires_at < new Date() || !session.user.is_active) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    if (session.token_hash !== hashToken(refreshToken)) {
      // A rotated token was replayed. Revoke the affected session family.
      await prisma.refreshSession.update({ where: { id: session.id }, data: { revoked_at: new Date() } });
      await prisma.refreshSession.updateMany({ where: { user_id: session.user_id, revoked_at: null }, data: { revoked_at: new Date() } });
      return res.status(401).json({ success: false, message: 'Refresh token reuse detected. Please sign in again.' });
    }

    const nextSessionId = uuidv4();
    const tokens = generateTokens(session.user, nextSessionId);
    const refreshPayload = jwt.decode(tokens.refreshToken);
    await prisma.$transaction([
      prisma.refreshSession.update({ where: { id: session.id }, data: { revoked_at: new Date(), replaced_by: nextSessionId, last_used_at: new Date() } }),
      prisma.refreshSession.create({ data: { id: nextSessionId, user_id: session.user_id, token_hash: hashToken(tokens.refreshToken), expires_at: new Date(refreshPayload.exp * 1000), user_agent: req.get('user-agent')?.slice(0, 500), ip_address: req.ip, device_name: session.device_name, last_used_at: new Date() } }),
    ]);
    logger.info('Token refreshed', { userId: session.user.id });

    res.json({ success: true, data: tokens });
  } catch (err) {
    logger.warn('Refresh token error', { error: err.message });
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

exports.logout = async (req, res) => {
  try {
    if (req.auth?.sessionId) {
      await prisma.refreshSession.updateMany({ where: { id: req.auth.sessionId, user_id: req.user.id, revoked_at: null }, data: { revoked_at: new Date() } });
    }
    logger.info('User logged out', { userId: req.user.id });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout error', { userId: req.user.id, error: err.message });
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

exports.listSessions = async (req, res) => {
  const sessions = await prisma.refreshSession.findMany({
    where: { user_id: req.user.id, revoked_at: null, expires_at: { gt: new Date() } },
    orderBy: { last_used_at: 'desc' },
  });
  res.json({ success: true, data: sessions.map(sessionView) });
};

exports.revokeSession = async (req, res) => {
  const result = await prisma.refreshSession.updateMany({
    where: { id: req.params.id, user_id: req.user.id, revoked_at: null },
    data: { revoked_at: new Date() },
  });
  if (!result.count) return res.status(404).json({ success: false, message: 'Session not found' });
  res.json({ success: true, message: 'Session revoked' });
};

exports.revokeAllSessions = async (req, res) => {
  await prisma.refreshSession.updateMany({ where: { user_id: req.user.id, revoked_at: null }, data: { revoked_at: new Date() } });
  res.json({ success: true, message: 'All sessions revoked. Please sign in again on this device.' });
};

exports.me = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        hospital: { select: { id: true, name: true, code: true, address: true, city: true, state: true, pincode: true, phone: true, gstin: true, logo: true, modules_enabled: true } },
        department: true,
        doctor_profile: true,
      },
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const { password, refresh_token, ...safe } = user;
    safe.allowed_modules = await getAllowedModules(prisma, user);
    res.json({ success: true, data: safe });
  } catch (err) {
    logger.error('Get user error', { userId: req.user.id, error: err.message });
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (!validatePassword(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    logger.info('Password changed', { userId: req.user.id });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    logger.error('Change password error', { userId: req.user.id, error: err.message });
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};
