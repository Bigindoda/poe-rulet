import { and, eq } from 'drizzle-orm';
import { db } from '~~/server/db';
import { goalProgress } from '~~/server/db/schema';
import { getGoalById } from '~~/server/utils/goals';
import { isCharacterClass } from '~~/server/utils/meta';

type GoalBody = {
  className?: string;
  goalId?: string;
  completed?: boolean;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<GoalBody>(event);
  const goal = await getGoalById(body?.goalId);
  if (!goal) {
    setResponseStatus(event, 400);
    return { error: 'Unknown target.' };
  }
  if (!isCharacterClass(body?.className)) {
    setResponseStatus(event, 400);
    return { error: 'Choose a class before ticking off a target.' };
  }

  const className = body.className;
  const completed = Boolean(body.completed);
  const completedAt = completed ? new Date().toISOString() : null;

  try {
    await db
      .delete(goalProgress)
      .where(and(eq(goalProgress.className, className), eq(goalProgress.goalId, goal.id)));

    await db.insert(goalProgress).values({
      className,
      goalId: goal.id,
      completed,
      completedAt,
    });

    return {
      progress: {
        className,
        goalId: goal.id,
        completed,
        completedAt,
      },
    };
  } catch (error) {
    console.warn('[roulette] could not update target:', error);
    setResponseStatus(event, 500);
    return { error: 'The hit list could not be updated.' };
  }
});
