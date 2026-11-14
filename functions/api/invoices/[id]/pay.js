import { bad, json, notFound, readJson } from '../../../_lib/http.js';
import { owns } from '../../../_lib/own.js';
import { db } from '../../../_lib/users.js';
import { isUuid } from '../../../_lib/validate.js';

// { paid: true, account_id } paga a fatura (debita a conta); { paid: false } desfaz.
export async function onRequestPost({ request, env, data, params }) {
  if (!isUuid(params.id)) return notFound();
  const b = await readJson(request);
  const sql = db(env);
  const uid = data.userId;

  if (b.paid === false) {
    const [r] = await sql`
      update invoices set paid_at = null, paid_account_id = null
      where id = ${params.id} and user_id = ${uid} returning id`;
    return r ? json({ ok: true }) : notFound();
  }
  if (!isUuid(b.account_id) || !(await owns.account(sql, b.account_id, uid)))
    return bad('Escolha a conta do pagamento.');
  const [r] = await sql`
    update invoices set paid_at = now(), paid_account_id = ${b.account_id}
    where id = ${params.id} and user_id = ${uid} returning id`;
  return r ? json({ ok: true }) : notFound();
}
