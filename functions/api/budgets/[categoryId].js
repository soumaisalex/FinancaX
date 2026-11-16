import { bad, json, notFound, readJson } from '../../_lib/http.js';
import { db } from '../../_lib/users.js';
import { isMoney, isUuid } from '../../_lib/validate.js';

// PUT { amount_cents } define o limite; amount_cents null/0 remove.
export async function onRequestPut({ request, env, data, params }) {
  if (!isUuid(params.categoryId)) return notFound();
  const b = await readJson(request);
  const sql = db(env);
  const uid = data.userId;
  const [cat] = await sql`
    select 1 as x from categories where id = ${params.categoryId} and user_id = ${uid} and kind = 'expense'`;
  if (!cat) return notFound();

  if (b.amount_cents === null || b.amount_cents === 0) {
    await sql`delete from category_budgets where user_id = ${uid} and category_id = ${params.categoryId}`;
    return json({ ok: true, removed: true });
  }
  if (!isMoney(b.amount_cents)) return bad('Valor inválido.');
  await sql`
    insert into category_budgets (user_id, category_id, amount_cents)
    values (${uid}, ${params.categoryId}, ${b.amount_cents})
    on conflict (user_id, category_id) do update set amount_cents = excluded.amount_cents, updated_at = now()`;
  return json({ ok: true });
}
