import { eq } from 'drizzle-orm';
import { db } from '~~/server/db';
import { buildCombos } from '~~/server/db/schema';
import { getClassByName, listClasses, type StoredClass } from '~~/server/utils/classes';
import { getGoalById } from '~~/server/utils/goals';
import {
  ASCENDANCY_POPULATION,
  CLASS_ASCENDANCIES,
  CLASS_POPULATION,
  LEAGUE,
  MATCH_GATE,
  META_COMBOS,
  SNAPSHOT_AT,
  isCharacterClass,
  poeNinjaProofUrl,
  publicGoal,
  type Ascendancy,
  type CharacterClass,
} from '~~/server/utils/meta';
import { getPoeNinjaFilterEnabled } from '~~/server/utils/settings';
import type { RouletteMode } from '~~/server/utils/modes';
import {
  STREAMER_BUILDS,
  STREAMER_CAPTURED_AT,
  STREAMER_CLASSES,
  STREAMER_LEAGUES,
  STREAMER_NAMES,
  STREAMER_SKILL_COUNT,
  STREAMER_SOURCE_URL,
  publicStreamerBuild,
  streamerAscendanciesForPair,
  streamerBuildsForClass,
  streamerBuildsForPair,
  streamerSamples,
  streamerSkillsForClass,
  type StreamerBuild,
} from '~~/server/utils/streamers';

type ComboRow = {
  id?: number;
  league: string;
  className: string;
  ascendancy: string;
  mainSkill: string;
  matchFloor: number;
  ladderPopulation: number;
  source: string;
  verifiedAt: string;
};

export type Verification = {
  passed: boolean;
  threshold: number;
  floor: number | null;
  scope: string;
  source: string;
  league: string;
  checkedAt: string;
  snapshotAt: string;
  proofUrl: string | null;
  pairs?: number;
  filterEnabled: boolean;
  mode: RouletteMode;
};

const fallbackRows: ComboRow[] = META_COMBOS.map((combo, index) => ({ ...combo, id: index + 1 }));

type ComboPool = { rows: ComboRow[]; filterEnabled: boolean };

// Chaos ignores the captured class pools entirely. The union still only uses
// real Path of Exile main skills, so the reel never invents a skill name.
const ALL_SKILL_SET = new Set<string>();
for (const combo of META_COMBOS) ALL_SKILL_SET.add(combo.mainSkill);
for (const build of STREAMER_BUILDS) ALL_SKILL_SET.add(build.mainSkill);

export const ALL_SKILLS = [...ALL_SKILL_SET].sort((a, b) => a.localeCompare(b));

function comboUsagePercent(row: ComboRow): number {
  return row.ladderPopulation > 0 ? (row.matchFloor / row.ladderPopulation) * 100 : 0;
}

async function loadVerifiedCombos(): Promise<ComboPool> {
  const filterEnabled = await getPoeNinjaFilterEnabled();
  try {
    const rows = await db.select().from(buildCombos).where(eq(buildCombos.league, LEAGUE));
    if (rows.length > 0) {
      const pool = filterEnabled
        ? rows.filter((row) => comboUsagePercent(row) >= MATCH_GATE - 1e-9)
        : rows;
      if (pool.length > 0) return { rows: pool, filterEnabled };
    }
  } catch (error) {
    console.warn('[roulette] using bundled snapshot:', error);
  }
  return {
    rows: filterEnabled
      ? fallbackRows.filter((row) => comboUsagePercent(row) >= MATCH_GATE - 1e-9)
      : fallbackRows,
    filterEnabled,
  };
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function groupByClass(rows: ComboRow[]): Map<string, ComboRow[]> {
  const grouped = new Map<string, ComboRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.className) ?? [];
    list.push(row);
    grouped.set(row.className, list);
  }
  return grouped;
}

