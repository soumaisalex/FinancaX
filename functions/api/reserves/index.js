import { json } from '../../_lib/http.js';
import { db, bad, readBody, isInt, isDate, isColor, cleanText } from '../../_lib/p3.js';

export async function onRequestGet({ env, data }) {
  const sql = db(env);
  const rows = await sql`
    SELECT r.id, r.name, r.goal_cents::text AS goal_cents, r.target_date::text AS target_date,
           r.color, COALESCE(SUM(e.amount_cents), 0)::text AS balance_cents
    FROM reserves r
    LEFT JOIN reserve_entries e ON e.reserve_id = r.id AND e.user_id = r.user_id
    WHERE r.user_id = ${data.userId}::uuid AND NOT r.archived
    GROUP BY r.id
    ORDER BY r.created_at`;
  return json({ reserves: rows });
}

export async function onRequestPost({ request, env, data }) {
  const b = await readBody(request);
  if (!b) return bad('JSON inválido');
  const name = cleanText(b.name, 60);
  if (!name) return bad('Nome obrigatório (até 60 caracteres)');
  const goal = b.goal_cents == null || b.goal_cents === '' ? null : b.goal_cents;
  if (goal !== null && (!isInt(goal) || goal <= 0)) return bad('Meta inválida');
  const target = b.target_date || null;
  if (target !== null && !isDate(target)) return bad('Data inválida');
  const color = b.color || null;
  if (color !== null && !isColor(color)) return bad('Cor inválida');

  const sql = db(env);
  const [row] = await sql`
    INSERT INTO reserves (user_id, name, goal_cents, target_date, color)
    VALUES (${data.userId}::uuid, ${name}, ${goal}::bigint, ${target}::date, ${color})
    RETURNING id, name, goal_cents::text AS goal_cents, target_date::text AS target_date, color,
              '0'::text AS balance_cents`;
  return json({ reserve: row });
}
