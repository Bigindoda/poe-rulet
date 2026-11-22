import { seedDefaultClasses, syncDefaultClassPools } from '~~/server/utils/classes';

/** Add missing base-class rows once, then apply the current poe.ninja snapshot. */
export default defineNitroPlugin(async () => {
  try {
    const seeded = await seedDefaultClasses();
    if (seeded > 0) {
      console.log(`[roulette] seeded ${seeded} editable class pools`);
    }
    const synced = await syncDefaultClassPools();
    if (synced > 0) {
      console.log(`[roulette] synced ${synced} class pools from poe.ninja`);
    }
  } catch (error) {
    console.warn('[roulette] could not seed class pools:', error);
  }
});
