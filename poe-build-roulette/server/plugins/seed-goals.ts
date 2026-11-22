import { seedDefaultGoals } from '~~/server/utils/goals';

/**
 * Fill the editable leaflet once. After seeding, the keeper's table is the
 * source of truth, so admin edits survive restarts.
 */
export default defineNitroPlugin(async () => {
  try {
    const seeded = await seedDefaultGoals();
    if (seeded > 0) {
      console.log(`[roulette] seeded ${seeded} editable targets`);
    }
  } catch (error) {
    console.warn('[roulette] could not seed targets:', error);
  }
});
