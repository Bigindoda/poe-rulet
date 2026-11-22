import { requireRole } from '~~/server/utils/auth';
import { deleteGoal, getGoalById } from '~~/server/utils/goals';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin');
  const id = getRouterParam(event, 'id') ?? '';
  const existing = await getGoalById(id);
  if (!existing) {
    setResponseStatus(event, 404);
    return { error: 'That target no longer exists.' };
  }

  try {
    const goals = await deleteGoal(id);
    return { goals };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The target could not be deleted.';
    setResponseStatus(event, message.startsWith('The leaflet') ? 400 : 500);
    return { error: message };
  }
});
