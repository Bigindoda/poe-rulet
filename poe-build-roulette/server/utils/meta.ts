import {
  POE_ASCENDANCY_TOTALS,
  POE_CLASS_SKILLS,
  POE_CLASS_SKILL_POOLS,
  POE_CLASS_TOTALS,
  POE_POOL_CAPTURED_AT,
  POE_POOL_THRESHOLD,
} from '~~/server/utils/poe-pools';

export type Ascendancy =
  | 'Slayer'
  | 'Gladiator'
  | 'Champion'
  | 'Juggernaut'
  | 'Berserker'
  | 'Chieftain'
  | 'Warden'
  | 'Deadeye'
  | 'Pathfinder'
  | 'Assassin'
  | 'Trickster'
  | 'Saboteur'
  | 'Inquisitor'
  | 'Hierophant'
  | 'Guardian'
  | 'Occultist'
  | 'Elementalist'
  | 'Necromancer'
  | 'Ascendant'
  | 'Reliquarian'
  | 'Luminary';

export const LEAGUE = 'Covens';
export const LEAGUE_DATA_LABEL = 'Covens + SSF Covens';
export const LEAGUE_LABEL = 'Covens of Umbra';
export const PATCH = '3.30';
export const MATCH_GATE = POE_POOL_THRESHOLD;
export const SNAPSHOT_AT = POE_POOL_CAPTURED_AT;

export type GoalId = string;

export type GoalCategory = 'ELDRITCH' | 'ATLAS';

export type GoalDefinition = {
  id: GoalId;
  name: string;
  category: GoalCategory;
  tagline: string;
  tip: string;
};

// Curated target lists. Targets define the challenge and the tracker; the
// actual main-skill pool belongs to the base class and is edited in admin.
export const GOALS: GoalDefinition[] = [
  {
    id: 'infinite-hunger',
    name: 'Infinite Hunger',
    category: 'ELDRITCH',
    tagline: 'The hunger below.',
    tip: 'Sustain and chaos resistance matter more than paper DPS.',
  },
  {
    id: 'eater-of-worlds',
    name: 'The Eater of Worlds',
    category: 'ELDRITCH',
    tagline: 'Cold beyond the stars.',
    tip: 'Cold mitigation and spell suppression carry the fight.',
  },
  {
    id: 'black-star',
    name: 'Black Star',
    category: 'ELDRITCH',
    tagline: 'A star that bites back.',
    tip: 'Keep moving; the floor is part of the boss.',
  },
  {
    id: 'searing-exarch',
    name: 'The Searing Exarch',
    category: 'ELDRITCH',
    tagline: 'The first flame.',
    tip: 'Fire mitigation, recovery, and a plan for the beams.',
  },
  {
    id: 'the-elder',
    name: 'The Elder',
    category: 'ATLAS',
    tagline: 'The dream that remembers.',
    tip: 'Single-target uptime and add control decide the fight.',
  },
  {
    id: 'maven',
    name: 'Maven',
    category: 'ATLAS',
    tagline: 'She has been watching.',
    tip: 'Burst windows, memory game, no greed.',
  },
];

export function publicGoal(goal: GoalDefinition) {
  return {
    id: goal.id,
    name: goal.name,
    category: goal.category,
    tagline: goal.tagline,
    tip: goal.tip,
  };
}

export type CharacterClass =
  | 'Duelist'
  | 'Marauder'
  | 'Ranger'
  | 'Shadow'
  | 'Templar'
  | 'Witch'
  | 'Scion';

export const CLASS_ASCENDANCIES: Record<CharacterClass, Ascendancy[]> = {
  Duelist: ['Slayer', 'Gladiator', 'Champion'],
  Marauder: ['Juggernaut', 'Berserker', 'Chieftain'],
  Ranger: ['Warden', 'Deadeye', 'Pathfinder'],
  Shadow: ['Assassin', 'Trickster', 'Saboteur'],
  Templar: ['Inquisitor', 'Hierophant', 'Guardian'],
  Witch: ['Occultist', 'Elementalist', 'Necromancer'],
  Scion: ['Ascendant', 'Reliquarian', 'Luminary'],
};

export const CLASS_ORDER: CharacterClass[] = [
  'Duelist',
  'Marauder',
  'Ranger',
  'Shadow',
  'Templar',
  'Witch',
  'Scion',
];

// Live class pools captured from poe.ninja's Main Skills category for
// Covens + SSF Covens at the 0.3% usage floor.
export const CLASS_SKILL_POOLS: Record<CharacterClass, string[]> = POE_CLASS_SKILL_POOLS;

export type MetaCombo = {
  league: string;
  className: CharacterClass;
  ascendancy: Ascendancy;
  mainSkill: string;
  matchFloor: number;
  ladderPopulation: number;
  source: string;
  verifiedAt: string;
};

export const META_COMBOS: MetaCombo[] = CLASS_ORDER.flatMap((className) =>
  (POE_CLASS_SKILLS[className] ?? []).flatMap((skill) =>
    skill.ascendancies.map((path) => ({
      league: LEAGUE,
      className,
      ascendancy: path.name,
      mainSkill: skill.name,
      matchFloor: skill.count,
      ladderPopulation: POE_CLASS_TOTALS[className],
      source: 'poe.ninja',
      verifiedAt: SNAPSHOT_AT,
    })),
  ),
);

export const ASCENDANCY_POPULATION: Record<Ascendancy, number> = POE_ASCENDANCY_TOTALS;

export const CLASS_POPULATION: Record<CharacterClass, number> = POE_CLASS_TOTALS;

export function poeNinjaProofUrl(ascendancy: string, mainSkill: string): string {
  const search = `class=${ascendancy}&skills=${mainSkill}`;
  const encoded = encodeURIComponent(search).replace(/%20/g, '+');
  return `https://poe.ninja/poe1/builds/covens?search=${encoded}`;
}

export function isCharacterClass(value: unknown): value is CharacterClass {
  return typeof value === 'string' && CLASS_ORDER.includes(value as CharacterClass);
}

export function isAscendancy(value: unknown): value is Ascendancy {
  return typeof value === 'string' && value in ASCENDANCY_POPULATION;
}
