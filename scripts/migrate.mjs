import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.local first.');
const sql = neon(process.env.DATABASE_URL);
try {
  await sql.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  console.log('Practice log schema is ready.');
} catch {
  console.error('Migration failed. Check the selected Neon branch and database access.');
  process.exitCode = 1;
}
