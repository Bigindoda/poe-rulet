import { desc } from 'drizzle-orm';
import { db } from '~~/server/db';
import { rollHistory } from '~~/server/db/schema';

export default defineEventHandler(async () => {
  try {
    const rows = await db
      .select()
      .from(rollHistory)
      .orderBy(desc(rollHistory.createdAt), desc(rollHistory.id))
      .limit(8);

    return { rolls: rows };
  } catch (error) {
    console.warn('[roulette] history unavailable:', error);
    return { rolls: [] };
  }
});
