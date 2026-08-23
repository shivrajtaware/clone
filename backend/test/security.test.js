const test = require('node:test');
const assert = require('node:assert/strict');
const { encrypt, decrypt } = require('../src/utils/fieldEncryption');
const { withTenantWhere, scopeTenantData } = require('../src/utils/tenantPolicy');
const requestHardening = require('../src/middleware/requestHardening');

test('tenant scope always overwrites a client-supplied hospital id', () => {
  assert.deepEqual(withTenantWhere({ id: 'record', hospital_id: 'attacker' }, 'hospital-a'), { id: 'record', hospital_id: 'hospital-a' });
  assert.deepEqual(scopeTenantData({ name: 'item', hospital_id: 'attacker' }, 'hospital-a'), { name: 'item', hospital_id: 'hospital-a' });
});

test('sensitive fields encrypt and decrypt without storing plaintext', () => {
  const plaintext = 'patient@example.test | +91 99999 99999';
  const ciphertext = encrypt(plaintext);
  assert.notEqual(ciphertext, plaintext);
  assert.match(ciphertext, /^v1:/);
  assert.equal(decrypt(ciphertext), plaintext);
  assert.notEqual(encrypt(plaintext), ciphertext);
});

test('request hardening rejects prototype-pollution keys', () => {
  let statusCode;
  let body;
  requestHardening(
    { body: { safe: { constructor: { polluted: true } } }, query: {}, params: {} },
    { status: code => ({ json: value => { statusCode = code; body = value; } }) },
    () => { throw new Error('should not continue'); },
  );
  assert.equal(statusCode, 400);
  assert.equal(body.success, false);
});
