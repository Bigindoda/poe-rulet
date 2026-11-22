import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Local development and simple VPS deploys use a SQLite file next to the app.
// Serverless hosts such as Vercel cannot keep that file, so they set
// TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) to a remote libSQL database.
const url = process.env.TURSO_DATABASE_URL || 'file:sqlite.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

if (process.env.VERCEL && !process.env.TURSO_DATABASE_URL) {
  console.warn(
    '[db] TURSO_DATABASE_URL is not set. Vercel has no persistent local SQLite file; set it to a Turso/libSQL URL.',
  );
}

const client = createClient({
  url,
  ...(authToken ? { authToken } : {}),
});

export const db = drizzle(client, { schema });
