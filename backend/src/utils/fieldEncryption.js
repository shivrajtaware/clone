const crypto = require('node:crypto');

const getKey = () => {
  const configured = process.env.FIELD_ENCRYPTION_KEY || '';
  if (/^[0-9a-f]{64}$/i.test(configured)) return Buffer.from(configured, 'hex');
  if (process.env.NODE_ENV === 'production') throw new Error('FIELD_ENCRYPTION_KEY must be a 64-character hex key in production');
  return crypto.createHash('sha256').update(configured || 'development-only-field-key').digest();
};

const encrypt = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
};

const decrypt = (value) => {
  if (typeof value !== 'string' || !value.startsWith('v1:')) return value;
  const [, ivRaw, tagRaw, ciphertextRaw] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, 'base64url')), decipher.final()]).toString('utf8');
};

module.exports = { encrypt, decrypt };
