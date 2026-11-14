// Colunas *_cents (bigint) chegam do driver como string; aqui viram número.
export const json = (data, status = 200, headers = {}) =>
  new Response(
    JSON.stringify(data, (k, v) => (typeof v === 'string' && k.endsWith('_cents') ? Number(v) : v)),
    { status, headers: { 'content-type': 'application/json', ...headers } }
  );

export const readJson = (request) => request.json().catch(() => ({}));
export const bad = (msg) => json({ error: msg }, 400);
export const notFound = () => json({ error: 'Não encontrado.' }, 404);

export function redirect(location, cookies = []) {
  const headers = new Headers({ location });
  for (const c of cookies) headers.append('set-cookie', c);
  return new Response(null, { status: 302, headers });
}
