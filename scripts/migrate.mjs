import { readdirSync, readFileSync } from 'node:fs';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL ausente (.dev.vars)');

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(
  'create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())'
);
const done = new Set((await client.query('select name from _migrations')).rows.map((r) => r.name));

for (const file of readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) {
  if (done.has(file)) continue;
  console.log('aplicando', file);
  await client.query('begin');
  try {
    await client.query(readFileSync(`migrations/${file}`, 'utf8'));
    await client.query('insert into _migrations(name) values ($1)', [file]);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  }
}
await client.end();
console.log('ok');
