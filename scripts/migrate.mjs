// Database setup for Railway Postgres.
//   npm run db:migrate  -> runs each db/migrations/*.sql file that hasn't run yet, in name order
//   npm run db:seed     -> loads Mario's clients from db/seed.sql (safe to run twice)
// DATABASE_URL comes from .env.local (locally) or from Railway's variables (when deployed).
import { readFileSync, readdirSync } from 'node:fs';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. Put the Railway DATABASE_PUBLIC_URL in .env.local as DATABASE_URL=...');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
} catch (err) {
  console.error(`Could not connect to the database: ${err.message}`);
  if (process.env.DATABASE_URL.includes('.railway.internal')) {
    console.error('That is Railway\'s internal address, which only works inside Railway. Use DATABASE_PUBLIC_URL in .env.local.');
  }
  process.exit(1);
}

try {
  if (process.argv.includes('--seed')) {
    await client.query(readFileSync('db/seed.sql', 'utf8'));
    console.log('Seed applied.');
  } else {
    // Remembers which files already ran, so each one runs exactly once per database.
    await client.query(
      'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
    );
    const { rows } = await client.query('select name from schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    const files = readdirSync('db/migrations').filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (done.has(file)) continue;
      // All or nothing: if the file fails halfway, none of it is kept.
      await client.query('begin');
      try {
        await client.query(readFileSync(`db/migrations/${file}`, 'utf8'));
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('commit');
        console.log(`Applied ${file}`);
      } catch (err) {
        await client.query('rollback');
        throw new Error(`${file} failed, nothing from it was saved: ${err.message}`);
      }
    }
    console.log('Database is up to date.');
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
