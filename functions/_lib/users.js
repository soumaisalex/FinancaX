import { neon } from '@neondatabase/serverless';

export const db = (env) => neon(env.DATABASE_URL);

export async function seedCategories(sql, userId) {
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

// Identifica por (provider, sub). Se o email já existir, vincula à conta existente.
// O Google comprova a posse do email: se a conta era não verificada (cadastro por senha),
// a senha é removida e as sessões antigas são invalidadas (anti pré-sequestro de conta).
export async function upsertOAuthUser(env, provider, { sub, email, name, picture }) {
  const sql = db(env);
  const [found] = await sql`
    select i.user_id as id, u.token_version
    from auth_identities i join users u on u.id = i.user_id
    where i.provider = ${provider} and i.provider_user_id = ${sub}`;
  if (found) return { id: found.id, tokenVersion: found.token_version };

  const [user] = await sql`
    insert into users (email, name, avatar_url, email_verified)
    values (${email.toLowerCase()}, ${name || email}, ${picture || null}, true)
    on conflict (email) do update set
      email_verified = true,
      password_hash = case when users.email_verified then users.password_hash else null end,
      token_version = case when users.email_verified then users.token_version else users.token_version + 1 end
    returning id, token_version, (xmax = 0) as inserted`;
  await sql`
    insert into auth_identities (user_id, provider, provider_user_id)
    values (${user.id}, ${provider}, ${sub})
    on conflict do nothing`;
  if (user.inserted) await seedCategories(sql, user.id);
  return { id: user.id, tokenVersion: user.token_version };
}
