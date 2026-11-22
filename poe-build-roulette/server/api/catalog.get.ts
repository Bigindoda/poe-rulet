import { getCatalog } from '~~/server/utils/roulette';

export default defineEventHandler(async () => {
  return await getCatalog();
});
