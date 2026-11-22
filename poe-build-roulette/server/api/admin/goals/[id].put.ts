import { requireRole } from '~~/server/utils/auth';
import { getGoalById, updateGoal, validateGoalPayload } from '~~/server/utils/goals';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin');
  const id = getRouterParam(event, 'id') ?? '';
  const existing = await getGoalById(id);
  if (!existing) {
    setResponseStatus(event, 404);
    return { error: 'That target no longer exists.' };
  }

  const body = await readBody<Record<string, unknown>>(event);
  const validated = validateGoalPayload(body);
  if (!validated.ok) {
    setResponseStatus(event, 400);
    return { error: validated.error };
  }

  try {
    const goals = await updateGoal(id, validated.fields);
    return { goals };
  } catch (error) {
    console.warn('[admin] could not update the target:', error);
    setResponseStatus(event, 500);
    return { error: 'The target could not be saved.' };
  }
});
