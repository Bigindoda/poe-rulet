import raw from '../assets/poe-streamers.json';
import {
  CLASS_ORDER,
  isAscendancy,
  isCharacterClass,
  type Ascendancy,
  type CharacterClass,
} from '~~/server/utils/meta';

type RawStreamerBuild = {
  streamer: string;
  character: string;
  account: string;
  className: string;
  ascendancy: string;
  mainSkill: string;
  mainSkills: string[];
  level: number;
  league: string;
  dps: string;
  secondAscendancy: string | null;
  url: string;
};

type RawStreamerData = {
  source: string;
  tab: string;
  capturedAt: string;
  url: string;
  leagues: string[];
  builds: RawStreamerBuild[];
};

const data = raw as RawStreamerData;

export type StreamerBuild = {
  streamer: string;
  character: string;
  account: string;
  className: CharacterClass;
  ascendancy: Ascendancy;
  mainSkill: string;
  mainSkills: string[];
  level: number;
  league: string;
  dps: string;
  secondAscendancy: string | null;
  url: string;
};

export type PublicStreamerBuild = Omit<StreamerBuild, 'mainSkills'>;

export type StreamerSkill = {
  name: string;
  builds: number;
  ascendancies: Ascendancy[];
};

export const STREAMER_CAPTURED_AT = data.capturedAt;
export const STREAMER_SOURCE_URL = data.url;
export const STREAMER_LEAGUES = data.leagues;

/**
 * Curated streamer builds captured from the poe.ninja Streamers tab. Low-level
 * characters without a primary ascendancy or a main skill are discarded so the
 * roulette only sees complete builds.
 */
export const STREAMER_BUILDS: StreamerBuild[] = data.builds
  .filter(
    (build) =>
      isCharacterClass(build.className) &&
      isAscendancy(build.ascendancy) &&
      typeof build.mainSkill === 'string' &&
      build.mainSkill.trim().length > 1 &&
      Number(build.level) >= 68,
  )
  .map((build) => ({
    streamer: build.streamer.slice(0, 80),
    character: build.character.slice(0, 80),
    account: build.account.slice(0, 80),
    className: build.className as CharacterClass,
    ascendancy: build.ascendancy as Ascendancy,
    mainSkill: build.mainSkill.slice(0, 80),
    mainSkills: Array.isArray(build.mainSkills)
      ? build.mainSkills.filter((skill): skill is string => typeof skill === 'string').slice(0, 12)
      : [],
    level: Number(build.level) || 0,
    league: build.league.slice(0, 40),
    dps: build.dps || '—',
    secondAscendancy: build.secondAscendancy,
    url: build.url,
  }));

export const STREAMER_CLASSES: CharacterClass[] = CLASS_ORDER.filter((className) =>
  STREAMER_BUILDS.some((build) => build.className === className),
);

export const STREAMER_SKILL_COUNT = new Set(STREAMER_BUILDS.map((build) => build.mainSkill)).size;
export const STREAMER_NAMES = [...new Set(STREAMER_BUILDS.map((build) => build.streamer))];

export function streamerBuildsForClass(className: CharacterClass): StreamerBuild[] {
  return STREAMER_BUILDS.filter((build) => build.className === className);
}

export function streamerBuildsForPair(className: CharacterClass, mainSkill: string): StreamerBuild[] {
  return STREAMER_BUILDS.filter(
    (build) => build.className === className && build.mainSkill === mainSkill,
  );
}

export function streamerSkillsForClass(className: CharacterClass): StreamerSkill[] {
  const grouped = new Map<string, StreamerBuild[]>();
  for (const build of streamerBuildsForClass(className)) {
    const list = grouped.get(build.mainSkill) ?? [];
    list.push(build);
    grouped.set(build.mainSkill, list);
  }

  return [...grouped.entries()]
    .map(([name, builds]) => ({
      name,
      builds: builds.length,
      ascendancies: [...new Set(builds.map((build) => build.ascendancy))],
    }))
    .sort((a, b) => b.builds - a.builds || a.name.localeCompare(b.name));
}

export function streamerAscendanciesForPair(
  className: CharacterClass,
  mainSkill: string,
): Ascendancy[] {
  return [...new Set(streamerBuildsForPair(className, mainSkill).map((build) => build.ascendancy))];
}

export function publicStreamerBuild(build: StreamerBuild): PublicStreamerBuild {
  return {
    streamer: build.streamer,
    character: build.character,
    account: build.account,
    className: build.className,
    ascendancy: build.ascendancy,
    mainSkill: build.mainSkill,
    level: build.level,
    league: build.league,
    dps: build.dps,
    secondAscendancy: build.secondAscendancy,
    url: build.url,
  };
}

/** One representative build per class for the Streamers panel. */
export function streamerSamples(): PublicStreamerBuild[] {
  return STREAMER_CLASSES.map((className) =>
    STREAMER_BUILDS.find((build) => build.className === className),
  )
    .filter((build): build is StreamerBuild => Boolean(build))
    .map(publicStreamerBuild);
}
