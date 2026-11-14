import { SESSION_COOKIE, SESSION_MAX_AGE, setCookie, signSession } from '../../_lib/auth.js';
import { json } from '../../_lib/http.js';
import { hashPassword, validPassword, verifyPassword } from '../../_lib/password.js';
import { db } from '../../_lib/users.js';

// Define ou troca a senha. Quem já tem senha precisa informar a atual.
// Invalida as outras sessões (token_version) e renova a atual.
export async function onRequestPost({ request, env, data }) {
  const body = await request.json().catch(() => ({}));
  if (!validPassword(body.new_password)) {
    return json({ error: 'A senha deve ter de 8 a 128 caracteres.' }, 400);
  }
  const sql = db(env);
  const [u] = await sql`select password_hash from users where id = ${data.userId}`;
  if (u.password_hash && !(await verifyPassword(String(body.current_password || ''), u.password_hash))) {
    return json({ error: 'Senha atual incorreta.' }, 403);
  }

  const hash = await hashPassword(body.new_password, env);
  const [row] = await sql`
    update users set password_hash = ${hash}, token_version = token_version + 1
    where id = ${data.userId} returning token_version`;

  const secure = new URL(request.url).protocol === 'https:';
  const session = await signSession(data.userId, row.token_version, env.SESSION_SECRET);
  return json({ ok: true }, 200, {
    'set-cookie': setCookie(SESSION_COOKIE, session, { maxAge: SESSION_MAX_AGE, secure }),
  });
}
