-- Reservas/metas: cria se não existir e garante as colunas usadas pela API.
CREATE TABLE IF NOT EXISTS reserves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reserves ADD COLUMN IF NOT EXISTS goal_cents bigint;
ALTER TABLE reserves ADD COLUMN IF NOT EXISTS target_date date;
ALTER TABLE reserves ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE reserves ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS reserve_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reserve_id uuid NOT NULL REFERENCES reserves(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reserve_entries ADD COLUMN IF NOT EXISTS date date NOT NULL DEFAULT current_date;
ALTER TABLE reserve_entries ADD COLUMN IF NOT EXISTS note text;

CREATE INDEX IF NOT EXISTS reserves_user_idx ON reserves (user_id);
CREATE INDEX IF NOT EXISTS reserve_entries_reserve_idx ON reserve_entries (reserve_id, date DESC);
