import { defineConfig } from 'drizzle-kit';

const remoteUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

const credentials = remoteUrl
  ? {
      dialect: 'turso' as const,
      dbCredentials: { url: remoteUrl, authToken },
    }
  : {
      dialect: 'sqlite' as const,
      dbCredentials: { url: 'file:sqlite.db' },
    };

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  ...credentials,
});
