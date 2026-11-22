import { requireRole } from '~~/server/utils/auth';
import { setPoeNinjaFilterEnabled } from '~~/server/utils/settings';

type SettingsBody = { poeNinjaFilter?: unknown };

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin');
  const body = await readBody<SettingsBody>(event);

  if (typeof body?.poeNinjaFilter !== 'boolean') {
    setResponseStatus(event, 400);
    return { error: 'The PoE.ninja switch needs a boolean value.' };
  }

  try {
    const poeNinjaFilter = await setPoeNinjaFilterEnabled(body.poeNinjaFilter);
    return { poeNinjaFilter };
  } catch (error) {
    console.warn('[admin] could not save the gate setting:', error);
    setResponseStatus(event, 500);
    return { error: 'The gate setting could not be saved.' };
  }
});
