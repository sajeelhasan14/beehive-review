// Create a login. Prints a generated password once; send it to the person privately.
//   npm run user:create -- --role admin  --email mario@emrgmedia.com --name "Mario Stewart"
//   npm run user:create -- --role client --email owner@kyma.com --name "Kyma Owner" --client kyma
// Uses the same hashing as the app (lib/auth/password.ts; Node runs .ts files directly).
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import pg from 'pg';
import { hashPassword } from '../lib/auth/password.ts';

const { values: args } = parseArgs({
  options: {
    role: { type: 'string' },
    email: { type: 'string' },
    name: { type: 'string' },
    client: { type: 'string' },
  },
});

const role = args.role;
const email = args.email?.trim().toLowerCase();
const name = args.name?.trim();

if (!['admin', 'client'].includes(role) || !email?.includes('@') || !name || (role === 'client' && !args.client)) {
  console.error('Usage: npm run user:create -- --role admin|client --email you@example.com --name "Full Name" [--client client-slug]');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env.local');
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

try {
  let clientId = null;
  if (role === 'client') {
    const { rows } = await db.query('select id from clients where slug = $1', [args.client]);
    if (!rows[0]) throw new Error(`No client with slug "${args.client}"`);
    clientId = rows[0].id;
  }

  const password = randomBytes(12).toString('base64url'); // 16 random characters
  await db.query(
    'insert into users (email, name, password_hash, role, client_id) values ($1, $2, $3, $4, $5)',
    [email, name, await hashPassword(password), role, clientId],
  );

  console.log(`Created ${role} login`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log('Shown once. Save it or send it privately now.');
} catch (err) {
  console.error(err.code === '23505' ? `A login for ${email} already exists.` : err.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
