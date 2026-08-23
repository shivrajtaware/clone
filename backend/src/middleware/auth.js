// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');
const { runWithTenant } = require('../utils/requestContext');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { hospital: true, department: true },
    });
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }
    req.user = user;
    req.auth = decoded;
    req.hospitalId = user.hospital_id;
    return runWithTenant(user.hospital_id, next);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = auth;
