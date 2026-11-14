import { bad, json, readJson } from '../../_lib/http.js';
import { db } from '../../_lib/users.js';
import { isText } from '../../_lib/validate.js';

export const TYPES = ['checking', 'savings', 'cash', 'wallet'];

export async function onRequestGet({ env, data }) {
  const rows = await db(env)`
    select a.id, a.name, a.type, a.initial_balance_cents,
      (a.initial_balance_cents
        + coalesce((select sum(case when t.kind = 'income' then t.amount_cents else -t.amount_cents end)
                    from transactions t where t.account_id = a.id and t.paid), 0)
        - coalesce((select sum(t.amount_cents) from invoices i join transactions t on t.invoice_id = i.id
                    where i.paid_account_id = a.id and i.paid_at is not null), 0))::bigint as balance_cents
    from accounts a
    where a.user_id = ${data.userId} and not a.archived
    order by a.name`;
  return json(rows);
}

export async function onRequestPost({ request, env, data }) {
  const b = await readJson(request);
  if (!isText(b.name)) return bad('Informe o nome da conta.');
  const type = TYPES.includes(b.type) ? b.type : 'checking';
  const initial = b.initial_balance_cents ?? 0;
  if (!Number.isInteger(initial) || Math.abs(initial) > 1e12) return bad('Saldo inicial inválido.');
  const [row] = await db(env)`
    insert into accounts (user_id, name, type, initial_balance_cents)
    values (${data.userId}, ${b.name.trim()}, ${type}, ${initial}) returning id`;
  return json(row, 201);
}
