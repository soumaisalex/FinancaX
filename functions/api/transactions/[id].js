import { invoiceRefMonth, validDate } from '../../_lib/dates.js';
import { ensureInvoice } from '../../_lib/finance.js';
import { bad, json, notFound, readJson } from '../../_lib/http.js';
import { owns } from '../../_lib/own.js';
import { db } from '../../_lib/users.js';
import { isMoney, isText, isUuid } from '../../_lib/validate.js';

export async function onRequestPatch({ request, env, data, params }) {
  if (!isUuid(params.id)) return notFound();
  const uid = data.userId;
  const sql = db(env);
  const [t] = await sql`
    select t.description, t.amount_cents, t.date::text as date_s, t.paid, t.paid_at,
           t.category_id, t.account_id, t.card_id, t.invoice_id, k.closing_day, k.due_day
    from transactions t left join credit_cards k on k.id = t.card_id
    where t.id = ${params.id} and t.user_id = ${uid}`;
  if (!t) return notFound();

  const b = await readJson(request);
  if (b.description !== undefined && !isText(b.description, 120)) return bad('Descrição inválida.');
  if (b.amount_cents !== undefined && !isMoney(b.amount_cents)) return bad('Valor inválido.');
  if (b.date !== undefined && !validDate(b.date)) return bad('Data inválida.');
  if (b.paid !== undefined && (typeof b.paid !== 'boolean' || t.card_id))
    return bad('Compras no cartão são quitadas pela fatura.');
  if ('category_id' in b && b.category_id &&
      !(isUuid(b.category_id) && (await owns.category(sql, b.category_id, uid)))) return bad('Categoria inválida.');
  if ('account_id' in b && (t.card_id ||
      (b.account_id && !(isUuid(b.account_id) && (await owns.account(sql, b.account_id, uid))))))
    return bad('Conta inválida.');

  const next = {
    description: b.description?.trim() ?? t.description,
    amount_cents: b.amount_cents ?? t.amount_cents,
    date: b.date ?? t.date_s,
    category_id: 'category_id' in b ? b.category_id || null : t.category_id,
    account_id: 'account_id' in b ? b.account_id || null : t.account_id,
    paid: b.paid ?? t.paid,
  };
  const paidAt = next.paid === t.paid
    ? (t.paid_at ? new Date(t.paid_at).toISOString() : null)
    : next.paid ? new Date().toISOString() : null;
  const invoiceId = t.card_id && next.date !== t.date_s
    ? await ensureInvoice(sql, uid, t.card_id, invoiceRefMonth(next.date, t.closing_day, t.due_day))
    : t.invoice_id;

  await sql`
    update transactions set description = ${next.description}, amount_cents = ${next.amount_cents},
      date = ${next.date}, category_id = ${next.category_id}, account_id = ${next.account_id},
      paid = ${next.paid}, paid_at = ${paidAt}, invoice_id = ${invoiceId}
    where id = ${params.id} and user_id = ${uid}`;
  return json({ ok: true });
}

// scope=group: todas as parcelas · scope=future: encerra a recorrência daqui para frente.
export async function onRequestDelete({ request, env, data, params }) {
  if (!isUuid(params.id)) return notFound();
  const uid = data.userId;
  const scope = new URL(request.url).searchParams.get('scope');
  const sql = db(env);
  const [t] = await sql`
    select date::text as date_s, installment_group, recurrence_id
    from transactions where id = ${params.id} and user_id = ${uid}`;
  if (!t) return notFound();

  if (t.recurrence_id) {
    if (scope !== 'future') return json({ error: 'Lançamento recorrente: encerre a recorrência daqui para frente.' }, 409);
    await sql.transaction([
      sql`update recurrences set end_date = ${t.date_s}::date - 1,
            active = (${t.date_s}::date - 1) >= start_date
          where id = ${t.recurrence_id} and user_id = ${uid}`,
      sql`delete from transactions
          where recurrence_id = ${t.recurrence_id} and user_id = ${uid} and date >= ${t.date_s}::date`,
    ]);
  } else if (scope === 'group' && t.installment_group) {
    await sql`delete from transactions where installment_group = ${t.installment_group} and user_id = ${uid}`;
  } else {
    await sql`delete from transactions where id = ${params.id} and user_id = ${uid}`;
  }
  return json({ ok: true });
}
