import { bad, json, notFound, readJson } from '../../_lib/http.js';
import { db } from '../../_lib/users.js';
import { isDay, isMoney, isText, isUuid } from '../../_lib/validate.js';

export async function onRequestPatch({ request, env, data, params }) {
  if (!isUuid(params.id)) return notFound();
  const b = await readJson(request);
  if (b.name !== undefined && !isText(b.name)) return bad('Nome inválido.');
  if (b.limit_cents !== undefined && !isMoney(b.limit_cents, 0)) return bad('Limite inválido.');
  if (b.closing_day !== undefined && !isDay(b.closing_day)) return bad('Dia de fechamento inválido.');
  if (b.due_day !== undefined && !isDay(b.due_day)) return bad('Dia de vencimento inválido.');
  const [row] = await db(env)`
    update credit_cards set
      name = coalesce(${b.name?.trim() ?? null}::text, name),
      limit_cents = coalesce(${b.limit_cents ?? null}::bigint, limit_cents),
      closing_day = coalesce(${b.closing_day ?? null}::smallint, closing_day),
      due_day = coalesce(${b.due_day ?? null}::smallint, due_day)
    where id = ${params.id} and user_id = ${data.userId} returning id`;
  return row ? json(row) : notFound();
}

export async function onRequestDelete({ env, data, params }) {
  if (!isUuid(params.id)) return notFound();
  const sql = db(env);
  const [k] = await sql`
    select exists (select 1 from transactions where card_id = ${params.id}) as used
    from credit_cards where id = ${params.id} and user_id = ${data.userId}`;
  if (!k) return notFound();
  if (k.used) {
    await sql`update credit_cards set archived = true where id = ${params.id} and user_id = ${data.userId}`;
    return json({ archived: true });
  }
  await sql`delete from credit_cards where id = ${params.id} and user_id = ${data.userId}`;
  return json({ deleted: true });
}
