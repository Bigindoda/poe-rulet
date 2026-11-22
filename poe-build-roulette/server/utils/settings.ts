import { eq } from 'drizzle-orm';
import { db } from '~~/server/db';
import { appSettings } from '~~/server/db/schema';

export const POE_NINJA_FILTER_KEY = 'poe_ninja_filter';

/** The gate is on unless the keeper has explicitly switched it off. */
export async function getPoeNinjaFilterEnabled(): Promise<boolean> {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, POE_NINJA_FILTER_KEY))
      .limit(1);
    return row ? row.value !== 'false' : true;
  } catch (error) {
    console.warn('[settings] could not read the PoE.ninja gate:', error);
    return true;
  }
}

export async function setPoeNinjaFilterEnabled(enabled: boolean): Promise<boolean> {
  const value = enabled ? 'true' : 'false';
  await db
    .delete(appSettings)
    .where(eq(appSettings.key, POE_NINJA_FILTER_KEY));
  await db.insert(appSettings).values({
    key: POE_NINJA_FILTER_KEY,
    value,
    updatedAt: new Date().toISOString(),
  });
  return enabled;
}
