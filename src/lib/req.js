export async function req(method, url, body) {
  const r = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Erro ${r.status}`);
  return j;
}

export const brl = (c) =>
  (Number(c) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// "1.234,56" | "12,5" | "12.50" -> centavos (inteiro) ou null
export function toCents(s) {
  let t = String(s).trim().replace(/[R$\s]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
