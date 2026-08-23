const router = require('express').Router();
const auth = require('../middleware/auth');
const { prisma } = require('../config/db');

router.use(auth);

// Files are stored as data URLs in clinical records today. They are never
// exposed through a public static directory; access is checked through the
// owning hospital and record before the bytes are returned.
router.get('/radiology/:orderId/:index', async (req, res) => {
  const index = Number.parseInt(req.params.index, 10);
  if (!Number.isInteger(index) || index < 0) return res.status(400).json({ success: false, message: 'Invalid file index' });

  const order = await prisma.radiologyOrder.findFirst({
    where: { id: req.params.orderId, hospital_id: req.hospitalId },
    select: { images_path: true },
  });
  const source = order?.images_path?.[index];
  if (!source || typeof source !== 'string' || !source.startsWith('data:')) {
    return res.status(404).json({ success: false, message: 'File not found' });
  }

  const match = source.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/s);
  if (!match) return res.status(404).json({ success: false, message: 'Invalid stored file' });
  const mime = match[1] || 'application/octet-stream';
  const body = match[0].includes(';base64') ? Buffer.from(match[2], 'base64') : Buffer.from(decodeURIComponent(match[2]), 'utf8');
  res.set({ 'Content-Type': mime, 'Content-Length': body.length, 'Content-Disposition': 'inline' });
  return res.send(body);
});

module.exports = router;
