import { json } from '../_lib/http.js';
import { db } from '../_lib/users.js';

export async function onRequestGet({ env, data }) {
  const sql = db(env);
  const [user] = await sql`
    select id, email, name, avatar_url, monthly_income_cents
    from users where id = ${data.userId}`;
  if (!user) return json({ error: 'unauthorized' }, 401);
  return json(user);
}

export async function onRequestPatch({ request, env, data }) {
  const body = await request.json().catch(() => ({}));
  const sql = db(env);

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 80) return json({ error: 'nome inválido' }, 400);
    await sql`update users set name = ${name} where id = ${data.userId}`;
  }
  if (body.monthly_income_cents !== undefined) {
    const cents = body.monthly_income_cents;
    if (!Number.isInteger(cents) || cents < 0) return json({ error: 'salário inválido' }, 400);
    await sql`update users set monthly_income_cents = ${cents} where id = ${data.userId}`;
  }

  const [user] = await sql`
    select id, email, name, avatar_url, monthly_income_cents
    from users where id = ${data.userId}`;
  return json(user);
}
