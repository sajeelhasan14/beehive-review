// Password hashing with Node's built in scrypt (no package).
// Settings follow OWASP's minimum for scrypt: N=2^17, r=8, p=1 (uses ~128MB per hash, ~0.3s).
// Stored format: scrypt$N$r$p$salt$hash, so the settings travel with each hash and can be raised later.
// No 'server-only' here on purpose: scripts/create-user.mjs (outside Next.js) imports this file too.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 2 ** 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 256 * 1024 * 1024;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { N: n, r, p, maxmem: MAX_MEMORY }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(password, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p));
  // timingSafeEqual takes the same time whether the first or last byte differs.
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// A throwaway hash to check against when the email doesn't exist, so a wrong email
// takes as long as a wrong password and attackers can't tell which emails are real.
let dummy: Promise<string> | undefined;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(16).toString('hex'));
  return dummy;
}
