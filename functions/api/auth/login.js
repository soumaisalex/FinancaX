import { SESSION_COOKIE, SESSION_MAX_AGE, setCookie, signSession } from '../../_lib/auth.js';
import { json } from '../../_lib/http.js';
import { dummyVerify, verifyPassword } from '../../_lib/password.js';
import { allowed, clearFails, recordFail } from '../../_lib/throttle.js';
import { db } from '../../_lib/users.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '').slice(0, 128);

  const sql = db(env);
  const emailKey = `login:${email}`;
  const ipKey = `ip:${request.headers.get('cf-connecting-ip') || 'unknown'}`;
  if (!(await allowed(sql, [[emailKey, 5], [ipKey, 30]]))) {
    return json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
  }

  const [user] = await sql`
    select id, password_hash, token_version from users where email = ${email}`;
  let ok = false;
  if (user?.password_hash) ok = await verifyPassword(password, user.password_hash);
  else await dummyVerify(password, env);

  if (!ok) {
    await recordFail(sql, [emailKey, ipKey]);
    return json({ error: 'Email ou senha incorretos.' }, 401);
  }
  await clearFails(sql, [emailKey]);

  const secure = new URL(request.url).protocol === 'https:';
  const session = await signSession(user.id, user.token_version, env.SESSION_SECRET);
  return json({ ok: true }, 200, {
    'set-cookie': setCookie(SESSION_COOKIE, session, { maxAge: SESSION_MAX_AGE, secure }),
  });
}
