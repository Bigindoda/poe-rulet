import { asc, eq } from 'drizzle-orm';
import { db } from '~~/server/db';
import { appSettings, classDefinitions } from '~~/server/db/schema';
import {
  CLASS_ORDER,
  CLASS_SKILL_POOLS,
  isCharacterClass,
  type CharacterClass,
} from '~~/server/utils/meta';

export type StoredClass = {
  name: CharacterClass;
  skills: string[];
  active: boolean;
  sortOrder: number;
  updatedAt: string | null;
};

export type AdminClass = StoredClass & {
  availableSkills: string[];
};

const DEFAULT_CLASSES: StoredClass[] = CLASS_ORDER.map((name, index) => ({
  name,
  skills: [...CLASS_SKILL_POOLS[name]],
  active: true,
  sortOrder: index,
  updatedAt: null,
}));

function uniqueSkills(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function parseSkills(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return uniqueSkills(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return [];
  }
}

function toClass(row: typeof classDefinitions.$inferSelect): StoredClass | null {
  if (!isCharacterClass(row.name)) return null;
  return {
    name: row.name,
    skills: parseSkills(row.skills),
    active: row.active,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
  };
}

/** Active (or all) class definitions, ordered for the character-select grid. */
export async function listClasses(includeInactive = true): Promise<StoredClass[]> {
  try {
    const rows = await db
      .select()
      .from(classDefinitions)
      .orderBy(asc(classDefinitions.sortOrder), asc(classDefinitions.name));
    const classes = rows
      .map(toClass)
      .filter((entry): entry is StoredClass => entry !== null);
    if (classes.length > 0) {
      return classes.filter((entry) => includeInactive || entry.active);
    }
  } catch (error) {
    console.warn('[classes] using bundled class pools:', error);
  }
  return DEFAULT_CLASSES.filter((entry) => includeInactive || entry.active);
}

export async function getClassByName(
  name: unknown,
  includeInactive = true,
): Promise<StoredClass | undefined> {
  if (!isCharacterClass(name)) return undefined;
  const classes = await listClasses(includeInactive);
  return classes.find((entry) => entry.name === name);
}

export function classSkillOptions(name: CharacterClass): string[] {
  return [...CLASS_SKILL_POOLS[name]];
}

export async function listAdminClasses(): Promise<AdminClass[]> {
  const classes = await listClasses(true);
  return classes.map((entry) => ({
    ...entry,
    availableSkills: classSkillOptions(entry.name),
  }));
}

export type ClassValidation =
  | { ok: true; fields: Pick<StoredClass, 'skills' | 'active'> }
  | { ok: false; error: string };

/**
 * A class pool may only contain skills that already have a verified pairing
 * for that class. This keeps every admin choice rollable.
 */
export function validateClassPayload(
  name: unknown,
  body: Record<string, unknown> | null,
): ClassValidation {
  if (!isCharacterClass(name)) {
    return { ok: false, error: 'Unknown base class.' };
  }

  const rawSkills = Array.isArray(body?.skills) ? body.skills : [];
  const skills = uniqueSkills(
    rawSkills
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.slice(0, 80)),
  ).slice(0, 60);

  if (skills.length === 0) {
    return { ok: false, error: `Keep at least one skill in the ${name} pool.` };
  }

  const allowed = new Set(CLASS_SKILL_POOLS[name]);
  const invalid = skills.filter((skill) => !allowed.has(skill));
  if (invalid.length > 0) {
    return {
      ok: false,
      error: `Not a verified ${name} skill: ${invalid.join(', ')}.`,
    };
  }

  return {
    ok: true,
    fields: {
      skills,
      active: body?.active !== false,
    },
  };
}

export async function updateClass(
  name: CharacterClass,
  fields: Pick<StoredClass, 'skills' | 'active'>,
): Promise<AdminClass[]> {
  await db
    .update(classDefinitions)
    .set({
      skills: JSON.stringify(fields.skills),
      active: fields.active,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(classDefinitions.name, name));
  return listAdminClasses();
}

export async function resetClassPools(): Promise<AdminClass[]> {
  const now = new Date().toISOString();
  await db.delete(classDefinitions);
  await db.insert(classDefinitions).values(
    DEFAULT_CLASSES.map((entry) => ({
      name: entry.name,
      skills: JSON.stringify(entry.skills),
      active: true,
      sortOrder: entry.sortOrder,
      updatedAt: now,
    })),
  );
  return listAdminClasses();
}

/** Add any missing base-class rows once, leaving edited pools untouched. */
export async function seedDefaultClasses(): Promise<number> {
  const existing = await db.select({ name: classDefinitions.name }).from(classDefinitions);
  const known = new Set(existing.map((row) => row.name));
  const missing = DEFAULT_CLASSES.filter((entry) => !known.has(entry.name));
  if (missing.length === 0) return 0;

  const now = new Date().toISOString();
  await db.insert(classDefinitions).values(
    missing.map((entry) => ({
      name: entry.name,
      skills: JSON.stringify(entry.skills),
      active: true,
      sortOrder: entry.sortOrder,
      updatedAt: now,
    })),
  );
  return missing.length;
}

// Captured from poe.ninja Covens + SSF Covens at >=0.3% Main Skill usage.
const CLASS_POOLS_VERSION_KEY = 'class_pools_version';
const CLASS_POOLS_VERSION = 'covens-ssf-0.3-2026-11-22';

/** Apply the poe.ninja pool snapshot once when the bundled data changes. */
export async function syncDefaultClassPools(): Promise<number> {
  const [marker] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, CLASS_POOLS_VERSION_KEY))
    .limit(1);
  if (marker?.value === CLASS_POOLS_VERSION) return 0;

  const now = new Date().toISOString();
  for (const entry of DEFAULT_CLASSES) {
    await db
      .update(classDefinitions)
      .set({
        skills: JSON.stringify(entry.skills),
        updatedAt: now,
      })
      .where(eq(classDefinitions.name, entry.name));
  }

  await db.delete(appSettings).where(eq(appSettings.key, CLASS_POOLS_VERSION_KEY));
  await db.insert(appSettings).values({
    key: CLASS_POOLS_VERSION_KEY,
    value: CLASS_POOLS_VERSION,
    updatedAt: now,
  });
  return DEFAULT_CLASSES.length;
}
