import { requireRole } from '~~/server/utils/auth';
import { resetAchievements } from '~~/server/utils/achievements';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin');
  try {
    return await resetAchievements();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'The deeds could not be restored.';
    setResponseStatus(event, 500);
    return { error: message };
  }
});
