import { addMonthsToDate, daysIn, invoiceRefMonth, iso, monthRange } from './dates.js';

export async function ensureInvoice(sql, uid, cardId, refMonth) {
  const [inv] = await sql`
    insert into invoices (user_id, card_id, ref_month) values (${uid}, ${cardId}, ${refMonth})
    on conflict (card_id, ref_month) do update set ref_month = excluded.ref_month
    returning id`;
  return inv.id;
}

// Total dividido em n parcelas; o resto dos centavos vai para a primeira.
export function splitAmount(total, n) {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => base + (i === 0 ? total - base * n : 0));
}

export async function insertTransactions(sql, uid, t, card) {
  const n = t.installments;
  const amounts = splitAmount(t.amount_cents, n);
  const group = n > 1 ? crypto.randomUUID() : null;
  const paid = !card && n === 1 && !!t.paid;
  const paidAt = paid ? new Date().toISOString() : null;
  const queries = [];
  for (let i = 0; i < n; i++) {
    const date = addMonthsToDate(t.date, i);
    const invoiceId = card
      ? await ensureInvoice(sql, uid, card.id, invoiceRefMonth(date, card.closing_day, card.due_day))
      : null;
    queries.push(sql`
      insert into transactions
        (user_id, kind, description, amount_cents, date, paid, paid_at, category_id, account_id,
         card_id, invoice_id, installment_group, installment_no, installment_total)
      values
        (${uid}, ${t.kind}, ${t.description}, ${amounts[i]}, ${date}, ${paid}, ${paidAt},
         ${t.category_id}, ${t.account_id}, ${card ? card.id : null}, ${invoiceId},
         ${group}, ${n > 1 ? i + 1 : null}, ${n > 1 ? n : null})`);
  }
  await sql.transaction(queries);
}

// Gera as ocorrências das recorrências ativas no mês (idempotente, sem cron).
export async function materialize(sql, uid, month) {
  const { start, end } = monthRange(month);
  const [y, m] = month.split('-').map(Number);
  const recs = await sql`
    select r.id, r.description, r.kind, r.amount_cents, r.category_id, r.account_id, r.card_id,
           r.day_of_month, r.start_date::text as start_s, r.end_date::text as end_s,
           k.closing_day, k.due_day
    from recurrences r left join credit_cards k on k.id = r.card_id
    where r.user_id = ${uid} and r.active and r.start_date < ${end}::date
      and (r.end_date is null or r.end_date >= ${start}::date)`;
  if (!recs.length) return;

  const existing = new Set(
    (await sql`
      select recurrence_id from transactions
      where user_id = ${uid} and recurrence_id is not null
        and date >= ${start}::date and date < ${end}::date`).map((r) => r.recurrence_id)
  );

  const queries = [];
  for (const r of recs) {
    if (existing.has(r.id)) continue;
    const date = iso(y, m, Math.min(r.day_of_month, daysIn(y, m)));
    if (date < r.start_s || (r.end_s && date > r.end_s)) continue;
    const invoiceId = r.card_id
      ? await ensureInvoice(sql, uid, r.card_id, invoiceRefMonth(date, r.closing_day, r.due_day))
      : null;
    queries.push(sql`
      insert into transactions
        (user_id, kind, description, amount_cents, date, category_id, account_id, card_id, invoice_id, recurrence_id)
      values
        (${uid}, ${r.kind}, ${r.description}, ${r.amount_cents}, ${date}, ${r.category_id},
         ${r.account_id}, ${r.card_id}, ${invoiceId}, ${r.id})
      on conflict (recurrence_id, date) where recurrence_id is not null do nothing`);
  }
  if (queries.length) await sql.transaction(queries);
}
