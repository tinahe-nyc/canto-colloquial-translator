import { neon } from '@neondatabase/serverless';

function connection() {
  if (!process.env.DATABASE_URL) throw new Error('Practice log is not configured.');
  return neon(process.env.DATABASE_URL);
}

export async function recordPractice(language) {
  if (!['cantonese', 'mandarin'].includes(language)) throw new Error('Unsupported language.');
  const sql = connection();
  const [entry] = await sql`INSERT INTO practice_sessions (language) VALUES (${language}) RETURNING id, language, created_at`;
  return entry;
}

export async function recentPractice() {
  const sql = connection();
  return sql`SELECT id, language, created_at FROM practice_sessions ORDER BY created_at DESC, id DESC LIMIT 10`;
}
