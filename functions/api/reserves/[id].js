import { json } from '../../_lib/http.js';
import { isUuid } from '../../_lib/validate.js';
import { db, bad, readBody, isInt, isDate, isColor, cleanText } from '../../_lib/p3.js';

async function load(sql, userId, id) {
  const [r] = await sql`
    SELECT r.id, r.name, r.goal_cents::text AS goal_cents, r.target_date::text AS target_date,
           r.color, r.archived,
           (SELECT COALESCE(SUM(amount_cents), 0) FROM reserve_entries
             WHERE reserve_id = r.id AND user_id = r.user_id)::text AS balance_cents
    FROM reserves r WHERE r.id = ${id}::uuid AND r.user_id = ${userId}::uuid`;
  return r;
}

export async function onRequestGet({ env, data, params }) {
  if (!isUuid(params.id)) return bad('Id inválido');
  const sql = db(env);
  const reserve = await load(sql, data.userId, params.id);
  if (!reserve) return bad('Reserva não encontrada', 404);
  const entries = await sql`
    SELECT id, amount_cents::text AS amount_cents, date::text AS date, note
    FROM reserve_entries
    WHERE reserve_id = ${params.id}::uuid AND user_id = ${data.userId}::uuid
    ORDER BY date DESC, created_at DESC LIMIT 200`;
  return json({ reserve, entries });
}

export async function onRequestPatch({ request, env, data, params }) {
  if (!isUuid(params.id)) return bad('Id inválido');
  const b = await readBody(request);
  if (!b) return bad('JSON inválido');
  const sql = db(env);
  const cur = await load(sql, data.userId, params.id);
  if (!cur) return bad('Reserva não encontrada', 404);

  let name = cur.name;
  if ('name' in b) { name = cleanText(b.name, 60); if (!name) return bad('Nome inválido'); }
  let goal = cur.goal_cents;
  if ('goal_cents' in b) {
    goal = b.goal_cents === '' ? null : b.goal_cents;
    if (goal !== null && (!isInt(goal) || goal <= 0)) return bad('Meta inválida');
  }
  let target = cur.target_date;
  if ('target_date' in b) {
    target = b.target_date || null;
    if (target !== null && !isDate(target)) return bad('Data inválida');
  }
  let color = cur.color;
  if ('color' in b) {
    color = b.color || null;
    if (color !== null && !isColor(color)) return bad('Cor inválida');
  }
  const archived = 'archived' in b ? !!b.archived : cur.archived;

  await sql`
    UPDATE reserves SET name = ${name}, goal_cents = ${goal}::bigint, target_date = ${target}::date,
           color = ${color}, archived = ${archived}
    WHERE id = ${params.id}::uuid AND user_id = ${data.userId}::uuid`;
  return json({ reserve: await load(sql, data.userId, params.id) });
}

export async function onRequestDelete({ env, data, params }) {
  if (!isUuid(params.id)) return bad('Id inválido');
  const sql = db(env);
  const rows = await sql`
    DELETE FROM reserves WHERE id = ${params.id}::uuid AND user_id = ${data.userId}::uuid RETURNING id`;
  if (!rows.length) return bad('Reserva não encontrada', 404);
  return json({ ok: true });
}
