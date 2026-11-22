import { requireRole } from '~~/server/utils/auth';
import { createGoal, listGoals, slugifyGoal, validateGoalPayload } from '~~/server/utils/goals';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin');
  const body = await readBody<Record<string, unknown>>(event);
  const validated = validateGoalPayload(body);
  if (!validated.ok) {
    setResponseStatus(event, 400);
    return { error: validated.error };
  }

  const requestedId = typeof body?.id === 'string' ? body.id : '';
  const id = slugifyGoal(requestedId || validated.fields.name);
  if (!id) {
    setResponseStatus(event, 400);
    return { error: 'The target needs a URL-safe id.' };
  }

  try {
    const existing = await listGoals(true);
    if (existing.some((goal) => goal.id === id)) {
      setResponseStatus(event, 409);
      return { error: 'A target with that id already exists.' };
    }

    const goals = await createGoal(id, validated.fields);
    return { goals };
  } catch (error) {
    console.warn('[admin] could not create the target:', error);
    setResponseStatus(event, 500);
    return { error: 'The target could not be created.' };
  }
});
