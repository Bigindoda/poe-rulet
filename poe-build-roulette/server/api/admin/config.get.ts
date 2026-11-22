import { count } from 'drizzle-orm';
import { db } from '~~/server/db';
import { rollHistory } from '~~/server/db/schema';
import { listAdminClasses } from '~~/server/utils/classes';
import { listGoals } from '~~/server/utils/goals';
import { requireRole } from '~~/server/utils/auth';
import { MATCH_GATE } from '~~/server/utils/meta';
import { getPoeNinjaFilterEnabled } from '~~/server/utils/settings';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin');

  const [goals, classes, poeNinjaFilter] = await Promise.all([
    listGoals(true),
    listAdminClasses(),
    getPoeNinjaFilterEnabled(),
  ]);
  const [rolls] = await db.select({ total: count() }).from(rollHistory);

  return {
    goals,
    classes,
    settings: { poeNinjaFilter },
    threshold: MATCH_GATE,
    stats: {
      goals: goals.length,
      activeGoals: goals.filter((goal) => goal.active).length,
      classes: classes.length,
      activeClasses: classes.filter((entry) => entry.active).length,
      skills: new Set(classes.flatMap((entry) => entry.skills)).size,
      rolls: rolls?.total ?? 0,
    },
  };
});
