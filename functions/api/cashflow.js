import { json } from '../_lib/http.js';
import { materialize } from '../_lib/finance.js';
import { db, bad } from '../_lib/p3.js';

const INITIAL_COL = 'initial_balance_cents';
const INCOME = 'income', EXPENSE = 'expense';

const addM = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`;
};
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export async function onRequestGet({ request, env, data }) {
  const n = Math.min(24, Math.max(1, parseInt(new URL(request.url).searchParams.get('months') || '6', 10) || 6));
  const uid = data.userId;
  const sql = db(env);

  const [{ cur }] = await sql`
    SELECT to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-01') AS cur`;
  const months = Array.from({ length: n }, (_, i) => addM(cur, i));
  const end = addM(cur, n); // exclusivo

  // Gera recorrências dos meses projetados (idempotente, igual a abrir o mês).
  await Promise.all(months.map((m) => materialize(sql, uid, m.slice(0, 7))));

  const [opening, txs, invs, user] = await Promise.all([
    sql(
      `SELECT
         (SELECT COALESCE(SUM(a.${INITIAL_COL}), 0) FROM accounts a WHERE a.user_id = $1::uuid)
         + (SELECT COALESCE(SUM(CASE WHEN kind = '${INCOME}' THEN amount_cents ELSE -amount_cents END), 0)
              FROM transactions
             WHERE user_id = $1::uuid AND account_id IS NOT NULL AND invoice_id IS NULL AND paid
               AND kind IN ('${INCOME}', '${EXPENSE}'))
         - (SELECT COALESCE(SUM(CASE WHEN t.kind = '${INCOME}' THEN -t.amount_cents ELSE t.amount_cents END), 0)
              FROM invoices i JOIN transactions t ON t.invoice_id = i.id
             WHERE i.user_id = $1::uuid AND i.paid_at IS NOT NULL AND i.paid_account_id IS NOT NULL)
         AS total`,
      [uid]
    ),
    sql(
      `SELECT to_char(date, 'YYYY-MM-01') AS m, kind, SUM(amount_cents)::text AS total
         FROM transactions
        WHERE user_id = $1::uuid AND account_id IS NOT NULL AND invoice_id IS NULL
          AND NOT paid AND kind IN ('${INCOME}', '${EXPENSE}') AND date < $2::date
        GROUP BY 1, 2`,
      [uid, end]
    ),
    sql(
      `SELECT i.ref_month::text AS ref_month,
              COALESCE(SUM(CASE WHEN t.kind = '${INCOME}' THEN -t.amount_cents ELSE t.amount_cents END), 0)::text AS total
         FROM invoices i
         LEFT JOIN transactions t ON t.invoice_id = i.id
        WHERE i.user_id = $1::uuid AND i.paid_at IS NULL
        GROUP BY i.id`,
      [uid]
    ),
    sql`SELECT monthly_income_cents::text AS s FROM users WHERE id = ${uid}::uuid`,
  ]);

  const salary = Number(user[0]?.s || 0);
  const open = Number(opening[0]?.total || 0);
  const idx = new Map(months.map((m, i) => [m, i]));
  const rows = months.map((m) => ({ month: m, salary_cents: salary, income_cents: 0, expense_cents: 0, invoices_cents: 0 }));
  const bucket = (m) => idx.get(cmp(m, cur) < 0 ? cur : m); // atrasados caem no mês atual

  for (const t of txs) {
    const i = bucket(t.m);
    if (i == null) continue;
    if (t.kind === INCOME) rows[i].income_cents += Number(t.total);
    else rows[i].expense_cents += Number(t.total);
  }
  for (const f of invs) {
    const i = bucket(f.ref_month); // ref_month já é o mês de vencimento (dia 1)
    if (i == null) continue;
    rows[i].invoices_cents += Number(f.total);
  }

  let bal = open;
  for (const r of rows) {
    r.net_cents = r.salary_cents + r.income_cents - r.expense_cents - r.invoices_cents;
    bal += r.net_cents;
    r.closing_cents = bal;
  }
  return json({ opening_cents: open, months: rows });
}
