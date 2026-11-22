import raw from '../assets/poe-covens-pools.json';
import type { Ascendancy, CharacterClass } from '~~/server/utils/meta';

export type PoESkillPath = {
  name: Ascendancy;
  count: number;
  percent: number;
};

export type PoESkillPoolEntry = {
  name: string;
  count: number;
  percent: number;
  ascendancies: PoESkillPath[];
};

type RawPool = {
  source: string;
  leagues: string[];
  thresholdPercent: number;
  capturedAt: string;
  ascendancyTotals: Record<string, number>;
  classes: Record<string, { total: number; skills: PoESkillPoolEntry[] }>;
};

const data = raw as RawPool;

export const POE_POOL_THRESHOLD = data.thresholdPercent;
export const POE_POOL_CAPTURED_AT = data.capturedAt;
export const POE_POOL_LEAGUES = data.leagues;

export const POE_CLASS_SKILLS: Record<CharacterClass, PoESkillPoolEntry[]> = Object.fromEntries(
  Object.entries(data.classes).map(([className, entry]) => [className, entry.skills]),
) as Record<CharacterClass, PoESkillPoolEntry[]>;

export const POE_CLASS_SKILL_POOLS: Record<CharacterClass, string[]> = Object.fromEntries(
  Object.entries(POE_CLASS_SKILLS).map(([className, skills]) => [
    className,
    skills.map((skill) => skill.name),
  ]),
) as Record<CharacterClass, string[]>;

export const POE_CLASS_TOTALS: Record<CharacterClass, number> = Object.fromEntries(
  Object.entries(data.classes).map(([className, entry]) => [className, entry.total]),
) as Record<CharacterClass, number>;

export const POE_ASCENDANCY_TOTALS: Record<Ascendancy, number> = Object.fromEntries(
  Object.entries(data.ascendancyTotals),
) as Record<Ascendancy, number>;

/** Usage stats for one class + main skill, or undefined when it is not in the pool. */
export function getPoolSkill(
  className: CharacterClass,
  skillName: string,
): PoESkillPoolEntry | undefined {
  return POE_CLASS_SKILLS[className]?.find((skill) => skill.name === skillName);
}
