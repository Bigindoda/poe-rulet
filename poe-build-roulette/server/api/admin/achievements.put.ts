import { requireRole } from '~~/server/utils/auth';
import {
  updateAchievement,
  validateAchievementPayload,
} from '~~/server/utils/achievements';
import { getClassByName } from '~~/server/utils/classes';
import { getGoalById } from '~~/server/utils/goals';

type AchievementBody = {
  className?: string;
  goalId?: string;
  title?: string;
  description?: string;
  tier?: string;
  sigil?: string;
  active?: boolean;
};

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin');
  const body = await readBody<AchievementBody>(event);
  const className = typeof body?.className === 'string' ? body.className : '';
  const goalId = typeof body?.goalId === 'string' ? body.goalId : '';

  const [entry, goal] = await Promise.all([
    getClassByName(className),
    getGoalById(goalId),
  ]);
  if (!entry || !goal) {
    setResponseStatus(event, 404);
    return { error: 'That class or target does not exist.' };
  }

  const validated = validateAchievementPayload(body as Record<string, unknown>);
  if (!validated.ok) {
    setResponseStatus(event, 400);
    return { error: validated.error };
  }

  try {
    const board = await updateAchievement(entry.name, goal.id, validated.fields);
    return board;
  } catch (error) {
    console.warn('[admin] could not update the deed:', error);
    setResponseStatus(event, 500);
    return { error: 'The deed could not be saved.' };
  }
});
