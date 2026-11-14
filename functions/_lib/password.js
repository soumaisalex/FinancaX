// PBKDF2-SHA256 via Web Crypto. Workers limita a 100000 iterações.
const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const iterations = (env) => Math.min(Number(env?.PBKDF2_ITER) || 100000, 100000);

async function derive(password, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256)
  );
}

export async function hashPassword(password, env) {
  const iter = iterations(env);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iter}$${b64(salt)}$${b64(await derive(password, salt, iter))}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iter, salt, hash] = (stored || '').split('$');
  if (scheme !== 'pbkdf2') return false;
  const got = await derive(password, unb64(salt), Number(iter));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

// Gasta o mesmo tempo quando o email não existe (evita enumeração por timing).
export const dummyVerify = (password, env) => derive(password, new Uint8Array(16), iterations(env));

export const validPassword = (p) => typeof p === 'string' && p.length >= 8 && p.length <= 128;
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
