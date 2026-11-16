-- Limpeza: a versão anterior da 004 criou goal_cents por engano; a meta é reserves.target_cents.
ALTER TABLE reserves DROP COLUMN IF EXISTS goal_cents;
