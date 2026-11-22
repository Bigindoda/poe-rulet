import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Accounts for sign-in. Keep this table; add the app's own tables below it.
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('member'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// One verified class + main-skill + ascendancy pairing in the local meta
// snapshot. matchFloor is the number of characters using the main skill on the
// class; ladderPopulation is the class sample, so usage is matchFloor/population.
export const buildCombos = sqliteTable(
  'build_combos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    league: text('league').notNull(),
    className: text('class_name').notNull(),
    ascendancy: text('ascendancy').notNull(),
    mainSkill: text('main_skill').notNull(),
    matchFloor: integer('match_floor').notNull().default(5),
    ladderPopulation: integer('ladder_population').notNull().default(0),
    source: text('source').notNull().default('poe.ninja'),
    verifiedAt: text('verified_at').notNull(),
  },
  (table) => ({
    comboUnique: uniqueIndex('build_combos_combo_unique').on(
      table.league,
      table.className,
      table.ascendancy,
      table.mainSkill,
    ),
  }),
);

// Every completed three-stage roulette is recorded so the page can show a ledger
// of recent rolls. No accounts are involved in this app.
export const rollHistory = sqliteTable('roll_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  league: text('league').notNull(),
  mode: text('mode').notNull().default('classic'),
  className: text('class_name').notNull(),
  ascendancy: text('ascendancy').notNull(),
  mainSkill: text('main_skill').notNull(),
  goalId: text('goal_id'),
  goalName: text('goal_name'),
  matchFloor: real('match_floor').notNull().default(0.3),
  rerollsUsed: integer('rerolls_used').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// Editable base classes. The seven Path of Exile classes are fixed; the keeper
// controls which skills each class can roll and whether it appears at all.
export const classDefinitions = sqliteTable('class_definitions', {
  name: text('name').primaryKey(),
  skills: text('skills').notNull().default('[]'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// Editable pinnacle targets shown on the start screen. The bundled definitions
// in server/utils/meta.ts are only the initial seed; the keeper's table owns the
// live leaflet after that.
export const goalDefinitions = sqliteTable('goal_definitions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull().default('ATLAS'),
  tagline: text('tagline').notNull().default(''),
  tip: text('tip').notNull().default(''),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// One editable deed per base class and pinnacle target. The matrix is fixed:
// every class has an achievement for every target, and the board derives its
// unlocked state from goal_progress. The keeper owns the wording, tier, sigil,
// and visibility of each deed.
export const achievements = sqliteTable(
  'achievements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    className: text('class_name').notNull(),
    goalId: text('goal_id').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    tier: text('tier').notNull().default('BRONZE'),
    sigil: text('sigil').notNull().default('✦'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    classGoalUnique: uniqueIndex('achievements_class_goal_unique').on(
      table.className,
      table.goalId,
    ),
  }),
);

// Small key/value store for app-wide switches, such as the PoE.ninja gate.
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// One row per class + pinnacle target. Each exile keeps a separate hit list;
// a row exists only after that class has touched the goal.
export const goalProgress = sqliteTable(
  'goal_progress',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    className: text('class_name').notNull(),
    goalId: text('goal_id').notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    completedAt: text('completed_at'),
  },
  (table) => ({
    classGoalUnique: uniqueIndex('goal_progress_class_goal_unique').on(
      table.className,
      table.goalId,
    ),
  }),
);

