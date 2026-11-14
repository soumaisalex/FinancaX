alter table users
  add column password_hash text,
  add column email_verified boolean not null default false,
  add column token_version integer not null default 0;

-- Quem já entrou pelo Google teve o email verificado.
update users u set email_verified = true
where exists (select 1 from auth_identities i where i.user_id = u.id);

create table login_throttle (
  key text primary key,
  fails integer not null,
  reset_at timestamptz not null
);
