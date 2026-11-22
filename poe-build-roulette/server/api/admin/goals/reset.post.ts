import { requireRole } from '~~/server/utils/auth';
import { resetGoals } from '~~/server/utils/goals';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin');
  try {
    const goals = await resetGoals();
    return { goals };
  } catch (error) {
    console.warn('[admin] could not restore the default leaflet:', error);
    setResponseStatus(event, 500);
    return { error: 'The default leaflet could not be restored.' };
  }
});
