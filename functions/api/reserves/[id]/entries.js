import { json } from '../../../_lib/http.js';
import { isUuid } from '../../../_lib/validate.js';
import { db, bad, readBody, isInt, isDate } from '../../../_lib/p3.js';

// amount_cents > 0 = aporte; < 0 = resgate (não pode deixar o saldo negativo)
export async function onRequestPost({ request, env, data, params }) {
  if (!isUuid(params.id)) return bad('Id inválido');
  const b = await readBody(request);
  if (!b) return bad('JSON inválido');
  if (!isInt(b.amount_cents) || b.amount_cents === 0) return bad('Valor inválido');
  const date = b.date || null;
  if (date !== null && !isDate(date)) return bad('Data inválida');
  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 200) : null;

  const sql = db(env);
  const own = await sql`
    SELECT 1 FROM reserves WHERE id = ${params.id}::uuid AND user_id = ${data.userId}::uuid`;
  if (!own.length) return bad('Reserva não encontrada', 404);

  const rows = await sql`
    INSERT INTO reserve_entries (user_id, reserve_id, amount_cents, date, note)
    SELECT ${data.userId}::uuid, ${params.id}::uuid, ${b.amount_cents}::bigint,
           COALESCE(${date}::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date), ${note}
    WHERE (SELECT COALESCE(SUM(amount_cents), 0) FROM reserve_entries
            WHERE reserve_id = ${params.id}::uuid AND user_id = ${data.userId}::uuid)
          + ${b.amount_cents}::bigint >= 0
    RETURNING id, amount_cents::text AS amount_cents, date::text AS date, note`;
  if (!rows.length) return bad('Saldo insuficiente na reserva');
  return json({ entry: rows[0] });
}
