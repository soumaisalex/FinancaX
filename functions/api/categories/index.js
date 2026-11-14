import { bad, json, readJson } from '../../_lib/http.js';
import { db } from '../../_lib/users.js';
import { isText } from '../../_lib/validate.js';

export async function onRequestGet({ env, data }) {
  return json(await db(env)`
    select id, name, kind from categories where user_id = ${data.userId} order by kind, name`);
}

export async function onRequestPost({ request, env, data }) {
  const b = await readJson(request);
  if (!isText(b.name, 40)) return bad('Informe o nome da categoria.');
  if (!['expense', 'income'].includes(b.kind)) return bad('Tipo inválido.');
  const [row] = await db(env)`
    insert into categories (user_id, name, kind) values (${data.userId}, ${b.name.trim()}, ${b.kind})
    returning id`;
  return json(row, 201);
}
