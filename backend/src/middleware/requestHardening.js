const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor']);

const inspect = (value, depth = 0) => {
  if (depth > 12) throw new Error('Request nesting is too deep');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (dangerousKeys.has(key)) throw new Error('Invalid request object');
    inspect(child, depth + 1);
  }
};

module.exports = (req, res, next) => {
  try {
    inspect(req.body);
    inspect(req.query);
    inspect(req.params);
    next();
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
