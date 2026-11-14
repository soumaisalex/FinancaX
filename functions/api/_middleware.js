import { readSession } from '../_lib/auth.js';
import { json } from '../_lib/http.js';
import { db } from '../_lib/users.js';

const BASE = ['DATABASE_URL', 'SESSION_SECRET'];
const GOOGLE = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];

export async function onRequest({ request, env, next, data }) {
  const url = new URL(request.url);

  // Variável ausente vira mensagem clara, em vez de 500 genérico.
  const need = url.pathname.startsWith('/api/auth/google') ? [...BASE, ...GOOGLE] : BASE;
  const missing = need.filter((k) => !env[k]);
  if (missing.length) return json({ error: `Configuração ausente: ${missing.join(', ')}` }, 500);

  try {
    // Defesa extra contra CSRF: mutações só da mesma origem.
    if (!['GET', 'HEAD'].includes(request.method)) {
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin) return json({ error: 'forbidden' }, 403);
    }

    if (url.pathname.startsWith('/api/auth/')) return await next();

    const session = await readSession(request, env);
    if (!session) return json({ error: 'unauthorized' }, 401);

    // token_version permite invalidar sessões (troca de senha, takeover por Google).
    const [u] = await db(env)`select token_version from users where id = ${session.userId}`;
    if (!u || u.token_version !== session.version) return json({ error: 'unauthorized' }, 401);

    data.userId = session.userId; // único ponto de verdade para filtrar por user_id
    return await next();
  } catch (e) {
    console.error(url.pathname, e); // aparece em Functions → Real-time logs
    return json({ error: `Erro interno (${e?.name || 'Error'}): veja os logs do Cloudflare.` }, 500);
  }
}
