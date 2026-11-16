-- Reservas: colunas extras sobre a tabela criada na 001 (reserves.target_cents já existe).
ALTER TABLE reserves ADD COLUMN IF NOT EXISTS target_date date;
ALTER TABLE reserves ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE reserves ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE reserve_entries ADD COLUMN IF NOT EXISTS note text;
CREATE INDEX IF NOT EXISTS reserve_entries_reserve_date_idx ON reserve_entries (reserve_id, date DESC);
