// checks: [[chave, limite], ...]
export async function allowed(sql, checks) {
  const rows = await sql`
    select key, fails from login_throttle
    where key = any(${checks.map((c) => c[0])}::text[]) and reset_at > now()`;
  return !rows.some((r) => r.fails >= checks.find((c) => c[0] === r.key)[1]);
}

export async function recordFail(sql, keys) {
  await sql`
    insert into login_throttle (key, fails, reset_at)
    select k, 1, now() + interval '15 minutes' from unnest(${keys}::text[]) as k
    on conflict (key) do update set
      fails = case when login_throttle.reset_at <= now() then 1 else login_throttle.fails + 1 end,
      reset_at = case when login_throttle.reset_at <= now()
        then now() + interval '15 minutes' else login_throttle.reset_at end`;
}

export const clearFails = (sql, keys) =>
  sql`delete from login_throttle where key = any(${keys}::text[])`;
