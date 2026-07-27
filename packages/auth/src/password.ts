import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const ALGORITHM = 'pbkdf2';
const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString('hex');
  const hash = await pbkdf2(password, salt);
  return `${ALGORITHM}$${ITERATIONS}$${salt}$${hash}`;
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  const [algorithm, iterations, salt, hash] = hashedPassword.split('$');
  if (algorithm !== ALGORITHM || parseInt(iterations) !== ITERATIONS) {
    return false;
  }
  const newHash = await pbkdf2(password, salt);
  return timingSafeEqual(Buffer.from(hash), Buffer.from(newHash));
}

function pbkdf2(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const iterations = ITERATIONS;
    const keylen = KEY_LENGTH;
    const digest = DIGEST;

    const crypto = require('crypto');
    crypto.pbkdf2(password, salt, iterations, keylen, digest, (err: Error | null, derivedKey: Buffer) => {
      if (err) reject(err);
      else resolve(derivedKey.toString('hex'));
    });
  });
}