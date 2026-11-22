import { db } from '~~/server/db';
import { goalProgress } from '~~/server/db/schema';
import { listGoals, publicGoalList } from '~~/server/utils/goals';

export default defineEventHandler(async () => {
  const goals = await listGoals(false);
  try {
    const rows = await db.select().from(goalProgress);
    const known = new Set(goals.map((goal) => goal.id));

    return {
      goals: publicGoalList(goals),
      progress: rows
        .filter((row) => known.has(row.goalId))
        .map((row) => ({
          className: row.className,
          goalId: row.goalId,
          completed: row.completed,
          completedAt: row.completedAt ?? null,
        })),
    };
  } catch (error) {
    console.warn('[roulette] goal progress unavailable:', error);
    return {
      goals: publicGoalList(goals),
      progress: [],
    };
  }
});
