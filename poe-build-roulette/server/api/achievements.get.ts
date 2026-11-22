import { getAchievementBoard } from '~~/server/utils/achievements';

export default defineEventHandler(async () => {
  try {
    return await getAchievementBoard(false);
  } catch (error) {
    console.warn('[achievements] could not load the board:', error);
    return {
      classes: [],
      goals: [],
      achievements: [],
      stats: { total: 0, claimed: 0, classes: 0, goals: 0 },
    };
  }
});
