import { requireRole } from '~~/server/utils/auth';
import { resetClassPools } from '~~/server/utils/classes';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin');
  try {
    const classes = await resetClassPools();
    return { classes };
  } catch (error) {
    console.warn('[admin] could not restore class pools:', error);
    setResponseStatus(event, 500);
    return { error: 'The class pools could not be restored.' };
  }
});
