import { createCipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(secret) {
  return createHash('sha256').update(secret).digest();
}

export function generatePasskey(secret) {
  const key = getKey(secret);
  const iv = randomBytes(12);
  const timestamp = Date.now().toString();
  const randomPart = randomBytes(8).toString('hex');
  const data = `${timestamp}:${randomPart}`;

  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  const combined = iv.toString('hex') + encrypted + authTag;
  return combined.substring(0, 30).toUpperCase();
}

export function validatePasskey(passkey, secret, storedPasskeys) {
  if (!passkey || passkey.length !== 30) return false;
  return storedPasskeys.has(passkey.toUpperCase());
}

export function createPasskeyWithExpiry(secret) {
  const passkey = generatePasskey(secret);
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  return { passkey, expiresAt };
}
