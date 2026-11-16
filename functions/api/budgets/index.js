import { monthRange, validMonth } from '../../_lib/dates.js';
import { materialize } from '../../_lib/finance.js';
import { bad, json } from '../../_lib/http.js';
import { db } from '../../_lib/users.js';

// Orçamento x gasto do mês, por categoria de despesa (conta + cartão, pela data da compra).
export async function onRequestGet({ request, env, data }) {
  const month = new URL(request.url).searchParams.get('month');
  if (!validMonth(month)) return bad('Mês inválido.');
  const sql = db(env);
  const uid = data.userId;
  const { start, end } = monthRange(month);
  await materialize(sql, uid, month);

  const [rows, [none]] = await Promise.all([
    sql`
      select c.id as category_id, c.name, b.amount_cents as budget_cents,
             coalesce(sum(t.amount_cents), 0) as spent_cents
      from categories c
      left join category_budgets b on b.category_id = c.id and b.user_id = c.user_id
      left join transactions t on t.category_id = c.id and t.user_id = c.user_id
        and t.kind = 'expense' and t.date >= ${start}::date and t.date < ${end}::date
      where c.user_id = ${uid} and c.kind = 'expense'
      group by c.id, b.amount_cents
      order by (b.amount_cents is null), c.name`,
    sql`
      select coalesce(sum(amount_cents), 0) as spent_cents from transactions
      where user_id = ${uid} and kind = 'expense' and category_id is null
        and date >= ${start}::date and date < ${end}::date`,
  ]);
  return json({ month, categories: rows, uncategorized_cents: Number(none.spent_cents) });
}
