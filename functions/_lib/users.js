import { neon } from '@neondatabase/serverless';

export const db = (env) => neon(env.DATABASE_URL);

async function seedCategories(sql, userId) {
  await sql`
    insert into categories (user_id, name, kind)
    select ${userId}::uuid, n, k from (values
      ('Moradia','expense'), ('Alimentação','expense'), ('Transporte','expense'),
      ('Saúde','expense'), ('Lazer','expense'), ('Educação','expense'),
      ('Assinaturas','expense'), ('Outros','expense'),
      ('Salário','income'), ('Outros','income')
    ) as v(n, k)
    on conflict do nothing`;
}

// Identifica por (provider, sub). Se o email verificado já existir, vincula à conta existente.
export async function upsertOAuthUser(env, provider, { sub, email, name, picture }) {
  const sql = db(env);
  const [found] = await sql`
    select user_id from auth_identities
    where provider = ${provider} and provider_user_id = ${sub}`;
  if (found) return found.user_id;

  const [user] = await sql`
    insert into users (email, name, avatar_url)
    values (${email.toLowerCase()}, ${name || email}, ${picture || null})
    on conflict (email) do update set email = excluded.email
    returning id, (xmax = 0) as inserted`;
  await sql`
    insert into auth_identities (user_id, provider, provider_user_id)
    values (${user.id}, ${provider}, ${sub})
    on conflict do nothing`;
  if (user.inserted) await seedCategories(sql, user.id);
  return user.id;
}
