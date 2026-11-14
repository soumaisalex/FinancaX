import { readSession } from '../_lib/auth.js';
import { json } from '../_lib/http.js';
import { db } from '../_lib/users.js';

export async function onRequest({ request, env, next, data }) {
  const url = new URL(request.url);

  // Defesa extra contra CSRF: mutações só da mesma origem.
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json({ error: 'forbidden' }, 403);
  }

  if (url.pathname.startsWith('/api/auth/')) return next();

  const session = await readSession(request, env);
  if (!session) return json({ error: 'unauthorized' }, 401);

  // token_version permite invalidar sessões (troca de senha, takeover por Google).
  const [u] = await db(env)`select token_version from users where id = ${session.userId}`;
  if (!u || u.token_version !== session.version) return json({ error: 'unauthorized' }, 401);

  data.userId = session.userId; // único ponto de verdade para filtrar por user_id
  return next();
}