function groupBySkill(rows: ComboRow[]): Map<string, ComboRow[]> {
  const grouped = new Map<string, ComboRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.mainSkill) ?? [];
    list.push(row);
    grouped.set(row.mainSkill, list);
  }
  return grouped;
}

function pairRows(rows: ComboRow[], className: string, mainSkill: string): ComboRow[] {
  return rows.filter((row) => row.className === className && row.mainSkill === mainSkill);
}

function classRowsFor(rows: ComboRow[], classDef: StoredClass): ComboRow[] {
  const allowed = new Set(classDef.skills);
  return rows.filter((row) => row.className === classDef.name && allowed.has(row.mainSkill));
}

function uniquePairCount(rows: ComboRow[]): number {
  return unique(rows.map((row) => `${row.className}\u0000${row.mainSkill}`)).length;
}

function pairVerification(
  rows: ComboRow[],
  className: string,
  mainSkill: string,
  ascendancy?: string,
  filterEnabled = true,
  mode: RouletteMode = 'classic',
): Verification {
  const matching = pairRows(rows, className, mainSkill);
  const floor = matching.length
    ? Number(Math.max(...matching.map(comboUsagePercent)).toFixed(2))
    : null;
  return {
    passed: matching.length > 0 && (!filterEnabled || (floor ?? 0) >= MATCH_GATE - 1e-9),
    threshold: MATCH_GATE,
    floor,
    scope: 'class main skill',
    source: 'poe.ninja',
    league: LEAGUE,
    checkedAt: new Date().toISOString(),
    snapshotAt: SNAPSHOT_AT,
    proofUrl: ascendancy ? poeNinjaProofUrl(ascendancy, mainSkill) : null,
    pairs: uniquePairCount(matching),
    filterEnabled,
    mode,
  };
}

function unfilteredVerification(
  mode: Exclude<RouletteMode, 'classic'>,
  scope: string,
  pairs: number,
  proofUrl: string | null = null,
): Verification {
  return {
    passed: true,
    threshold: MATCH_GATE,
    floor: null,
    scope,
    source: mode === 'streamers' ? 'poe.ninja Streamers' : 'unfiltered',
    league: LEAGUE,
    checkedAt: new Date().toISOString(),
    snapshotAt: mode === 'streamers' ? STREAMER_CAPTURED_AT : SNAPSHOT_AT,
    proofUrl,
    pairs,
    filterEnabled: false,
    mode,
  };
}

export async function getCatalog() {
  const { rows, filterEnabled } = await loadVerifiedCombos();
  const definitions = await listClasses(false);
  const grouped = groupByClass(rows);

  const classes = definitions.map((definition) => {
    const classRows = classRowsFor(grouped.get(definition.name) ?? [], definition);
    const skills = [...groupBySkill(classRows).entries()].map(([name, skillRows]) => ({
      name,
      ascendancies: unique(skillRows.map((row) => row.ascendancy)).filter(Boolean),
    }));
    const streamerSkills = streamerSkillsForClass(definition.name);
    return {
      name: definition.name,
      population: CLASS_POPULATION[definition.name],
      skills,
      pairings: uniquePairCount(classRows),
      ascendancies: CLASS_ASCENDANCIES[definition.name],
      chaosSkillCount: ALL_SKILLS.length,
      streamerBuilds: streamerBuildsForClass(definition.name).length,
      streamerSkills,
    };
  });

  const activeRows = classes.flatMap((entry) => {
    const definition = definitions.find((item) => item.name === entry.name);
    return definition ? classRowsFor(grouped.get(definition.name) ?? [], definition) : [];
  });

  return {
    league: LEAGUE,
    threshold: MATCH_GATE,
    poeNinjaFilter: filterEnabled,
    snapshotAt: SNAPSHOT_AT,
    allSkills: ALL_SKILLS,
    classes,
    streamers: {
      capturedAt: STREAMER_CAPTURED_AT,
      sourceUrl: STREAMER_SOURCE_URL,
      leagues: STREAMER_LEAGUES,
      builds: STREAMER_BUILDS.length,
      streamers: STREAMER_NAMES.length,
      skills: STREAMER_SKILL_COUNT,
      classes: STREAMER_CLASSES,
      samples: streamerSamples(),
    },
    stats: {
      classes: classes.length,
      skills: unique(activeRows.map((row) => row.mainSkill)).length,
      ascendancies: unique(activeRows.map((row) => row.ascendancy)).length,
      pairings: uniquePairCount(activeRows),
      combinations: activeRows.length,
      ladderCharacters: classes.reduce(
        (sum, entry) => sum + CLASS_POPULATION[entry.name as CharacterClass],
        0,
      ),
      chaosSkills: ALL_SKILLS.length,
      streamerBuilds: STREAMER_BUILDS.length,
      streamerStreamers: STREAMER_NAMES.length,
      streamerSkills: STREAMER_SKILL_COUNT,
    },
  };
}

