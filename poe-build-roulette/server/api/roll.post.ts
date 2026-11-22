import { rollAscendancy, rollClass, rollSkill } from '~~/server/utils/roulette';
import { parseMode } from '~~/server/utils/modes';

type RollBody = {
  stage?: 'class' | 'skill' | 'ascendancy';
  mode?: string;
  className?: string;
  mainSkill?: string;
  goal?: string;
  exclude?: string[];
  rerollsUsed?: number;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<RollBody>(event);
  const stage = body?.stage;
  const mode = parseMode(body?.mode);
  const exclude = Array.isArray(body?.exclude)
    ? body.exclude.filter((value): value is string => typeof value === 'string').slice(0, 12)
    : [];
  const goalId = typeof body?.goal === 'string' ? body.goal : undefined;

  if (stage !== 'class' && stage !== 'skill' && stage !== 'ascendancy') {
    setResponseStatus(event, 400);
    return { error: 'Unknown roulette stage.' };
  }

  try {
    if (stage === 'class') {
      return await rollClass(exclude, mode);
    }

    if (!body?.className || typeof body.className !== 'string') {
      setResponseStatus(event, 400);
      return { error: 'A class is required before rolling a skill.' };
    }

    if (stage === 'skill') {
      return await rollSkill(body.className, exclude, goalId, mode);
    }

    if (!body.mainSkill || typeof body.mainSkill !== 'string') {
      setResponseStatus(event, 400);
      return { error: 'A main skill is required before rolling an ascendancy.' };
    }

    return await rollAscendancy(body.className, body.mainSkill, exclude, goalId, mode);
  } catch (error) {
    setResponseStatus(event, 400);
    return { error: error instanceof Error ? error.message : 'The coven refused this roll.' };
  }
});
