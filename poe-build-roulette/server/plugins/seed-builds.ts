import { eq } from 'drizzle-orm';
import { db } from '~~/server/db';
import { appSettings, buildCombos } from '~~/server/db/schema';
import { LEAGUE, META_COMBOS } from '~~/server/utils/meta';

const BUILD_SNAPSHOT_VERSION_KEY = 'build_snapshot_version';
const BUILD_SNAPSHOT_VERSION = 'covens-ssf-0.3-2026-11-22';

/**
 * Replace the local pairing snapshot when the bundled poe.ninja data changes.
 * Existing admin edits to classes remain separate from these raw pairings.
 */
export default defineNitroPlugin(async () => {
  try {
    const [marker] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, BUILD_SNAPSHOT_VERSION_KEY))
      .limit(1);
    if (marker?.value === BUILD_SNAPSHOT_VERSION) return;

    await db.delete(buildCombos).where(eq(buildCombos.league, LEAGUE));
    for (let index = 0; index < META_COMBOS.length; index += 80) {
      await db.insert(buildCombos).values(META_COMBOS.slice(index, index + 80));
    }

    await db.delete(appSettings).where(eq(appSettings.key, BUILD_SNAPSHOT_VERSION_KEY));
    await db.insert(appSettings).values({
      key: BUILD_SNAPSHOT_VERSION_KEY,
      value: BUILD_SNAPSHOT_VERSION,
      updatedAt: new Date().toISOString(),
    });
    console.log(`[roulette] seeded ${META_COMBOS.length} poe.ninja pairings`);
  } catch (error) {
    console.warn('[roulette] could not seed verified pairings:', error);
  }
});
