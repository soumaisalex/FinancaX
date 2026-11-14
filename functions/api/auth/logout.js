import { SESSION_COOKIE, clearCookie } from '../../_lib/auth.js';
import { json } from '../../_lib/http.js';

export async function onRequestPost({ request }) {
  const secure = new URL(request.url).protocol === 'https:';
  return json({ ok: true }, 200, { 'set-cookie': clearCookie(SESSION_COOKIE, secure) });
}
