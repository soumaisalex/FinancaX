import { bad, json, notFound, readJson } from '../../_lib/http.js';
import { db } from '../../_lib/users.js';
import { isText, isUuid } from '../../_lib/validate.js';

export async function onRequestPatch({ request, env, data, params }) {
  if (!isUuid(params.id)) return notFound();
  const b = await readJson(request);
  if (!isText(b.name, 40)) return bad('Nome inválido.');
  const [row] = await db(env)`
    update categories set name = ${b.name.trim()}
    where id = ${params.id} and user_id = ${data.userId} returning id`;
  return row ? json(row) : notFound();
}

// Lançamentos da categoria ficam sem categoria (FK on delete set null).
export async function onRequestDelete({ env, data, params }) {
  if (!isUuid(params.id)) return notFound();
  const [row] = await db(env)`
    delete from categories where id = ${params.id} and user_id = ${data.userId} returning id`;
  return row ? json({ deleted: true }) : notFound();
}
