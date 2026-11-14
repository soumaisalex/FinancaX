import { bad, json, notFound, readJson } from '../../_lib/http.js';
import { db } from '../../_lib/users.js';
import { isText, isUuid } from '../../_lib/validate.js';
import { TYPES } from './index.js';

export async function onRequestPatch({ request, env, data, params }) {
  if (!isUuid(params.id)) return notFound();
  const b = await readJson(request);
  if (b.name !== undefined && !isText(b.name)) return bad('Nome inválido.');
  if (b.type !== undefined && !TYPES.includes(b.type)) return bad('Tipo inválido.');
  if (b.initial_balance_cents !== undefined &&
      (!Number.isInteger(b.initial_balance_cents) || Math.abs(b.initial_balance_cents) > 1e12))
    return bad('Saldo inicial inválido.');
  const [row] = await db(env)`
    update accounts set
      name = coalesce(${b.name?.trim() ?? null}::text, name),
      type = coalesce(${b.type ?? null}::text, type),
      initial_balance_cents = coalesce(${b.initial_balance_cents ?? null}::bigint, initial_balance_cents)
    where id = ${params.id} and user_id = ${data.userId} returning id`;
  return row ? json(row) : notFound();
}

// Com movimentações, arquiva (preserva o histórico); sem, exclui.
export async function onRequestDelete({ env, data, params }) {
  if (!isUuid(params.id)) return notFound();
  const sql = db(env);
  const [a] = await sql`
    select (exists (select 1 from transactions where account_id = ${params.id})
         or exists (select 1 from invoices where paid_account_id = ${params.id})) as used
    from accounts where id = ${params.id} and user_id = ${data.userId}`;
  if (!a) return notFound();
  if (a.used) {
    await sql`update accounts set archived = true where id = ${params.id} and user_id = ${data.userId}`;
    return json({ archived: true });
  }
  await sql`delete from accounts where id = ${params.id} and user_id = ${data.userId}`;
  return json({ deleted: true });
}
