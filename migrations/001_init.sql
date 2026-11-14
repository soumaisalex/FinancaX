-- Valores monetários sempre em centavos (bigint).
-- Todo dado de domínio pertence a um user_id; a API sempre filtra por ele.

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  avatar_url text,
  monthly_income_cents bigint not null default 0 check (monthly_income_cents >= 0),
  created_at timestamptz not null default now()
);

create table auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);
create index on auth_identities (user_id);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  type text not null default 'checking' check (type in ('checking','savings','cash','wallet')),
  initial_balance_cents bigint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index on accounts (user_id);

create table credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  brand text,
  color text,
  limit_cents bigint not null default 0 check (limit_cents >= 0),
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index on credit_cards (user_id);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense','income')),
  color text,
  unique (user_id, kind, name)
);

-- Fatura = cartão + mês de referência (sempre dia 1 do mês de vencimento).
create table invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  card_id uuid not null references credit_cards(id) on delete cascade,
  ref_month date not null check (extract(day from ref_month) = 1),
  paid_at timestamptz,
  paid_account_id uuid references accounts(id) on delete set null,
  unique (card_id, ref_month)
);
create index on invoices (user_id, ref_month);

create table recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  description text not null,
  kind text not null check (kind in ('expense','income')),
  amount_cents bigint not null check (amount_cents > 0),
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  card_id uuid references credit_cards(id) on delete set null,
  day_of_month smallint not null check (day_of_month between 1 and 31),
  start_date date not null,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (not (account_id is not null and card_id is not null))
);
create index on recurrences (user_id, active);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('expense','income')),
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  date date not null,                 -- data da compra / competência
  due_date date,                      -- vencimento (contas a pagar); cartão usa a fatura
  paid boolean not null default false,
  paid_at timestamptz,
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  card_id uuid references credit_cards(id) on delete set null,
  invoice_id uuid references invoices(id) on delete set null,
  installment_group uuid,
  installment_no smallint,
  installment_total smallint,
  recurrence_id uuid references recurrences(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  check (not (account_id is not null and card_id is not null))
);
create index on transactions (user_id, date);
create index on transactions (user_id, due_date) where due_date is not null;
create index on transactions (invoice_id);
create index on transactions (installment_group) where installment_group is not null;

create table reserves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  target_cents bigint check (target_cents is null or target_cents > 0),
  created_at timestamptz not null default now()
);
create index on reserves (user_id);

create table reserve_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  reserve_id uuid not null references reserves(id) on delete cascade,
  amount_cents bigint not null check (amount_cents <> 0), -- positivo = guardou, negativo = resgatou
  date date not null default current_date,
  created_at timestamptz not null default now()
);
create index on reserve_entries (reserve_id);
