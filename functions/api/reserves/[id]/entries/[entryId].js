import { json } from '../../../../_lib/http.js';
import { isUuid } from '../../../../_lib/validate.js';
import { db, bad } from '../../../../_lib/p3.js';

export async function onRequestDelete({ env, data, params }) {
  if (!isUuid(params.id) || !isUuid(params.entryId)) return bad('Id inválido');
  const sql = db(env);
  const [r] = await sql`
    SELECT COALESCE(SUM(amount_cents), 0)::text AS bal,
           (SELECT amount_cents FROM reserve_entries
             WHERE id = ${params.entryId}::uuid AND reserve_id = ${params.id}::uuid
               AND user_id = ${data.userId}::uuid)::text AS amt
    FROM reserve_entries WHERE reserve_id = ${params.id}::uuid AND user_id = ${data.userId}::uuid`;
  if (r.amt == null) return bad('Lançamento não encontrado', 404);
  if (Number(r.bal) - Number(r.amt) < 0) return bad('Remover deixaria o saldo negativo');
  await sql`
    DELETE FROM reserve_entries
    WHERE id = ${params.entryId}::uuid AND reserve_id = ${params.id}::uuid AND user_id = ${data.userId}::uuid`;
  return json({ ok: true });
}
