import { db } from '~~/server/db';
import { rollHistory } from '~~/server/db/schema';
import { LEAGUE } from '~~/server/utils/meta';
import { parseMode } from '~~/server/utils/modes';

type HistoryBody = {
  mode?: string;
  className?: string;
  ascendancy?: string;
  mainSkill?: string;
  goalId?: string;
  goalName?: string;
  matchFloor?: number;
  rerollsUsed?: number;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<HistoryBody>(event);
  if (
    !body?.className ||
    !body?.ascendancy ||
    !body?.mainSkill ||
    typeof body.className !== 'string' ||
    typeof body.ascendancy !== 'string' ||
    typeof body.mainSkill !== 'string'
  ) {
    setResponseStatus(event, 400);
    return { error: 'A completed build is required.' };
  }

  try {
    await db.insert(rollHistory).values({
      league: LEAGUE,
      mode: parseMode(body.mode),
      className: body.className.slice(0, 40),
      ascendancy: body.ascendancy.slice(0, 40),
      mainSkill: body.mainSkill.slice(0, 80),
      goalId: body.goalId?.slice(0, 40) ?? null,
      goalName: body.goalName?.slice(0, 80) ?? null,
      matchFloor: Math.max(0, Math.min(100, Number(body.matchFloor) || 0)),
      rerollsUsed: Math.min(3, Math.max(0, Number(body.rerollsUsed) || 0)),
    });
    return { ok: true };
  } catch (error) {
    console.warn('[roulette] could not record roll:', error);
    setResponseStatus(event, 500);
    return { error: 'The ledger could not be updated.' };
  }
});
