import { and, asc, eq } from 'drizzle-orm';
import { db } from '~~/server/db';
import { achievements, goalProgress } from '~~/server/db/schema';
import { listClasses } from '~~/server/utils/classes';
import { listGoals, type StoredGoal } from '~~/server/utils/goals';
import type { CharacterClass } from '~~/server/utils/meta';

export const ACHIEVEMENT_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'MYTHIC'] as const;
export type AchievementTier = (typeof ACHIEVEMENT_TIERS)[number];

export const ACHIEVEMENT_SIGILS = ['✦', '✧', '◈', '✹', '☉', '✶', '☾', '⚔'] as const;

export type AchievementView = {
  className: string;
  goalId: string;
  title: string;
  description: string;
  tier: AchievementTier;
  sigil: string;
  active: boolean;
  updatedAt: string | null;
  unlocked: boolean;
  completedAt: string | null;
};

export type AchievementBoard = {
  classes: Array<{ name: string; active: boolean; sortOrder: number }>;
  goals: Array<{
    id: string;
    name: string;
    category: 'ELDRITCH' | 'ATLAS';
    tagline: string;
    tip: string;
    active: boolean;
    sortOrder: number;
  }>;
  achievements: AchievementView[];
  stats: {
    total: number;
    claimed: number;
    classes: number;
    goals: number;
  };
};

type AchievementFields = Pick<AchievementView, 'title' | 'description' | 'tier' | 'sigil' | 'active'>;

const CLASS_HONORIFICS: Record<CharacterClass, string> = {
  Duelist: 'Blade',
  Marauder: 'Mountain',
  Ranger: 'Hunter',
  Shadow: 'Knife',
  Templar: 'Zealot',
  Witch: 'Veil',
  Scion: 'Heir',
};

const CLASS_LINES: Record<CharacterClass, string> = {
  Duelist: 'The duel ends when the arena goes quiet.',
  Marauder: 'Stone remembers every blow it survives.',
  Ranger: 'The last arrow is the one that was never wasted.',
  Shadow: 'No one sees the knife until the light leaves.',
  Templar: 'Faith is a weapon that does not dull.',
  Witch: 'The veil answers when the living stop asking.',
  Scion: 'The heir carries every bloodline into the dark.',
};

const DEFAULT_SIGILS = ['✦', '✹', '◈', '☉', '✧', '☾'] as const;

function goalPhrase(name: string): string {
  const trimmed = name.trim();
  return /^the\s+/i.test(trimmed) ? `the ${trimmed.slice(4)}` : trimmed;
}

function defaultTier(index: number): AchievementTier {
  if (index <= 1) return 'BRONZE';
  if (index <= 3) return 'SILVER';
  if (index === 4) return 'GOLD';
  return 'MYTHIC';
}

function defaultAchievement(className: CharacterClass, goal: StoredGoal, index: number) {
  const honorific = CLASS_HONORIFICS[className];
  const line = CLASS_LINES[className];
  return {
    title: `The ${honorific} of ${goalPhrase(goal.name)}`,
    description: `${line} ${goal.name} falls to a ${className}.`,
    tier: defaultTier(index),
    sigil: DEFAULT_SIGILS[index % DEFAULT_SIGILS.length] ?? '✦',
    active: true,
  };
}

function isTier(value: unknown): value is AchievementTier {
  return typeof value === 'string' && ACHIEVEMENT_TIERS.includes(value as AchievementTier);
}

/** Add any missing class + target deed without touching edited rows. */
export async function ensureAchievements(): Promise<number> {
  const [classes, goals, existing] = await Promise.all([
    listClasses(true),
    listGoals(true),
    db.select().from(achievements),
  ]);
  if (classes.length === 0 || goals.length === 0) return 0;

  const known = new Set(existing.map((row) => `${row.className}\u0000${row.goalId}`));
  const now = new Date().toISOString();
  const missing: Array<typeof achievements.$inferInsert> = [];

  classes.forEach((entry) => {
    goals.forEach((goal, index) => {
      if (known.has(`${entry.name}\u0000${goal.id}`)) return;
      const fields = defaultAchievement(entry.name, goal, index);
      missing.push({
        className: entry.name,
        goalId: goal.id,
        ...fields,
        updatedAt: now,
      });
    });
  });

  if (missing.length > 0) {
    await db.insert(achievements).values(missing).onConflictDoNothing();
  }
  return missing.length;
}

