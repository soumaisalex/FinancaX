import { readSession } from '../_lib/auth.js';
import { json } from '../_lib/http.js';

export async function onRequest({ request, env, next, data }) {
  const url = new URL(request.url);

  // Defesa extra contra CSRF: mutações só da mesma origem.
  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json({ error: 'forbidden' }, 403);
  }

  if (url.pathname.startsWith('/api/auth/')) return next();

  const userId = await readSession(request, env);
  if (!userId) return json({ error: 'unauthorized' }, 401);
  data.userId = userId; // único ponto de verdade para filtrar por user_id
  return next();
}
