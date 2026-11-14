import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'sid';
export const OAUTH_COOKIE = 'oauth';
const SESSION_DAYS = 30;
const enc = new TextEncoder();

export function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function setCookie(name, value, { maxAge, secure = true } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; ${
    secure ? 'Secure; ' : ''
  }Max-Age=${maxAge}`;
}

export const clearCookie = (name, secure = true) => setCookie(name, '', { maxAge: 0, secure });

export function signSession(userId, secret) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(enc.encode(secret));
}

export async function readSession(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, enc.encode(env.SESSION_SECRET), {
      algorithms: ['HS256'],
    });
    return payload.sub || null;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