function chaosClassResult(className: CharacterClass): object {
  return {
    stage: 'class' as const,
    value: className,
    label: className,
    detail: `${ALL_SKILLS.length} skills · no class filter`,
    population: CLASS_POPULATION[className],
    ascendancies: CLASS_ASCENDANCIES[className],
    verification: unfilteredVerification('chaos', 'unfiltered class pool', ALL_SKILLS.length),
    mode: 'chaos' as const,
  };
}

function streamerClassResult(className: CharacterClass): object {
  const builds = streamerBuildsForClass(className);
  return {
    stage: 'class' as const,
    value: className,
    label: className,
    detail: `${builds.length} streamer build${builds.length === 1 ? '' : 's'} · ${streamerSkillsForClass(className).length} skills`,
    population: CLASS_POPULATION[className],
    ascendancies: unique(builds.map((build) => build.ascendancy)),
    verification: unfilteredVerification(
      'streamers',
      'streamer class',
      builds.length,
      STREAMER_SOURCE_URL,
    ),
    mode: 'streamers' as const,
  };
}

export async function rollClass(exclude: string[] = [], mode: RouletteMode = 'classic') {
  const definitions = await listClasses(false);
  if (definitions.length === 0) throw new Error('No classes are available for the roulette.');

  if (mode === 'streamers') {
    const activeClasses = new Set(definitions.map((definition) => definition.name));
    const knownBuilds = STREAMER_BUILDS.filter((build) => activeClasses.has(build.className));
    const candidates = knownBuilds.filter((build) => !exclude.includes(build.className));
    const pool = candidates.length > 0 ? candidates : knownBuilds;
    if (pool.length === 0) throw new Error('The Streamers tab has no complete builds.');
    const build = randomItem(pool);
    return streamerClassResult(build.className);
  }

  if (mode === 'chaos') {
    const options = definitions.map((definition) => definition.name);
    const filtered = options.filter((name) => !exclude.includes(name));
    const className = randomItem(filtered.length > 0 ? filtered : options) as CharacterClass;
    return chaosClassResult(className);
  }

  const { rows, filterEnabled } = await loadVerifiedCombos();
  const grouped = groupByClass(rows);
  const available = definitions.filter(
    (definition) => classRowsFor(grouped.get(definition.name) ?? [], definition).length > 0,
  );
  const options = available
    .map((definition) => definition.name)
    .filter((name) => !exclude.includes(name));
  const pool = options.length > 0 ? options : available.map((definition) => definition.name);
  if (pool.length === 0) throw new Error('No classes are available for the roulette.');

  const className = randomItem(pool) as CharacterClass;
  const definition = available.find((entry) => entry.name === className);
  const classRows = definition ? classRowsFor(grouped.get(className) ?? [], definition) : [];

  return {
    stage: 'class' as const,
    value: className,
    label: className,
    detail: `${uniquePairCount(classRows)} pre-checked skill pairings`,
    population: CLASS_POPULATION[className],
    ascendancies: CLASS_ASCENDANCIES[className],
    verification: {
      passed: classRows.length > 0,
      threshold: MATCH_GATE,
      floor: null,
      scope: 'class pool',
      source: 'poe.ninja',
      league: LEAGUE,
      checkedAt: new Date().toISOString(),
      snapshotAt: SNAPSHOT_AT,
      proofUrl: null,
      pairs: uniquePairCount(classRows),
      filterEnabled,
      mode: 'classic' as const,
    } satisfies Verification,
    mode: 'classic' as const,
  };
}

