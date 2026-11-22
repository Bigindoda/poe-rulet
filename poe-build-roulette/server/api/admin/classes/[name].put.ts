import { requireRole } from '~~/server/utils/auth';
import {
  getClassByName,
  updateClass,
  validateClassPayload,
} from '~~/server/utils/classes';
import { isCharacterClass } from '~~/server/utils/meta';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin');
  const name = getRouterParam(event, 'name') ?? '';
  if (!isCharacterClass(name)) {
    setResponseStatus(event, 404);
    return { error: 'That base class does not exist.' };
  }

  const existing = await getClassByName(name);
  if (!existing) {
    setResponseStatus(event, 404);
    return { error: 'That base class does not exist.' };
  }

  const body = await readBody<Record<string, unknown>>(event);
  const validated = validateClassPayload(name, body);
  if (!validated.ok) {
    setResponseStatus(event, 400);
    return { error: validated.error };
  }

  try {
    const classes = await updateClass(name, validated.fields);
    return { classes };
  } catch (error) {
    console.warn('[admin] could not update the class pool:', error);
    setResponseStatus(event, 500);
    return { error: 'The class pool could not be saved.' };
  }
});
