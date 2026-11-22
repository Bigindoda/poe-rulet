import { ensureAchievements } from '~~/server/utils/achievements';

/** Keep one editable deed for every class + target pair. */
export default defineNitroPlugin(async () => {
  try {
    const seeded = await ensureAchievements();
    if (seeded > 0) {
      console.log(`[roulette] seeded ${seeded} achievements`);
    }
  } catch (error) {
    console.warn('[roulette] could not seed achievements:', error);
  }
});
