import { bad, json, readJson } from '../../_lib/http.js';
import { db } from '../../_lib/users.js';
import { isDay, isMoney, isText } from '../../_lib/validate.js';

export async function onRequestGet({ env, data }) {
  const rows = await db(env)`
    select k.id, k.name, k.limit_cents, k.closing_day, k.due_day,
      (k.limit_cents - coalesce((select sum(x.amount_cents) from transactions x
         join invoices i on i.id = x.invoice_id
         where x.card_id = k.id and i.paid_at is null), 0))::bigint as available_cents
    from credit_cards k where k.user_id = ${data.userId} and not k.archived order by k.name`;
  return json(rows);
}

export async function onRequestPost({ request, env, data }) {
  const b = await readJson(request);
  if (!isText(b.name)) return bad('Informe o nome do cartão.');
  if (!isMoney(b.limit_cents ?? 0, 0)) return bad('Limite inválido.');
  if (!isDay(b.closing_day) || !isDay(b.due_day)) return bad('Dias de fechamento e vencimento inválidos.');
  const [row] = await db(env)`
    insert into credit_cards (user_id, name, limit_cents, closing_day, due_day)
    values (${data.userId}, ${b.name.trim()}, ${b.limit_cents ?? 0}, ${b.closing_day}, ${b.due_day})
    returning id`;
  return json(row, 201);
}
