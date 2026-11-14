import { monthRange, parseDate, validDate, validMonth } from '../../_lib/dates.js';
import { insertTransactions, materialize } from '../../_lib/finance.js';
import { bad, json, readJson } from '../../_lib/http.js';
import { getCard, owns } from '../../_lib/own.js';
import { db } from '../../_lib/users.js';
import { isMoney, isText, isUuid } from '../../_lib/validate.js';

export async function onRequestGet({ request, env, data }) {
  const q = new URL(request.url).searchParams;
  const month = q.get('month');
  const invoiceId = q.get('invoice_id');
  if (invoiceId ? !isUuid(invoiceId) : !validMonth(month)) return bad('Parâmetros inválidos.');

  const sql = db(env);
  let range = { start: null, end: null };
  if (!invoiceId) {
    await materialize(sql, data.userId, month);
    range = monthRange(month);
  }
  const rows = await sql`
    select t.id, t.kind, t.description, t.amount_cents, t.date::text as date, t.paid,
           t.category_id, c.name as category_name,
           t.account_id, a.name as account_name,
           t.card_id, k.name as card_name,
           t.invoice_id, i.ref_month::text as invoice_month,
           t.installment_no, t.installment_total, t.recurrence_id
    from transactions t
    left join categories c on c.id = t.category_id
    left join accounts a on a.id = t.account_id
    left join credit_cards k on k.id = t.card_id
    left join invoices i on i.id = t.invoice_id
    where t.user_id = ${data.userId}
      and (t.invoice_id = ${invoiceId}::uuid
           or (${invoiceId}::uuid is null and t.date >= ${range.start}::date and t.date < ${range.end}::date))
    order by t.date desc, t.created_at desc`;
  return json(rows);
}

export async function onRequestPost({ request, env, data }) {
  const b = await readJson(request);
  const uid = data.userId;
  const sql = db(env);

  if (!['expense', 'income'].includes(b.kind)) return bad('Tipo inválido.');
  if (!isText(b.description, 120)) return bad('Informe a descrição.');
  if (!isMoney(b.amount_cents)) return bad('Valor inválido.');
  if (!validDate(b.date)) return bad('Data inválida.');
  const installments = b.installments ?? 1;
  if (!Number.isInteger(installments) || installments < 1 || installments > 60) return bad('Parcelas inválidas.');
  const repeat = b.repeat === 'monthly';
  if (repeat && installments > 1) return bad('Escolha parcelas ou repetição mensal, não os dois.');
  if (b.card_id && b.account_id) return bad('Escolha conta ou cartão, não os dois.');
  if (b.card_id && b.kind !== 'expense') return bad('Cartão só vale para despesas.');

  const categoryId = b.category_id || null;
  const accountId = b.account_id || null;
  if (categoryId && !(isUuid(categoryId) && (await owns.category(sql, categoryId, uid)))) return bad('Categoria inválida.');
  if (accountId && !(isUuid(accountId) && (await owns.account(sql, accountId, uid)))) return bad('Conta inválida.');
  const card = b.card_id ? (isUuid(b.card_id) ? await getCard(sql, b.card_id, uid) : null) : null;
  if (b.card_id && !card) return bad('Cartão inválido.');

  const description = b.description.trim();

  if (repeat) {
    await sql`
      insert into recurrences (user_id, description, kind, amount_cents, category_id, account_id, card_id,
                               day_of_month, start_date)
      values (${uid}, ${description}, ${b.kind}, ${b.amount_cents}, ${categoryId}, ${accountId},
              ${card ? card.id : null}, ${parseDate(b.date).d}, ${b.date})`;
    await materialize(sql, uid, b.date.slice(0, 7));
    return json({ ok: true, count: 1 }, 201);
  }

  await insertTransactions(sql, uid, {
    kind: b.kind, description, amount_cents: b.amount_cents, date: b.date, installments,
    category_id: categoryId, account_id: accountId, paid: !!b.paid,
  }, card);
  return json({ ok: true, count: installments }, 201);
}
