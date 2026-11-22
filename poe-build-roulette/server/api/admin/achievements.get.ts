import { requireRole } from '~~/server/utils/auth';
import { getAchievementBoard } from '~~/server/utils/achievements';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin');
  return await getAchievementBoard(true);
});