export async function rollSkill(
  className: string,
  exclude: string[] = [],
  goalId?: string,
  mode: RouletteMode = 'classic',
) {
  if (!isCharacterClass(className)) throw new Error('Unknown class');
  const definition = await getClassByName(className, false);
  if (!definition) throw new Error('This class is not available.');
  const goal = await getGoalById(goalId);

  if (mode === 'streamers') {
    const builds = streamerBuildsForClass(className);
    if (builds.length === 0) throw new Error('No streamer builds for this class.');

    const skills = unique(builds.map((build) => build.mainSkill));
    const options = skills.filter((skill) => !exclude.includes(skill));
    const mainSkill = randomItem(options.length > 0 ? options : skills);
    const matching = streamerBuildsForPair(className, mainSkill);
    const ascendancies = streamerAscendanciesForPair(className, mainSkill);
    const streamerCount = unique(matching.map((build) => build.streamer)).length;

    return {
      stage: 'skill' as const,
      value: mainSkill,
      label: mainSkill,
      detail: `${matching.length} streamer build${matching.length === 1 ? '' : 's'} · ${streamerCount} streamer${streamerCount === 1 ? '' : 's'}`,
      options: ascendancies,
      goal: goal ? publicGoal(goal) : null,
      verification: unfilteredVerification(
        'streamers',
        'streamer main skill',
        matching.length,
        STREAMER_SOURCE_URL,
      ),
      mode: 'streamers' as const,
    };
  }

  if (mode === 'chaos') {
    const options = ALL_SKILLS.filter((skill) => !exclude.includes(skill));
    const mainSkill = randomItem(options.length > 0 ? options : ALL_SKILLS);
    const ascendancies = CLASS_ASCENDANCIES[className];

    return {
      stage: 'skill' as const,
      value: mainSkill,
      label: mainSkill,
      detail: `${ascendancies.length} ${className} paths · no class filter`,
      options: ascendancies,
      goal: goal ? publicGoal(goal) : null,
      verification: unfilteredVerification('chaos', 'unfiltered main skill', ALL_SKILLS.length),
      mode: 'chaos' as const,
    };
  }

  const { rows, filterEnabled } = await loadVerifiedCombos();
  const classRows = classRowsFor(rows, definition);

  const grouped = groupBySkill(classRows);
  const options = [...grouped.keys()].filter((skill) => !exclude.includes(skill));
  const pool = options.length > 0 ? options : [...grouped.keys()];
  if (pool.length === 0) throw new Error('No verified skills in this class pool');

  const mainSkill = randomItem(pool);
  const matching = grouped.get(mainSkill) ?? [];
  const ascendancies = unique(matching.map((row) => row.ascendancy)).filter((value) =>
    Boolean(value in ASCENDANCY_POPULATION),
  ) as Ascendancy[];

  return {
    stage: 'skill' as const,
    value: mainSkill,
    label: mainSkill,
    detail: goal
      ? `${ascendancies.length} ${className} paths for ${goal.name}`
      : `${ascendancies.length} ${className} paths verified`,
    options: ascendancies,
    goal: goal ? publicGoal(goal) : null,
    verification: pairVerification(
      rows,
      className,
      mainSkill,
      undefined,
      filterEnabled,
      'classic',
    ),
    mode: 'classic' as const,
  };
}