function progressKey(className: string, goalId: string): string {
  return `${className}\u0000${goalId}`;
}

/** The full class × target deed matrix, with completion derived from progress. */
export async function getAchievementBoard(includeInactive = false): Promise<AchievementBoard> {
  await ensureAchievements();

  const [classes, goals, rows, progress] = await Promise.all([
    listClasses(true),
    listGoals(true),
    db.select().from(achievements).orderBy(asc(achievements.id)),
    db.select().from(goalProgress),
  ]);

  const visibleClasses = classes.filter((entry) => includeInactive || entry.active);
  const visibleGoals = goals.filter((goal) => includeInactive || goal.active);
  const classNames = new Set(visibleClasses.map((entry) => entry.name));
  const goalIds = new Set(visibleGoals.map((goal) => goal.id));
  const completed = new Map(
    progress
      .filter((row) => row.completed)
      .map((row) => [progressKey(row.className, row.goalId), row.completedAt ?? null]),
  );

  const views: AchievementView[] = rows
    .filter(
      (row) =>
        classNames.has(row.className) &&
        goalIds.has(row.goalId) &&
        (includeInactive || row.active),
    )
    .map((row) => {
      const completedAt = completed.get(progressKey(row.className, row.goalId)) ?? null;
      return {
        className: row.className,
        goalId: row.goalId,
        title: row.title,
        description: row.description,
        tier: isTier(row.tier) ? row.tier : 'BRONZE',
        sigil: row.sigil || '✦',
        active: row.active,
        updatedAt: row.updatedAt,
        unlocked: completedAt !== null,
        completedAt,
      };
    });

  return {
    classes: visibleClasses.map((entry) => ({
      name: entry.name,
      active: entry.active,
      sortOrder: entry.sortOrder,
    })),
    goals: visibleGoals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      category: goal.category,
      tagline: goal.tagline,
      tip: goal.tip,
      active: goal.active,
      sortOrder: goal.sortOrder,
    })),
    achievements: views,
    stats: {
      total: views.length,
      claimed: views.filter((entry) => entry.unlocked).length,
      classes: visibleClasses.length,
      goals: visibleGoals.length,
    },
  };
}

export async function updateAchievement(
  className: string,
  goalId: string,
  fields: AchievementFields,
): Promise<AchievementBoard> {
  await ensureAchievements();
  const [existing] = await db
    .select({ id: achievements.id })
    .from(achievements)
    .where(and(eq(achievements.className, className), eq(achievements.goalId, goalId)))
    .limit(1);

  if (!existing) throw new Error('That deed is not on the board.');

  await db
    .update(achievements)
    .set({
      title: fields.title,
      description: fields.description,
      tier: fields.tier,
      sigil: fields.sigil,
      active: fields.active,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(achievements.className, className), eq(achievements.goalId, goalId)));

  return getAchievementBoard(true);
}

export async function resetAchievements(): Promise<AchievementBoard> {
  const [classes, goals] = await Promise.all([listClasses(true), listGoals(true)]);
  const now = new Date().toISOString();
  const values = classes.flatMap((entry) =>
    goals.map((goal, index) => ({
      className: entry.name,
      goalId: goal.id,
      ...defaultAchievement(entry.name, goal, index),
      updatedAt: now,
    })),
  );

  if (values.length === 0) throw new Error('There are no classes or targets to build deeds from.');
  await db.delete(achievements);
  await db.insert(achievements).values(values);
  return getAchievementBoard(true);
}

export async function deleteAchievementsForGoal(goalId: string): Promise<void> {
  await db.delete(achievements).where(eq(achievements.goalId, goalId));
}

export type AchievementValidation =
  | { ok: true; fields: AchievementFields }
  | { ok: false; error: string };

export function validateAchievementPayload(
  body: Record<string, unknown> | null,
): AchievementValidation {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (title.length < 2 || title.length > 100) {
    return { ok: false, error: 'The deed title must be 2–100 characters.' };
  }

  const description =
    typeof body?.description === 'string' ? body.description.trim().slice(0, 260) : '';
  const tier = isTier(body?.tier) ? body.tier : 'BRONZE';
  const rawSigil = typeof body?.sigil === 'string' ? body.sigil : '';
  const sigil = ACHIEVEMENT_SIGILS.some((candidate) => candidate === rawSigil)
    ? rawSigil
    : '✦';

  return {
    ok: true,
    fields: {
      title,
      description,
      tier,
      sigil,
      active: body?.active !== false,
    },
  };
}
