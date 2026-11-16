import { SESSION_COOKIE, SESSION_MAX_AGE, setCookie, signSession } from '../../_lib/auth.js';
import { json } from '../../_lib/http.js';
import { hashPassword, validEmail, validPassword } from '../../_lib/password.js';
import { allowed, recordFail } from '../../_lib/throttle.js';
import { db, seedCategories } from '../../_lib/users.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = body.password;

  if (!name || name.length > 80) return json({ error: 'Informe seu nome.' }, 400);
  if (!validEmail(email)) return json({ error: 'Email inválido.' }, 400);
  if (!validPassword(password)) return json({ error: 'A senha deve ter de 8 a 128 caracteres.' }, 400);

  const sql = db(env);
  const ipKey = `reg:${request.headers.get('cf-connecting-ip') || 'unknown'}`;
  if (!(await allowed(sql, [[ipKey, 10]]))) {
    return json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
  }
  await recordFail(sql, [ipKey]); // conta toda tentativa de cadastro

  const hash = await hashPassword(password, env);
  const [user] = await sql`
    insert into users (email, name, password_hash)
    values (${email}, ${name}, ${hash})
    on conflict (email) do nothing
    returning id, token_version`;
  if (!user) {
    return json({ error: 'Este email já está cadastrado. Entre com sua senha.' }, 409);
  }
  await seedCategories(sql, user.id);

  const secure = new URL(request.url).protocol === 'https:';
  const session = await signSession(user.id, user.token_version, env.SESSION_SECRET);
  return json({ ok: true }, 201, {
    'set-cookie': setCookie(SESSION_COOKIE, session, { maxAge: SESSION_MAX_AGE, secure }),
  });
}