function streamerAscendancyResult(
  className: CharacterClass,
  mainSkill: string,
  matching: StreamerBuild[],
  ascendancy: Ascendancy,
  goal: Awaited<ReturnType<typeof getGoalById>>,
) {
  const build = randomItem(matching);
  return {
    stage: 'ascendancy' as const,
    value: ascendancy,
    label: ascendancy,
    detail: `${className} · ${mainSkill}`,
    goal: goal ? publicGoal(goal) : null,
    verification: unfilteredVerification(
      'streamers',
      'streamer build',
      matching.length,
      build.url,
    ),
    build: {
      className,
      ascendancy,
      mainSkill,
      population: ASCENDANCY_POPULATION[ascendancy] ?? 0,
      goalId: goal?.id ?? null,
      goalName: goal?.name ?? null,
      streamer: publicStreamerBuild(build),
    },
    mode: 'streamers' as const,
  };
}

export async function rollAscendancy(
  className: string,
  mainSkill: string,
  exclude: string[] = [],
  goalId?: string,
  mode: RouletteMode = 'classic',
) {
  if (!isCharacterClass(className)) throw new Error('Unknown class');
  const definition = await getClassByName(className, false);
  if (!definition) throw new Error('This class is not available.');
  const goal = await getGoalById(goalId);

  if (mode === 'streamers') {
    const matching = streamerBuildsForPair(className, mainSkill);
    if (matching.length === 0) throw new Error('No streamer build uses this class and skill.');
    const allAscendancies = streamerAscendanciesForPair(className, mainSkill);
    const options = allAscendancies.filter((ascendancy) => !exclude.includes(ascendancy));
    const ascendancy = randomItem(options.length > 0 ? options : allAscendancies);
    const chosen = matching.filter((build) => build.ascendancy === ascendancy);
    return streamerAscendancyResult(className, mainSkill, chosen, ascendancy, goal);
  }

  if (mode === 'chaos') {
    const allAscendancies = CLASS_ASCENDANCIES[className];
    const options = allAscendancies.filter((ascendancy) => !exclude.includes(ascendancy));
    const ascendancy = randomItem(options.length > 0 ? options : allAscendancies);

    return {
      stage: 'ascendancy' as const,
      value: ascendancy,
      label: ascendancy,
      detail: `${className} · no class filter`,
      goal: goal ? publicGoal(goal) : null,
      verification: unfilteredVerification('chaos', 'unfiltered ascendancy', allAscendancies.length),
      build: {
        className,
        ascendancy,
        mainSkill,
        population: ASCENDANCY_POPULATION[ascendancy] ?? 0,
        goalId: goal?.id ?? null,
        goalName: goal?.name ?? null,
      },
      mode: 'chaos' as const,
    };
  }

  if (!definition.skills.includes(mainSkill)) {
    throw new Error('That skill is not in this class pool.');
  }
  const { rows, filterEnabled } = await loadVerifiedCombos();
  const matching = pairRows(rows, className, mainSkill);
  if (matching.length === 0) throw new Error('No verified ascendancy for this pairing');

  const allAscendancies = unique(matching.map((row) => row.ascendancy));
  const options = allAscendancies.filter((ascendancy) => !exclude.includes(ascendancy));
  const pool = options.length > 0 ? options : allAscendancies;
  const ascendancy = randomItem(pool);
  const verification = pairVerification(
    rows,
    className,
    mainSkill,
    ascendancy,
    filterEnabled,
    'classic',
  );

  return {
    stage: 'ascendancy' as const,
    value: ascendancy,
    label: ascendancy,
    detail: `${className} · ${mainSkill}`,
    goal: goal ? publicGoal(goal) : null,
    verification,
    build: {
      className,
      ascendancy,
      mainSkill,
      population: ASCENDANCY_POPULATION[ascendancy as Ascendancy] ?? 0,
      goalId: goal?.id ?? null,
      goalName: goal?.name ?? null,
    },
    mode: 'classic' as const,
  };
}
