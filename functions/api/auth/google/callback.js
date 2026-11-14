import { createRemoteJWKSet, jwtVerify } from 'jose';
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  clearCookie,
  getCookie,
  setCookie,
  signSession,
} from '../../../_lib/auth.js';
import { redirect } from '../../../_lib/http.js';
import { upsertOAuthUser } from '../../../_lib/users.js';

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:';
  const fail = (code) => redirect(`${url.origin}/?erro=${code}`, [clearCookie(OAUTH_COOKIE, secure)]);

  const [state, verifier] = (getCookie(request, OAUTH_COOKIE) || '').split('.');
  if (url.searchParams.get('error')) return fail('cancelado');
  if (!state || !verifier || url.searchParams.get('state') !== state) return fail('estado');
  const code = url.searchParams.get('code');
  if (!code) return fail('codigo');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/auth/google/callback`,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) return fail('token');
  const { id_token } = await tokenRes.json();

  let claims;
  try {
    ({ payload: claims } = await jwtVerify(id_token, JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: env.GOOGLE_CLIENT_ID,
    }));
  } catch {
    return fail('token');
  }
  if (!claims.email || !claims.email_verified) return fail('email');

  const userId = await upsertOAuthUser(env, 'google', {
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    picture: claims.picture,
  });
  const session = await signSession(userId, env.SESSION_SECRET);

  return redirect(`${url.origin}/`, [
    setCookie(SESSION_COOKIE, session, { maxAge: SESSION_MAX_AGE, secure }),
    clearCookie(OAUTH_COOKIE, secure),
  ]);
}
