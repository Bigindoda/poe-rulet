import { asc, eq, notInArray } from 'drizzle-orm';
import { db } from '~~/server/db';
import { achievements, goalDefinitions, goalProgress } from '~~/server/db/schema';
import { GOALS, type GoalCategory, type GoalDefinition } from '~~/server/utils/meta';

export type StoredGoal = GoalDefinition & {
  active: boolean;
  sortOrder: number;
  updatedAt: string | null;
};

export type GoalFields = Omit<StoredGoal, 'id' | 'updatedAt'>;

const DEFAULT_GOALS: StoredGoal[] = GOALS.map((goal, index) => ({
  ...goal,
  active: true,
  sortOrder: index,
  updatedAt: null,
}));

const DEFAULT_IDS = DEFAULT_GOALS.map((goal) => goal.id);

function toGoal(row: typeof goalDefinitions.$inferSelect): StoredGoal {
  return {
    id: row.id,
    name: row.name,
    category: row.category === 'ELDRITCH' ? 'ELDRITCH' : 'ATLAS',
    tagline: row.tagline,
    tip: row.tip,
    active: row.active,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
  };
}

/** Live goals, with the bundled leaflet as a safe fallback. */
export async function listGoals(includeInactive = true): Promise<StoredGoal[]> {
  try {
    const rows = await db
      .select()
      .from(goalDefinitions)
      .orderBy(asc(goalDefinitions.sortOrder), asc(goalDefinitions.name));
    if (rows.length > 0) {
      return rows.map(toGoal).filter((goal) => includeInactive || goal.active);
    }
  } catch (error) {
    console.warn('[goals] using bundled leaflet:', error);
  }
  return DEFAULT_GOALS.filter((goal) => includeInactive || goal.active);
}

export async function getGoalById(id: unknown, includeInactive = true): Promise<StoredGoal | undefined> {
  if (typeof id !== 'string' || !id) return undefined;
  const goals = await listGoals(includeInactive);
  return goals.find((goal) => goal.id === id);
}

export function slugifyGoal(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
}

export type GoalValidation =
  | { ok: true; fields: GoalFields }
  | { ok: false; error: string };

/** Validate an admin goal payload. Skill pools live on classes, not goals. */
export function validateGoalPayload(body: Record<string, unknown> | null): GoalValidation {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: 'The target name must be 2–80 characters.' };
  }

  const category: GoalCategory = body?.category === 'ELDRITCH' ? 'ELDRITCH' : 'ATLAS';
  const tagline = typeof body?.tagline === 'string' ? body.tagline.trim().slice(0, 140) : '';
  const tip = typeof body?.tip === 'string' ? body.tip.trim().slice(0, 240) : '';

  const rawOrder = Number(body?.sortOrder);
  const sortOrder = Number.isFinite(rawOrder) ? Math.min(999, Math.max(0, Math.round(rawOrder))) : 0;

  return {
    ok: true,
    fields: {
      name,
      category,
      tagline,
      tip,
      active: body?.active !== false,
      sortOrder,
    },
  };
}

export async function createGoal(id: string, fields: GoalFields): Promise<StoredGoal[]> {
  const now = new Date().toISOString();
  await db.insert(goalDefinitions).values({
    id,
    ...fields,
    createdAt: now,
    updatedAt: now,
  });
  return listGoals(true);
}

export async function updateGoal(id: string, fields: GoalFields): Promise<StoredGoal[]> {
  await db
    .update(goalDefinitions)
    .set({
      ...fields,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(goalDefinitions.id, id));
  return listGoals(true);
}

export async function deleteGoal(id: string): Promise<StoredGoal[]> {
  const goals = await listGoals(true);
  if (goals.length <= 1) {
    throw new Error('The leaflet must keep at least one target.');
  }
  await db.delete(achievements).where(eq(achievements.goalId, id));
  await db.delete(goalProgress).where(eq(goalProgress.goalId, id));
  await db.delete(goalDefinitions).where(eq(goalDefinitions.id, id));
  return listGoals(true);
}

/** Restore the bundled six-target leaflet, keeping marks for unchanged IDs. */
export async function resetGoals(): Promise<StoredGoal[]> {
  const now = new Date().toISOString();
  await db.delete(goalDefinitions);
  await db.insert(goalDefinitions).values(
    DEFAULT_GOALS.map((goal) => ({
      id: goal.id,
      name: goal.name,
      category: goal.category,
      tagline: goal.tagline,
      tip: goal.tip,
      active: true,
      sortOrder: goal.sortOrder,
      createdAt: now,
      updatedAt: now,
    })),
  );
  await db.delete(goalProgress).where(notInArray(goalProgress.goalId, DEFAULT_IDS));
  await db.delete(achievements).where(notInArray(achievements.goalId, DEFAULT_IDS));
  return listGoals(true);
}

/** Seed once, so an untouched install starts with the six canonical targets. */
export async function seedDefaultGoals(): Promise<number> {
  const existing = await db.select({ id: goalDefinitions.id }).from(goalDefinitions).limit(1);
  if (existing.length > 0) return 0;

  const now = new Date().toISOString();
  await db.insert(goalDefinitions).values(
    DEFAULT_GOALS.map((goal) => ({
      id: goal.id,
      name: goal.name,
      category: goal.category,
      tagline: goal.tagline,
      tip: goal.tip,
      active: true,
      sortOrder: goal.sortOrder,
      createdAt: now,
      updatedAt: now,
    })),
  );
  return DEFAULT_GOALS.length;
}

export function publicGoalList(goals: StoredGoal[]) {
  return goals.map((goal) => ({
    id: goal.id,
    name: goal.name,
    category: goal.category,
    tagline: goal.tagline,
    tip: goal.tip,
  }));
}
