<script setup lang="ts">
import {
  ArrowRightOutlined,
  CheckOutlined,
  CopyOutlined,
  ExperimentOutlined,
  ExportOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ThunderboltFilled,
  UnlockOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { computed, nextTick, onMounted, reactive, ref, type Component } from 'vue';

type StageKey = 'class' | 'skill' | 'ascendancy';
type RouletteMode = 'classic' | 'chaos' | 'streamers';

type Verification = {
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
  filterEnabled?: boolean;
  mode: RouletteMode;
};

type StreamerInfo = {
  streamer: string;
  character: string;
  account: string;
  className: string;
  ascendancy: string;
  mainSkill: string;
  level: number;
  league: string;
  dps: string;
  secondAscendancy: string | null;
  url: string;
};

type RollResult = {
  stage: StageKey;
  value: string;
  label: string;
  detail: string;
  population?: number;
  ascendancies?: string[];
  options?: string[];
  goal?: Goal | null;
  verification: Verification;
  mode: RouletteMode;
  build?: {
    className: string;
    ascendancy: string;
    mainSkill: string;
    population: number;
    goalId?: string | null;
    goalName?: string | null;
    streamer?: StreamerInfo;
  };
};

type Goal = {
  id: string;
  name: string;
  category: 'ELDRITCH' | 'ATLAS';
  tagline: string;
  tip: string;
};

type GoalProgress = {
  className: string;
  goalId: string;
  completed: boolean;
  completedAt: string | null;
};

type GoalView = Goal & {
  completed: boolean;
  completedAt: string | null;
};

type CatalogSkill = { name: string; ascendancies: string[]; builds?: number };
type CatalogClass = {
  name: string;
  population: number;
  skills: CatalogSkill[];
  pairings: number;
  ascendancies: string[];
  chaosSkillCount: number;
  streamerBuilds: number;
  streamerSkills: CatalogSkill[];
};
type StreamerSummary = {
  capturedAt: string;
  sourceUrl: string;
  leagues: string[];
  builds: number;
  streamers: number;
  skills: number;
  classes: string[];
  samples: StreamerInfo[];
};
type Catalog = {
  league: string;
  threshold: number;
  poeNinjaFilter: boolean;
  snapshotAt: string;
  allSkills: string[];
  classes: CatalogClass[];
  streamers: StreamerSummary;
  stats: {
    classes: number;
    skills: number;
    ascendancies: number;
    pairings: number;
    combinations: number;
    ladderCharacters: number;
    chaosSkills: number;
    streamerBuilds: number;
    streamerStreamers: number;
    streamerSkills: number;
  };
};

type HistoryRoll = {
  id: number;
  mode: RouletteMode;
  className: string;
  ascendancy: string;
  mainSkill: string;
  goalId: string | null;
  goalName: string | null;
  matchFloor: number;
  rerollsUsed: number;
  createdAt: string;
};

type ModeOption = {
  key: RouletteMode;
  label: string;
  kicker: string;
  description: string;
  icon: Component;
};

useHead({ title: 'PoE Build Roulette — Covens of Umbra' });

const MODES: ModeOption[] = [
  {
    key: 'classic',
    label: 'Classic',
    kicker: '01 · VERIFIED',
    description: 'Class pools, the 0.3% floor, and a real PoE.ninja gate.',
    icon: SafetyCertificateOutlined,
  },
  {
    key: 'chaos',
    label: 'Chaos',
    kicker: '02 · UNFILTERED',
    description: 'No class skill filter. No population gate. Every skill is in play.',
    icon: ExperimentOutlined,
  },
  {
    key: 'streamers',
    label: 'Streamers',
    kicker: '03 · LIVE TAB',
    description: 'Class, main skill, and ascendancy drawn from poe.ninja Streamers.',
    icon: TeamOutlined,
  },
];

const mode = ref<RouletteMode>('classic');

const stages = computed(() => {
  const classic = mode.value === 'classic';
  const chaos = mode.value === 'chaos';
  const streamers = mode.value === 'streamers';

  return [
    {
      key: 'class' as StageKey,
      kicker: 'STAGE 01',
      short: 'CLASS',
      title: streamers ? 'The streamer draw' : 'Your exile',
      description: streamers
        ? 'Drawn from a complete build on the poe.ninja Streamers tab. One reroll is allowed.'
        : classic
          ? 'Chosen on the start screen. The class is locked for this hunt.'
          : 'Chosen on the start screen. No skill filter will constrain it.',
      action: streamers ? 'Draw the class' : 'Spin the class',
      cta: 'Continue to skill',
    },
    {
      key: 'skill' as StageKey,
      kicker: 'STAGE 02',
      short: 'MAIN SKILL',
      title: 'Choose the weapon',
      description: classic
        ? 'Only skills with a cleared class pairing can appear in the reel.'
        : chaos
          ? 'Every known main skill can land here. The class pool and the 0.3% gate are off.'
          : 'Only main skills used by streamer builds of this class can appear.',
      action: 'Spin the skill',
      cta: 'Continue to ascendancy',
    },
    {
      key: 'ascendancy' as StageKey,
      kicker: 'STAGE 03',
      short: 'ASCENDANCY',
      title: 'Seal the covenant',
      description: classic
        ? 'Two verified ascendancy paths remain. Fate picks the final one.'
        : chaos
          ? 'Any of the class ascensions can seal the build. Nothing is checked against poe.ninja.'
          : 'One of the ascendancies those streamer builds actually use seals the build.',
      action: 'Spin the ascendancy',
      cta: 'Seal the build',
    },
  ];
});

const catalog = ref<Catalog | null>(null);
const catalogError = ref('');
const loadingCatalog = ref(true);
const goals = ref<Goal[]>([]);
const goalProgress = ref<Record<string, GoalProgress>>({});
const goalsError = ref('');
const loadingGoals = ref(true);
const selectedClass = ref<string | null>(null);
const selectedGoalId = ref<string | null>(null);
const goalSaving = ref<string | null>(null);
const started = ref(false);
const stageIndex = ref(0);
const spinning = ref<StageKey | null>(null);
const reelValue = ref('—');
const error = ref('');
const copied = ref(false);
const history = ref<HistoryRoll[]>([]);
const loadingHistory = ref(false);

const results = reactive<Record<StageKey, RollResult | null>>({
  class: null,
  skill: null,
  ascendancy: null,
});

const rerollUsed = reactive<Record<StageKey, boolean>>({
  class: false,
  skill: false,
  ascendancy: false,
});

let reelTimer: ReturnType<typeof setInterval> | null = null;

const activeMode = computed<ModeOption>(
  () => MODES.find((entry) => entry.key === mode.value) ?? MODES[0]!,
);
const activeStage = computed<StageKey | null>(() => {
  if (!started.value || stageIndex.value >= stages.value.length) return null;
  return stages.value[stageIndex.value]?.key ?? null;
});
const finished = computed(() => stageIndex.value >= stages.value.length);
const finalBuild = computed(() => results.ascendancy?.build ?? null);
const finalStreamer = computed(() => finalBuild.value?.streamer ?? null);
const finalVerification = computed(() => results.ascendancy?.verification ?? null);
const finalMode = computed<RouletteMode>(() => results.ascendancy?.mode ?? mode.value);
const proofLink = computed(
  () => finalVerification.value?.proofUrl ?? finalStreamer.value?.url ?? null,
);
const threshold = computed(() => catalog.value?.threshold ?? 0.3);
const gateEnabled = computed(() => catalog.value?.poeNinjaFilter !== false);
const allSkills = computed(() => catalog.value?.allSkills ?? []);
const streamerSummary = computed(() => catalog.value?.streamers ?? null);
const goalCount = computed(() => goals.value.length);
const goalViews = computed<GoalView[]>(() =>
  goals.value.map((goal) => {
    const progress = selectedClass.value
      ? goalProgress.value[`${selectedClass.value}:${goal.id}`]
      : undefined;
    return {
      ...goal,
      completed: progress?.completed ?? false,
      completedAt: progress?.completedAt ?? null,
    };
  }),
);
const selectedGoal = computed(
  () => goalViews.value.find((goal) => goal.id === selectedGoalId.value) ?? null,
);
const completedGoals = computed(() => goalViews.value.filter((goal) => goal.completed).length);
const goalSheetTitle = computed(() =>
  selectedClass.value ? `${selectedClass.value.toUpperCase()}'S HIT LIST` : 'THE HIT LIST',
);
const selectedClassEntry = computed(
  () => catalog.value?.classes.find((entry) => entry.name === selectedClass.value) ?? null,
);
const canStart = computed(() => {
  if (!catalog.value || loadingCatalog.value || !selectedGoal.value) return false;
  if (mode.value === 'streamers') return (catalog.value.streamers?.builds ?? 0) > 0;
  return Boolean(selectedClass.value);
});

const CLASS_THEMES: Record<
  string,
  { color: string; epithet: string; glyph: string; stats: Array<{ label: string; value: number }> }
> = {
  Duelist: {
    color: '#c76b4a',
    epithet: 'THE BLADE',
    glyph: 'DU',
    stats: [
      { label: 'LIFE', value: 3 },
      { label: 'POWER', value: 4 },
      { label: 'TEMPO', value: 3 },
    ],
  },
  Marauder: {
    color: '#c58a48',
    epithet: 'THE MOUNTAIN',
    glyph: 'MA',
    stats: [
      { label: 'LIFE', value: 5 },
      { label: 'POWER', value: 5 },
      { label: 'TEMPO', value: 1 },
    ],
  },
  Ranger: {
    color: '#7fa46b',
    epithet: 'THE HUNT',
    glyph: 'RA',
    stats: [
      { label: 'LIFE', value: 2 },
      { label: 'POWER', value: 4 },
      { label: 'TEMPO', value: 5 },
    ],
  },
  Shadow: {
    color: '#8e76b2',
    epithet: 'THE KNIFE',
    glyph: 'SH',
    stats: [
      { label: 'LIFE', value: 2 },
      { label: 'POWER', value: 5 },
      { label: 'TEMPO', value: 4 },
    ],
  },
  Templar: {
    color: '#7fa1c2',
    epithet: 'THE FAITH',
    glyph: 'TE',
    stats: [
      { label: 'LIFE', value: 4 },
      { label: 'POWER', value: 3 },
      { label: 'TEMPO', value: 3 },
    ],
  },
  Witch: {
    color: '#b56d9e',
    epithet: 'THE VEIL',
    glyph: 'WI',
    stats: [
      { label: 'LIFE', value: 2 },
      { label: 'POWER', value: 5 },
      { label: 'TEMPO', value: 3 },
    ],
  },
  Scion: {
    color: '#c9b686',
    epithet: 'THE HEIR',
    glyph: 'SC',
    stats: [
      { label: 'LIFE', value: 3 },
      { label: 'POWER', value: 3 },
      { label: 'TEMPO', value: 4 },
    ],
  },
};

function classTheme(name: string) {
  return (
    CLASS_THEMES[name] ?? {
      color: '#c9b686',
      epithet: 'THE EXILE',
      glyph: name.slice(0, 2).toUpperCase(),
      stats: [
        { label: 'LIFE', value: 3 },
        { label: 'POWER', value: 3 },
        { label: 'TEMPO', value: 3 },
      ],
    }
  );
}

const formattedSnapshot = computed(() => {
  const raw =
    mode.value === 'streamers'
      ? catalog.value?.streamers?.capturedAt ?? '2026-11-22T00:15:00+04:00'
      : catalog.value?.snapshotAt ?? '2026-11-22T00:15:00+04:00';
  const date = new Date(raw);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
});

const statCards = computed(() => {
  if (mode.value === 'streamers') {
    return [
      { value: String(catalog.value?.streamers?.builds ?? 0), label: 'streamer builds' },
      { value: String(catalog.value?.streamers?.streamers ?? 0), label: 'streamers' },
      { value: String(goalCount.value), label: 'pinnacle targets' },
      { value: String(catalog.value?.streamers?.skills ?? 0), label: 'main skills in the tab' },
    ];
  }
  if (mode.value === 'chaos') {
    return [
      { value: String(catalog.value?.stats.classes ?? 7), label: 'base classes' },
      { value: String(allSkills.value.length), label: 'skills in play' },
      { value: String(goalCount.value), label: 'pinnacle targets' },
      { value: 'NO GATE', label: 'class filter' },
    ];
  }
  return [
    { value: String(catalog.value?.stats.classes ?? 7), label: 'base classes' },
    { value: String(catalog.value?.stats.skills ?? 38), label: 'verified skills' },
    { value: String(goalCount.value), label: 'pinnacle targets' },
    {
      value: gateEnabled.value ? `${threshold.value}%` : 'OFF',
      label: gateEnabled.value ? 'class usage per gate' : 'poe.ninja filter',
    },
  ];
});

const classEntry = computed(() => {
  const className = results.class?.value ?? selectedClass.value;
  return catalog.value?.classes.find((entry) => entry.name === className) ?? null;
});

const wheelNumeral = computed(() => {
  if (!started.value) return '0';
  if (finished.value) return '✦';
  return ['I', 'II', 'III'][stageIndex.value] ?? '✦';
});
const wheelValue = computed(() => {
  if (!started.value) return 'READY';
  if (spinning.value) return reelValue.value;
  if (finished.value) return results.class?.value ?? '✦';
  const key = activeStage.value;
  return key ? results[key]?.value ?? 'AWAIT' : 'AWAIT';
});
const wheelCaption = computed(() => {
  if (!started.value) return 'PRESS START';
  if (spinning.value) return 'THE COVEN LISTENS';
  if (finished.value) return 'FATE SEALED';
  if (activeStage.value && results[activeStage.value]) return 'FATE OFFERED';
  return 'THREE TURNS';
});

const currentStepLabel = computed(() => {
  if (!started.value) return 'NOT STARTED';
  return finished.value ? 'SEALED' : `${Math.min(stageIndex.value + 1, 3)} / 3`;
});

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-GB').format(value ?? 0);
}

function formatRollTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scrollToRoulette() {
  document.getElementById('roulette')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToStart() {
  document.getElementById('start')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goToStart() {
  if (started.value) {
    scrollToRoulette();
    return;
  }
  scrollToStart();
}

function setMode(next: RouletteMode) {
  if (next === mode.value) return;
  const wasStarted = started.value;
  mode.value = next;
  if (next === 'streamers') selectedClass.value = null;
  if (wasStarted) {
    changeSelection();
  } else {
    error.value = '';
    copied.value = false;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('poe-roulette-mode', next);
  }
}

function makeChosenClassResult(): RollResult | null {
  const entry = selectedClassEntry.value;
  const className = selectedClass.value;
  if (!entry || !className) return null;

  const chaos = mode.value === 'chaos';
  return {
    stage: 'class',
    value: className,
    label: className,
    detail: chaos
      ? `${allSkills.value.length} skills · no class filter`
      : `${entry.skills.length} skills in the class pool`,
    population: entry.population,
    verification: {
      passed: true,
      threshold: threshold.value,
      floor: null,
      scope: chaos ? 'chosen class · unfiltered' : 'chosen class',
      source: 'start screen',
      league: catalog.value?.league ?? 'Covens',
      checkedAt: new Date().toISOString(),
      snapshotAt: catalog.value?.snapshotAt ?? '2026-11-22T00:15:00+04:00',
      proofUrl: null,
      pairs: chaos ? allSkills.value.length : entry.pairings,
      filterEnabled: chaos ? false : gateEnabled.value,
      mode: chaos ? 'chaos' : 'classic',
    },
    mode: chaos ? 'chaos' : 'classic',
  } as RollResult;
}

function startRoulette() {
  if (!canStart.value || !selectedGoal.value) return;

  results.class = null;
  results.skill = null;
  results.ascendancy = null;
  rerollUsed.class = false;
  rerollUsed.skill = false;
  rerollUsed.ascendancy = false;
  error.value = '';
  copied.value = false;

  if (mode.value === 'streamers') {
    selectedClass.value = null;
    stageIndex.value = 0;
    started.value = true;
    nextTick(() => {
      scrollToRoulette();
      window.setTimeout(() => {
        if (started.value && activeStage.value === 'class' && !results.class) {
          void rollStage('class');
        }
      }, 500);
    });
    return;
  }

  const chosen = makeChosenClassResult();
  if (!chosen) return;

  results.class = chosen;
  stageIndex.value = 1;
  started.value = true;

  nextTick(() => {
    scrollToRoulette();
    window.setTimeout(() => {
      if (started.value && activeStage.value === 'skill' && !results.skill) {
        void rollStage('skill');
      }
    }, 650);
  });
}

function selectClass(className: string) {
  if (mode.value === 'streamers') return;
  selectedClass.value = className;
}

function selectGoal(goalId: string) {
  selectedGoalId.value = goalId;
}

function randomizeSelection() {
  if (mode.value === 'streamers') return;
  const classes = catalog.value?.classes ?? [];
  const targets = goalViews.value;
  if (classes.length === 0 || targets.length === 0) return;

  const classPool = classes.filter((entry) => entry.name !== selectedClass.value);
  const nextClass = classPool[Math.floor(Math.random() * classPool.length)] ?? classes[0];
  const targetPool = targets.filter((goal) => goal.id !== selectedGoalId.value);
  const nextGoal = targetPool[Math.floor(Math.random() * targetPool.length)] ?? targets[0];
  if (!nextClass || !nextGoal) return;

  selectedClass.value = nextClass.name;
  selectedGoalId.value = nextGoal.id;
  message.success(`Fate chose ${nextClass.name} — ${nextGoal.name}.`);
  nextTick(() => scrollToStart());
}

async function loadGoals() {
  loadingGoals.value = true;
  goalsError.value = '';
  try {
    const response = await $fetch<{ goals: Goal[]; progress: GoalProgress[] }>('/api/goals');
    goals.value = response.goals ?? [];
    goalProgress.value = Object.fromEntries(
      (response.progress ?? []).map((progress) => [
        `${progress.className}:${progress.goalId}`,
        progress,
      ]),
    );
  } catch (fetchError) {
    goalsError.value = 'The hit list could not be loaded. Try again.';
    console.warn(fetchError);
  } finally {
    loadingGoals.value = false;
  }
}

async function toggleGoal(goal: GoalView) {
  if (goalSaving.value) return;
  if (!selectedClass.value) {
    message.warning(
      mode.value === 'streamers'
        ? 'Draw the class before ticking off a target.'
        : 'Choose an exile before ticking off a target.',
    );
    return;
  }

  const className = selectedClass.value;
  goalSaving.value = goal.id;
  try {
    const response = await $fetch<{ progress: GoalProgress }>('/api/goals', {
      method: 'POST',
      body: { className, goalId: goal.id, completed: !goal.completed },
    });
    goalProgress.value[`${className}:${goal.id}`] = response.progress;

    if (response.progress.completed) {
      message.success(`${goal.name} marked as completed for ${className}.`);
      changeSelection();
    } else {
      message.success(`${goal.name} returned to ${className}'s hit list.`);
    }
  } catch (fetchError) {
    console.warn(fetchError);
    message.error('Could not update the target.');
  } finally {
    goalSaving.value = null;
  }
}

function stageStatus(key: StageKey): 'active' | 'done' | 'locked' {
  if (key === activeStage.value) return 'active';
  return results[key] ? 'done' : 'locked';
}

function canReroll(key: StageKey): boolean {
  return (
    activeStage.value === key &&
    !!results[key] &&
    !rerollUsed[key] &&
    spinning.value === null &&
    !finished.value
  );
}

function canSpin(): boolean {
  return (
    !!catalog.value &&
    !spinning.value &&
    !!activeStage.value &&
    !results[activeStage.value] &&
    !finished.value
  );
}

function populationFor(key: StageKey): number | null {
  if (key === 'class') return results.class?.population ?? null;
  if (key === 'ascendancy') return results.ascendancy?.build?.population ?? null;
  return null;
}

function gateStatus(
  key: StageKey,
): 'PASS' | 'BYPASS' | 'CHECKING' | 'QUEUED' | 'FAIL' | 'OPEN' | 'STREAM' {
  if (spinning.value === key) return 'CHECKING';
  const result = results[key];
  if (!result) return 'QUEUED';
  if (result.mode === 'streamers') return 'STREAM';
  if (result.mode === 'chaos') return 'OPEN';
  if (!result.verification.passed) return 'FAIL';
  return result.verification.filterEnabled === false ? 'BYPASS' : 'PASS';
}

function historyProof(roll: HistoryRoll): string | null {
  const rollMode = roll.mode ?? 'classic';
  if (rollMode === 'streamers') {
    return catalog.value?.streamers?.sourceUrl ?? 'https://poe.ninja/poe1/builds/streamers';
  }
  if (rollMode === 'chaos') return null;
  const search = `class=${roll.ascendancy}&skills=${roll.mainSkill}`;
  return `https://poe.ninja/poe1/builds/covens?search=${encodeURIComponent(search).replace(/%20/g, '+')}`;
}

function reelPool(key: StageKey): string[] {
  if (!catalog.value) return [];
  if (key === 'class') {
    if (mode.value === 'streamers') return catalog.value.streamers.classes;
    return catalog.value.classes.map((entry) => entry.name);
  }
  if (key === 'skill') {
    if (mode.value === 'streamers') {
      return classEntry.value?.streamerSkills.map((skill) => skill.name) ?? [];
    }
    if (mode.value === 'chaos') return catalog.value.allSkills;
    return classEntry.value?.skills.map((skill) => skill.name) ?? [];
  }
  if (mode.value === 'streamers') {
    const streamerSkill = classEntry.value?.streamerSkills.find(
      (entry) => entry.name === results.skill?.value,
    );
    return (
      streamerSkill?.ascendancies ??
      classEntry.value?.streamerSkills.flatMap((entry) => entry.ascendancies) ??
      []
    );
  }
  if (mode.value === 'chaos') {
    return classEntry.value?.ascendancies ?? [];
  }
  const skill = classEntry.value?.skills.find((entry) => entry.name === results.skill?.value);
  return skill?.ascendancies ?? classEntry.value?.skills.flatMap((entry) => entry.ascendancies) ?? [];
}

function startReel(key: StageKey) {
  stopReel();
  const pool = reelPool(key);
  if (!pool.length) return;
  reelValue.value = pool[Math.floor(Math.random() * pool.length)] ?? '—';
  reelTimer = setInterval(() => {
    reelValue.value = pool[Math.floor(Math.random() * pool.length)] ?? '—';
  }, 82);
}

function stopReel() {
  if (reelTimer) clearInterval(reelTimer);
  reelTimer = null;
}

async function loadCatalog() {
  loadingCatalog.value = true;
  catalogError.value = '';
  try {
    catalog.value = await $fetch<Catalog>('/api/catalog');
  } catch (fetchError) {
    catalogError.value = 'The meta snapshot could not be loaded. Try again.';
    console.warn(fetchError);
  } finally {
    loadingCatalog.value = false;
  }
}

async function loadHistory() {
  loadingHistory.value = true;
  try {
    const response = await $fetch<{ rolls: HistoryRoll[] }>('/api/history');
    history.value = response.rolls ?? [];
  } catch (fetchError) {
    console.warn(fetchError);
  } finally {
    loadingHistory.value = false;
  }
}

async function rollStage(key: StageKey, isReroll = false) {
  if (spinning.value || !catalog.value) return;
  if (isReroll && !canReroll(key)) return;
  if (!isReroll && results[key]) return;

  const className = results.class?.value;
  const mainSkill = results.skill?.value;

  if (key === 'skill' && !className) return;
  if (key === 'ascendancy' && (!className || !mainSkill)) return;

  error.value = '';
  spinning.value = key;
  startReel(key);

  const body: Record<string, unknown> = { stage: key, mode: mode.value };
  if (className) body.className = className;
  if (mainSkill) body.mainSkill = mainSkill;
  if (key !== 'class' && selectedGoalId.value) body.goal = selectedGoalId.value;
  if (isReroll) {
    body.exclude = [results[key]?.value].filter(Boolean);
    body.rerollsUsed = Object.values(rerollUsed).filter(Boolean).length + 1;
  }

  try {
    const request = $fetch<RollResult>('/api/roll', { method: 'POST', body });
    const [rolled] = await Promise.all([request, delay(1550)]);
    results[key] = rolled;
    if (key === 'class' && mode.value === 'streamers') {
      selectedClass.value = rolled.value;
    }
    if (isReroll) {
      rerollUsed[key] = true;
      message.success(
        `${stages.value.find((stage) => stage.key === key)?.short ?? 'Stage'} rerolled. One fate token spent.`,
      );
    }
  } catch (fetchError: unknown) {
    const typed = fetchError as { data?: { error?: string }; message?: string };
    error.value = typed?.data?.error ?? typed?.message ?? 'The coven refused this roll.';
    message.error(error.value);
  } finally {
    stopReel();
    spinning.value = null;
  }
}

async function reroll(key: StageKey) {
  await rollStage(key, true);
}

function advance() {
  const key = activeStage.value;
  if (!key || !results[key] || spinning.value) return;

  if (stageIndex.value < stages.value.length - 1) {
    stageIndex.value += 1;
    nextTick(() => {
      const next = activeStage.value;
      if (next) {
        document.getElementById(`stage-${next}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (key === 'class' && mode.value === 'streamers') {
        window.setTimeout(() => {
          if (activeStage.value === 'skill' && !results.skill) void rollStage('skill');
        }, 420);
      }
    });
    return;
  }

  const build = results.ascendancy?.build;
  if (!build) return;
  stageIndex.value = stages.value.length;
  const rerollsUsed = Object.values(rerollUsed).filter(Boolean).length;

  void $fetch('/api/history', {
    method: 'POST',
    body: {
      mode: results.ascendancy?.mode ?? mode.value,
      className: build.className,
      ascendancy: build.ascendancy,
      mainSkill: build.mainSkill,
      goalId: selectedGoal.value?.id ?? null,
      goalName: selectedGoal.value?.name ?? null,
      matchFloor: results.ascendancy?.verification.floor ?? 0,
      rerollsUsed,
    },
  })
    .then(() => loadHistory())
    .catch((historyError) => console.warn(historyError));

  nextTick(() => {
    document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function resetRoulette() {
  if (!started.value || !results.class || !selectedGoal.value) {
    changeSelection();
    return;
  }

  copied.value = false;
  error.value = '';
  stopReel();

  if (mode.value === 'streamers') {
    stageIndex.value = 0;
    spinning.value = null;
    selectedClass.value = null;
    results.class = null;
    results.skill = null;
    results.ascendancy = null;
    rerollUsed.class = false;
    rerollUsed.skill = false;
    rerollUsed.ascendancy = false;
    nextTick(() => {
      scrollToRoulette();
      window.setTimeout(() => {
        if (activeStage.value === 'class' && !results.class) void rollStage('class');
      }, 420);
    });
    return;
  }

  stageIndex.value = 1;
  spinning.value = null;
  results.skill = null;
  results.ascendancy = null;
  rerollUsed.skill = false;
  rerollUsed.ascendancy = false;

  nextTick(() => {
    scrollToRoulette();
    window.setTimeout(() => {
      if (activeStage.value === 'skill' && !results.skill) {
        void rollStage('skill');
      }
    }, 420);
  });
}

function changeSelection() {
  started.value = false;
  stageIndex.value = 0;
  spinning.value = null;
  stopReel();
  for (const stage of stages.value) {
    results[stage.key] = null;
    rerollUsed[stage.key] = false;
  }
  if (mode.value === 'streamers') selectedClass.value = null;
  copied.value = false;
  error.value = '';
  nextTick(() => scrollToStart());
}

async function copyBuild() {
  if (!finalBuild.value || !finalVerification.value) return;
  const lines = [
    `${finalBuild.value.mainSkill} ${finalBuild.value.ascendancy} (${finalBuild.value.className}) — Path of Exile 1, Covens of Umbra 3.30.`,
    selectedGoal.value ? `Target: ${selectedGoal.value.name}.` : '',
  ];

  if (finalMode.value === 'streamers' && finalStreamer.value) {
    lines.push(
      `Streamer build: ${finalStreamer.value.streamer} (${finalStreamer.value.character}), level ${finalStreamer.value.level}, ${finalStreamer.value.league}.`,
      finalStreamer.value.secondAscendancy
        ? `Second ascendancy: ${finalStreamer.value.secondAscendancy}.`
        : '',
    );
  } else if (finalMode.value === 'chaos') {
    lines.push('Mode: Chaos — no class skill filter and no PoE.ninja population gate.');
  } else {
    lines.push(
      finalVerification.value.filterEnabled === false
        ? 'PoE.ninja gate: disabled by the keeper; this class skill was not gated.'
        : `PoE.ninja gate: at least ${finalVerification.value.threshold}% of ${finalBuild.value.className} plays this main skill in Covens + SSF Covens.`,
    );
  }

  lines.push(proofLink.value ?? '');

  try {
    await navigator.clipboard.writeText(lines.filter(Boolean).join('\n'));
    copied.value = true;
    message.success('Build copied to the clipboard.');
    setTimeout(() => {
      copied.value = false;
    }, 2400);
  } catch {
    message.error('Clipboard access was refused by the browser.');
  }
}

onMounted(async () => {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('poe-roulette-mode');
    if (stored === 'classic' || stored === 'chaos' || stored === 'streamers') {
      mode.value = stored;
    }
  }
  await Promise.all([loadCatalog(), loadGoals(), loadHistory()]);
});

</script>

<template>
  <div class="roulette-page">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow"><span class="eyebrow-rule" /> PATH OF EXILE 1 <i>·</i> COVENS OF UMBRA</p>
        <h1>
          Choose your exile.
          <em>Name your prey.</em>
        </h1>
        <p class="lede">
          <template v-if="mode === 'classic'">
            Pick a class and a pinnacle target, then let the wheel choose the skill and
            ascendancy that get you there.
            <template v-if="gateEnabled">
              Every result is checked against a bundled PoE.ninja ladder snapshot
              <strong>before</strong> it is revealed.
            </template>
            <template v-else>
              The keeper has switched off the PoE.ninja floor, so results are revealed
              <strong>unfiltered</strong>.
            </template>
          </template>
          <template v-else-if="mode === 'chaos'">
            Every filter is off. Pick a class and a target, then let the wheel put
            <strong>any main skill</strong> on it. No class pool, no population gate,
            no rescue.
          </template>
          <template v-else>
            The class is not yours to pick. A complete build from the poe.ninja
            <strong>Streamers</strong> tab supplies the class, the main skill, and the
            ascendancy. You still choose what they are hunting.
          </template>
        </p>
        <div class="hero-actions">
          <a-button type="primary" size="large" @click="goToStart">
            <ThunderboltFilled />
            {{
              started
                ? 'Back to the rite'
                : mode === 'streamers'
                  ? 'Let the streamers choose'
                  : 'Choose your exile'
            }}
          </a-button>
          <a class="hero-link" href="#gate">
            {{
              mode === 'streamers'
                ? 'How the streamer draw works'
                : mode === 'chaos'
                  ? 'What Chaos opens'
                  : 'How the gate works'
            }}
            <ArrowRightOutlined />
          </a>
          <NuxtLink to="/achievements" class="hero-link">
            Achievements
            <ArrowRightOutlined />
          </NuxtLink>
        </div>
        <div class="hero-chips">
          <template v-if="mode === 'classic'">
            <span v-if="gateEnabled"><CheckOutlined /> Pre-checked before reveal</span>
            <span v-else><UnlockOutlined /> PoE.ninja filter off</span>
            <span><ReloadOutlined /> One reroll per rolled stage</span>
            <span><SafetyCertificateOutlined /> {{ goalCount }} pinnacle targets</span>
          </template>
          <template v-else-if="mode === 'chaos'">
            <span><ExperimentOutlined /> No class skill filter</span>
            <span><UnlockOutlined /> No population gate</span>
            <span><ReloadOutlined /> One reroll per rolled stage</span>
            <span><SafetyCertificateOutlined /> {{ goalCount }} pinnacle targets</span>
          </template>
          <template v-else>
            <span><TeamOutlined /> {{ catalog?.streamers?.builds ?? 0 }} streamer builds</span>
            <span><ExportOutlined /> poe.ninja Streamers tab</span>
            <span><ReloadOutlined /> One reroll per rolled stage</span>
            <span><SafetyCertificateOutlined /> {{ goalCount }} pinnacle targets</span>
          </template>
        </div>
      </div>

      <aside class="snapshot-card">
        <div class="snapshot-top">
          <span class="snapshot-dot" :class="{ muted: mode !== 'classic' }" />
          <span>
            {{
              mode === 'streamers'
                ? 'STREAMER SNAPSHOT'
                : mode === 'chaos'
                  ? 'OPEN RULESET'
                  : 'VERIFIED SNAPSHOT'
            }}
          </span>
        </div>
        <p class="snapshot-date">{{ formattedSnapshot }}</p>
        <p class="snapshot-league">
          {{
            mode === 'streamers'
              ? 'poe.ninja Streamers'
              : mode === 'chaos'
                ? 'No gate'
                : 'Covens of Umbra'
          }}
          <span>/ {{ mode === 'streamers' ? 'Covens + SSF' : mode === 'chaos' ? 'ANY SKILL' : '3.30' }}</span>
        </p>
        <div class="snapshot-rule" />
        <div class="snapshot-stats">
          <template v-if="mode === 'streamers'">
            <div>
              <b>{{ formatNumber(catalog?.streamers?.builds) }}</b>
              <small>streamer builds</small>
            </div>
            <div>
              <b>{{ formatNumber(catalog?.streamers?.streamers) }}</b>
              <small>streamers</small>
            </div>
          </template>
          <template v-else-if="mode === 'chaos'">
            <div>
              <b>{{ formatNumber(catalog?.allSkills?.length) }}</b>
              <small>skills in play</small>
            </div>
            <div>
              <b>{{ catalog?.stats.classes ?? '—' }}</b>
              <small>base classes</small>
            </div>
          </template>
          <template v-else>
            <div>
              <b>{{ formatNumber(catalog?.stats.ladderCharacters) }}</b>
              <small>ladder characters</small>
            </div>
            <div>
              <b>{{ catalog?.stats.pairings ?? '—' }}</b>
              <small>verified pairings</small>
            </div>
          </template>
        </div>
        <a
          class="source-link"
          :href="
            mode === 'streamers'
              ? 'https://poe.ninja/poe1/builds/streamers'
              : 'https://poe.ninja/poe1/builds/covens'
          "
          target="_blank"
          rel="noreferrer"
        >
          {{
            mode === 'streamers'
              ? 'Browse the Streamers tab'
              : 'Browse the PoE.ninja source'
          }}
          <ExportOutlined />
        </a>
      </aside>
    </section>

    <div class="stat-strip">
      <div v-for="stat in statCards" :key="stat.label" class="stat-cell">
        <b>{{ stat.value }}</b>
        <span>{{ stat.label }}</span>
      </div>
    </div>

    <section v-if="!started" id="start" class="selection-screen">
      <div class="mode-switch" role="tablist" aria-label="Roulette mode">
        <button
          v-for="option in MODES"
          :key="option.key"
          type="button"
          class="mode-option"
          :class="{ active: mode === option.key }"
          role="tab"
          :aria-selected="mode === option.key"
          @click="setMode(option.key)"
        >
          <span class="mode-icon"><component :is="option.icon" /></span>
          <span class="mode-copy">
            <small>{{ option.kicker }}</small>
            <b>{{ option.label }}</b>
            <span>{{ option.description }}</span>
          </span>
          <span class="mode-mark"><CheckOutlined v-if="mode === option.key" /></span>
        </button>
      </div>

      <div class="selection-heading">
        <div>
          <p class="eyebrow"><span class="eyebrow-rule" /> STAGE ZERO <i>·</i> THE CHOOSING</p>
          <h2 v-if="mode === 'streamers'">
            The streamers choose.
            <br /><em>You name the prey.</em>
          </h2>
          <h2 v-else>
            Who walks in?
            <br /><em>What are they hunting?</em>
          </h2>
        </div>
        <p class="selection-lede">
          <template v-if="mode === 'streamers'">
            {{ goalCount }} pinnacle targets. Pick one, and the draw takes a complete
            poe.ninja Streamers build for the class, skill, and ascendancy.
          </template>
          <template v-else-if="mode === 'chaos'">
            Seven exiles. {{ allSkills.length }} main skills. No class filter and no
            population gate — pick a class and a target, then let the wheel misbehave.
          </template>
          <template v-else>
            Seven exiles. {{ goalCount }} pinnacle targets. Pick one of each and the coven
            will roll the rest — the class stays yours, the build does not.
          </template>
        </p>
      </div>

      <div v-if="catalogError" class="load-error">
        <p>{{ catalogError }}</p>
        <a-button type="primary" @click="loadCatalog(); loadHistory()">Try again</a-button>
      </div>

      <div v-else-if="loadingCatalog" class="selection-loading">
        <div class="skeleton-class-grid">
          <div v-for="n in 8" :key="n" class="skeleton-class-card" />
        </div>
        <div class="skeleton-note" />
      </div>

      <div v-else class="selection-layout">
        <div v-if="mode !== 'streamers'" class="character-select">
          <div class="character-head">
            <span>SELECT YOUR EXILE</span>
            <span>{{ selectedClass ? '01 / 01' : '00 / 01' }}</span>
          </div>
          <div class="class-grid">
            <button
              v-for="(cls, index) in catalog?.classes"
              :key="cls.name"
              type="button"
              class="class-card"
              :class="{ selected: selectedClass === cls.name }"
              :style="{ '--class-color': classTheme(cls.name).color }"
              :aria-pressed="selectedClass === cls.name"
              @click="selectClass(cls.name)"
            >
              <span class="class-index">0{{ index + 1 }}</span>
              <span class="class-portrait">
                <span class="portrait-halo" />
                <svg class="portrait-bust" viewBox="0 0 64 80" aria-hidden="true">
                  <path
                    d="M32 4C18 4 8 15 8 30v16c0 14 10 25 24 25s24-11 24-25V30C56 15 46 4 32 4Z"
                    fill="currentColor"
                    opacity=".28"
                  />
                  <path
                    d="M32 15c-9 0-15 7-15 17v10c0 10 6 17 15 17s15-7 15-17V32c0-10-6-17-15-17Z"
                    fill="#0b0a08"
                  />
                  <path d="M20 31c3-7 7-10 12-10s9 3 12 10" stroke="currentColor" stroke-width="1" fill="none" opacity=".6" />
                  <circle cx="25" cy="40" r="1.7" fill="currentColor" />
                  <circle cx="39" cy="40" r="1.7" fill="currentColor" />
                  <path d="M26 51c2 2 4 3 6 3s4-1 6-3" stroke="currentColor" stroke-width="1" fill="none" opacity=".55" />
                  <path d="M32 57v14M26 64h12" stroke="currentColor" stroke-width=".7" opacity=".45" />
                </svg>
                <span class="portrait-glyph">{{ classTheme(cls.name).glyph }}</span>
                <span v-if="selectedClass === cls.name" class="chosen-seal"><CheckOutlined /></span>
              </span>

              <span class="class-card-body">
                <span class="class-epithet">{{ classTheme(cls.name).epithet }}</span>
                <strong>{{ cls.name }}</strong>
                <span class="class-meta">
                  <template v-if="mode === 'chaos'">
                    {{ allSkills.length }} skills <i>·</i> NO GATE
                  </template>
                  <template v-else>
                    {{ cls.skills.length }} skills <i>·</i> {{ cls.pairings }} pairs
                  </template>
                </span>
                <span class="class-stats">
                  <span v-for="stat in classTheme(cls.name).stats" :key="stat.label" class="class-stat">
                    <span>{{ stat.label }}</span>
                    <span class="stat-bar"><i :style="{ width: `${stat.value * 20}%` }" /></span>
                  </span>
                </span>
              </span>
            </button>

            <button
              type="button"
              class="class-card random-card"
              style="--class-color: #d6a34b"
              :disabled="!catalog?.classes.length || !goalViews.length"
              aria-label="Randomly choose a class and target"
              @click="randomizeSelection"
            >
              <span class="class-index">{{ String((catalog?.classes.length ?? 7) + 1).padStart(2, '0') }}</span>
              <span class="class-portrait random-portrait">
                <span class="random-halo" />
                <span class="random-glyph">?</span>
                <span class="random-spark random-spark-a" />
                <span class="random-spark random-spark-b" />
                <span class="random-spark random-spark-c" />
              </span>
              <span class="class-card-body">
                <span class="class-epithet">LET FATE CHOOSE</span>
                <strong>Random</strong>
                <span class="class-meta">Class <i>·</i> Target</span>
                <span class="random-copy">Roll both picks</span>
              </span>
            </button>
          </div>
        </div>

        <div v-else class="streamer-deck">
          <div class="character-head">
            <span>STREAMER DRAW</span>
            <span>{{ streamerSummary?.builds ?? 0 }} BUILDS</span>
          </div>

          <div class="streamer-source">
            <span class="streamer-sigil"><TeamOutlined /></span>
            <div>
              <small>POE.NINJA / STREAMERS</small>
              <b>Covens + SSF Covens</b>
              <p>
                A random complete build from the tab supplies the class. Its main skills
                and ascendancies become the pool for the next two stages.
              </p>
            </div>
          </div>

          <div class="streamer-metrics">
            <div>
              <b>{{ streamerSummary?.builds ?? 0 }}</b>
              <span>builds</span>
            </div>
            <div>
              <b>{{ streamerSummary?.streamers ?? 0 }}</b>
              <span>streamers</span>
            </div>
            <div>
              <b>{{ streamerSummary?.skills ?? 0 }}</b>
              <span>main skills</span>
            </div>
          </div>

          <div class="streamer-roster">
            <div
              v-for="sample in streamerSummary?.samples ?? []"
              :key="sample.url"
              class="streamer-chip"
            >
              <span class="streamer-avatar">{{ sample.streamer.slice(0, 2).toUpperCase() }}</span>
              <span class="streamer-chip-copy">
                <b>{{ sample.streamer }}</b>
                <small>{{ sample.className }} · {{ sample.mainSkill }}</small>
              </span>
            </div>
          </div>

          <div class="streamer-note">
            <span><ReloadOutlined /> One reroll per stage</span>
            <a :href="streamerSummary?.sourceUrl" target="_blank" rel="noreferrer">
              Open the tab <ExportOutlined />
            </a>
          </div>
        </div>

        <aside class="goal-note">
          <span class="note-tape" />
          <div class="note-head">
            <span>{{ goalSheetTitle }}</span>
            <span>{{ selectedClass ? `${completedGoals}/${goals.length}` : '—' }}</span>
          </div>
          <h3>Pick a target.</h3>
          <p class="note-sub">
            <template v-if="selectedClass">
              {{ goalCount }} things stand between {{ selectedClass }} and the void. Tick one
              off when it falls.
            </template>
            <template v-else-if="mode === 'streamers'">
              Pick the prey first. The streamer draw decides who hunts it, and the class
              hit list opens after the class lands.
            </template>
            <template v-else>
              Every class keeps a separate hit list. Choose a portrait to open one.
            </template>
          </p>

          <div v-if="goalsError" class="note-error">
            <p>{{ goalsError }}</p>
            <button type="button" @click="loadGoals">Retry</button>
          </div>
          <div v-else-if="loadingGoals" class="goal-loading">
            <span v-for="n in 6" :key="n" />
          </div>
          <div v-else-if="!selectedClass && mode !== 'streamers'" class="note-locked">
            <span class="note-lock-icon">✦</span>
            <b>Choose an exile first.</b>
            <p>Each class keeps its own target list. Select a portrait and their sheet appears.</p>
          </div>
          <div v-else class="goal-list">
            <div
              v-for="goal in goalViews"
              :key="goal.id"
              class="goal-row"
              :class="{ selected: selectedGoalId === goal.id, completed: goal.completed }"
              role="button"
              tabindex="0"
              @click="selectGoal(goal.id)"
              @keydown.enter="selectGoal(goal.id)"
              @keydown.space.prevent="selectGoal(goal.id)"
            >
              <button
                type="button"
                class="goal-check"
                :class="{ checked: goal.completed }"
                :disabled="
                  goalSaving === goal.id ||
                  (mode === 'streamers' && !selectedClass)
                "
                :aria-label="goal.completed ? `Mark ${goal.name} as not completed` : `Mark ${goal.name} as completed`"
                :title="goal.completed ? 'Mark as not completed' : 'Mark as completed'"
                @click.stop="toggleGoal(goal)"
              >
                <CheckOutlined v-if="goal.completed" />
              </button>
              <span class="goal-text">
                <b>{{ goal.name }}</b>
                <span>{{ goal.tagline }}</span>
              </span>
              <span v-if="goal.completed" class="goal-slain">SLAIN</span>
              <span v-else-if="selectedGoalId === goal.id" class="goal-pick">◉</span>
            </div>
          </div>

          <div class="note-foot">
            <template v-if="selectedClass">
              <span>{{ completedGoals }} of {{ goals.length }} targets slain for {{ selectedClass }}</span>
              <span>Click a box to mark done</span>
            </template>
            <template v-else-if="mode === 'streamers'">
              <span>The draw picks the exile</span>
              <span>Target first</span>
            </template>
            <template v-else>
              <span>Each class keeps its own hit list</span>
              <span>Pick an exile to begin</span>
            </template>
          </div>
        </aside>
      </div>

      <div class="start-bar" :class="{ ready: canStart }">
        <div class="start-picks">
          <div class="start-pick">
            <small>EXILE</small>
            <b>
              {{
                selectedClass ??
                (mode === 'streamers' ? "Streamers' choice" : 'Not chosen')
              }}
            </b>
          </div>
          <span class="start-arrow">→</span>
          <div class="start-pick">
            <small>TARGET</small>
            <b>{{ selectedGoal?.name ?? 'No target' }}</b>
          </div>
        </div>
        <div class="start-cta">
          <a-button type="primary" size="large" :disabled="!canStart" @click="startRoulette">
            <ThunderboltFilled />
            {{ mode === 'streamers' ? 'Start the draw' : 'Start the roulette' }}
          </a-button>
          <small v-if="!canStart">
            {{
              !selectedGoal
                ? 'Pick a target'
                : mode === 'streamers'
                  ? 'No streamer builds loaded'
                  : 'Choose an exile'
            }}
            to begin
          </small>
          <small v-else-if="mode === 'streamers'">
            Class and build drawn from the Streamers tab
          </small>
          <small v-else-if="mode === 'chaos'">
            Class locked · any skill can roll · no gate
          </small>
          <small v-else>Class locked · skill and ascendancy will roll</small>
        </div>
      </div>
    </section>

    <section v-if="started" id="roulette" class="roulette-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow"><span class="eyebrow-rule" /> THE RITE</p>
          <h2>The hunt for {{ selectedGoal?.name ?? 'the unknown' }}.</h2>
        </div>
        <div class="roulette-head-actions">
          <span class="mode-pill"><component :is="activeMode.icon" /> {{ activeMode.label }}</span>
          <a-button size="small" @click="changeSelection">Change picks</a-button>
          <span class="step-counter">{{ currentStepLabel }}</span>
        </div>
      </div>

      <div class="hunt-banner">
        <span class="hunt-label">TARGET</span>
        <b>{{ selectedGoal?.name }}</b>
        <em>{{ selectedGoal?.tagline }}</em>
        <span class="hunt-tip">{{ selectedGoal?.tip }}</span>
        <span v-if="selectedGoal?.completed" class="hunt-done"><CheckOutlined /> SLAIN</span>
      </div>

      <div v-if="catalogError" class="load-error">
        <p>{{ catalogError }}</p>
        <a-button type="primary" @click="loadCatalog(); loadHistory()">Try again</a-button>
      </div>

      <div v-else-if="loadingCatalog" class="console-skeleton">
        <div class="skeleton-wheel" />
        <div class="skeleton-stages">
          <div v-for="n in 3" :key="n" class="skeleton-stage" />
        </div>
      </div>

      <Transition v-else name="panel" mode="out-in">
        <div v-if="!finished" key="console" class="console">
          <aside class="wheel-column">
            <div class="wheel-wrap">
              <div class="wheel" :class="{ 'is-spinning': !!spinning, 'is-sealed': finished }">
                <div class="wheel-outer" />
                <div class="wheel-rune" />
                <div class="wheel-ticks" />
                <div class="wheel-core">
                  <span class="wheel-numeral">{{ wheelNumeral }}</span>
                  <strong>{{ wheelValue }}</strong>
                  <small>{{ wheelCaption }}</small>
                </div>
              </div>
              <span class="orbit orbit-a">CLASS</span>
              <span class="orbit orbit-b">SKILL</span>
              <span class="orbit orbit-c">ASCENDANCY</span>
            </div>

            <div class="wheel-legend">
              <div
                v-for="(stage, index) in stages"
                :key="stage.key"
                class="legend-item"
                :class="{ active: activeStage === stage.key, done: !!results[stage.key] }"
              >
                <span>0{{ index + 1 }}</span>
                <b>{{ stage.short }}</b>
                <i v-if="results[stage.key]"><CheckOutlined /></i>
              </div>
            </div>

            <p class="wheel-note">
              <template v-if="mode === 'streamers'">
                The wheel is theatre. The draw is real: every class, skill, and ascendancy
                comes from a complete poe.ninja streamer build.
              </template>
              <template v-else-if="mode === 'chaos'">
                The wheel is theatre. The gate is gone: the server does not check the class
                pool or the population before a result is revealed.
              </template>
              <template v-else>
                The wheel is theatre. The gate is real: the server filters each pool before a
                result reaches this page.
              </template>
            </p>
          </aside>

          <div class="stage-list">
            <div v-if="error" class="inline-error">{{ error }}</div>

            <article
              v-for="(stage, index) in stages"
              :id="`stage-${stage.key}`"
              :key="stage.key"
              class="stage-card"
              :class="{
                'is-active': stageStatus(stage.key) === 'active',
                'is-done': stageStatus(stage.key) === 'done',
                'is-locked': stageStatus(stage.key) === 'locked',
              }"
            >
              <div class="stage-rail">
                <span>0{{ index + 1 }}</span>
                <i />
              </div>

              <div class="stage-content">
                <div class="stage-top">
                  <p class="stage-kicker">{{ stage.kicker }}</p>
                  <span
                    v-if="stageStatus(stage.key) === 'active' && !results[stage.key]"
                    class="state-tag live"
                  >
                    IN RITE
                  </span>
                  <span
                    v-else-if="results[stage.key] && stage.key === 'class'"
                    class="state-tag chosen"
                  >
                    <CheckOutlined /> {{ mode === 'streamers' ? 'DRAWN' : 'CHOSEN' }}
                  </span>
                  <span
                    v-else-if="results[stage.key] && stageStatus(stage.key) === 'active'"
                    class="state-tag offered"
                  >
                    FATE OFFERED
                  </span>
                  <span v-else-if="results[stage.key]" class="state-tag done">
                    <CheckOutlined /> LOCKED
                  </span>
                  <span v-else class="state-tag">WAITING</span>
                </div>

                <div class="stage-heading">
                  <h3>{{ stage.title }}</h3>
                  <p>{{ stage.description }}</p>
                </div>

                <div
                  class="stage-readout"
                  :class="{ rolling: spinning === stage.key, filled: !!results[stage.key] }"
                >
                  <div class="readout-value">
                    <span v-if="spinning === stage.key" class="reel-text">{{ reelValue }}</span>
                    <span v-else-if="results[stage.key]" class="landed-text">{{ results[stage.key]?.label }}</span>
                    <span v-else class="empty-text">—</span>
                  </div>
                  <div class="readout-meta">
                    <span v-if="results[stage.key]?.detail">{{ results[stage.key]?.detail }}</span>
                    <span v-if="populationFor(stage.key)">
                      {{ formatNumber(populationFor(stage.key)) }} on the ladder
                    </span>
                    <span v-if="!results[stage.key] && spinning !== stage.key">Awaiting the roll</span>
                  </div>
                </div>

                <div
                  v-if="results[stage.key] && spinning !== stage.key"
                  class="verify-line"
                  :class="{
                    bypassed: results[stage.key]?.mode === 'chaos',
                    streamed: results[stage.key]?.mode === 'streamers',
                    'gate-off': results[stage.key]?.verification.filterEnabled === false,
                  }"
                >
                  <span class="verify-icon">
                    <TeamOutlined v-if="results[stage.key]?.mode === 'streamers'" />
                    <UnlockOutlined v-else-if="results[stage.key]?.mode === 'chaos'" />
                    <CheckOutlined v-else />
                  </span>
                  <span v-if="results[stage.key]?.mode === 'streamers'">
                    Drawn from the poe.ninja Streamers tab
                  </span>
                  <span
                    v-else-if="stage.key === 'class' && results.class?.verification.scope === 'chosen class'"
                  >
                    Chosen on the start screen
                  </span>
                  <span v-else-if="results[stage.key]?.mode === 'chaos'">
                    No class filter · no population gate
                  </span>
                  <span v-else-if="results[stage.key]?.verification.filterEnabled === false">
                    PoE.ninja filter bypassed by the keeper
                  </span>
                  <span v-else>PoE.ninja gate passed before reveal</span>
                  <span v-if="results[stage.key]?.mode === 'streamers'" class="verify-floor">
                    <template v-if="results[stage.key]?.build?.streamer?.streamer">
                      {{ results[stage.key]?.build?.streamer?.streamer }}
                    </template>
                    <template v-else>
                      {{ results[stage.key]?.verification.pairs ?? 0 }} streamer build{{
                        (results[stage.key]?.verification.pairs ?? 0) === 1 ? '' : 's'
                      }}
                    </template>
                  </span>
                  <span
                    v-else-if="results[stage.key]?.verification.floor"
                    class="verify-floor"
                  >
                    ≥{{ results[stage.key]?.verification.floor }}% of class
                  </span>
                  <span
                    v-else-if="results[stage.key]?.verification.filterEnabled === false"
                    class="verify-floor"
                  >
                    unfiltered
                  </span>
                  <span v-else class="verify-floor">
                    {{ results[stage.key]?.verification.pairs }} verified pairings
                  </span>
                </div>

                <div v-if="stageStatus(stage.key) === 'active'" class="stage-actions">
                  <template v-if="!results[stage.key]">
                    <a-button
                      type="primary"
                      size="large"
                      :loading="spinning === stage.key"
                      :disabled="!canSpin()"
                      @click="rollStage(stage.key)"
                    >
                      <ThunderboltFilled v-if="spinning !== stage.key" />
                      {{ spinning === stage.key ? 'Consulting the ladder…' : stage.action }}
                    </a-button>
                  </template>
                  <template v-else>
                    <a-button
                      size="large"
                      class="reroll-button"
                      :disabled="!canReroll(stage.key)"
                      @click="reroll(stage.key)"
                    >
                      <ReloadOutlined />
                      Reroll
                      <span class="reroll-token">{{ rerollUsed[stage.key] ? 'SPENT' : '1 LEFT' }}</span>
                    </a-button>
                    <a-button type="primary" size="large" @click="advance">
                      {{ stage.cta }}
                      <ArrowRightOutlined />
                    </a-button>
                  </template>
                </div>

                <div v-else-if="stageStatus(stage.key) === 'done'" class="locked-note">
                  <template v-if="stage.key === 'class'">
                    <span v-if="mode === 'streamers'">
                      Drawn from the Streamers tab. This class is locked for the hunt.
                    </span>
                    <span v-else>Chosen on the start screen. This class is locked for the hunt.</span>
                    <button type="button" class="locked-action" @click="changeSelection">Change</button>
                  </template>
                  <template v-else>
                    <span>Stage locked. The reroll token for this stage is gone.</span>
                    <span v-if="rerollUsed[stage.key]" class="token-spent">TOKEN SPENT</span>
                    <span v-else class="token-unused">TOKEN UNUSED</span>
                  </template>
                </div>
              </div>
            </article>
          </div>
        </div>

        <section v-else id="result" key="result" class="result-panel">
          <div class="result-halo" />
          <p class="eyebrow result-eyebrow"><span class="eyebrow-rule" /> THE COVEN HAS CHOSEN</p>
          <h2>
            {{ finalBuild?.ascendancy }}
            <span>{{ finalBuild?.mainSkill }}</span>
          </h2>
          <p class="result-sub">
            {{ finalBuild?.className }}
            <i>·</i>
            <template v-if="finalMode === 'streamers'">
              Streamer build <i>·</i> Covens + SSF Covens
            </template>
            <template v-else-if="finalMode === 'chaos'">
              Chaos <i>·</i> no gate
            </template>
            <template v-else>
              Covens of Umbra <i>·</i> 3.30
            </template>
          </p>

          <div v-if="finalMode === 'streamers' && finalStreamer" class="result-streamer">
            <div class="result-streamer-seal"><TeamOutlined /></div>
            <div class="result-streamer-copy">
              <small>STREAMER BUILD</small>
              <b>{{ finalStreamer.streamer }}</b>
              <span>
                {{ finalStreamer.character }} <i>·</i> Level {{ finalStreamer.level }}
                <i>·</i> {{ finalStreamer.league }}
              </span>
            </div>
            <div v-if="finalStreamer.secondAscendancy" class="result-streamer-second">
              <small>SECOND ASCENDANCY</small>
              <b>{{ finalStreamer.secondAscendancy }}</b>
            </div>
            <a :href="finalStreamer.url" target="_blank" rel="noreferrer">
              Open build <ExportOutlined />
            </a>
          </div>

          <div class="result-target">
            <span class="result-target-label">TARGET</span>
            <b>{{ selectedGoal?.name }}</b>
            <span class="result-target-tag">{{ selectedGoal?.tagline }}</span>
            <a-button
              v-if="selectedGoal && !selectedGoal.completed"
              size="small"
              :loading="goalSaving === selectedGoal.id"
              @click="toggleGoal(selectedGoal)"
            >
              <CheckOutlined /> Mark target completed
            </a-button>
            <span v-else class="target-complete"><CheckOutlined /> Target completed</span>
          </div>

          <div class="result-grid">
            <div>
              <small>CLASS</small>
              <b>{{ finalBuild?.className }}</b>
              <span v-if="finalMode === 'streamers'">Drawn from the streamer build</span>
              <span v-else-if="finalMode === 'chaos'">No class filter</span>
              <span v-else>{{ formatNumber(results.class?.population) }} on the ladder</span>
            </div>
            <div>
              <small>MAIN SKILL</small>
              <b>{{ finalBuild?.mainSkill }}</b>
              <span v-if="finalMode === 'streamers'">
                {{ results.skill?.options?.length ?? 1 }} streamer ascendancy path{{
                  (results.skill?.options?.length ?? 1) === 1 ? '' : 's'
                }}
              </span>
              <span v-else-if="finalMode === 'chaos'">
                {{ results.skill?.options?.length ?? 1 }} class paths · no filter
              </span>
              <span v-else>
                {{ results.skill?.options?.length ?? 1 }} ascendancy path{{
                  (results.skill?.options?.length ?? 1) === 1 ? '' : 's'
                }} verified
              </span>
            </div>
            <div>
              <small>ASCENDANCY</small>
              <b>{{ finalBuild?.ascendancy }}</b>
              <span v-if="finalMode === 'streamers'">
                Used by {{ finalVerification?.pairs ?? 1 }} streamer build{{
                  (finalVerification?.pairs ?? 1) === 1 ? '' : 's'
                }}
              </span>
              <span v-else-if="finalMode === 'chaos'">No population gate</span>
              <span v-else>{{ formatNumber(finalBuild?.population) }} on the ladder</span>
            </div>
          </div>

          <div
            class="result-verify"
            :class="{
              bypassed:
                finalMode === 'chaos' ||
                (finalMode === 'classic' && finalVerification?.filterEnabled === false),
              streamed: finalMode === 'streamers',
            }"
          >
            <div class="result-seal">
              <TeamOutlined v-if="finalMode === 'streamers'" />
              <UnlockOutlined v-else-if="finalMode === 'chaos' || finalVerification?.filterEnabled === false" />
              <SafetyCertificateOutlined v-else />
            </div>
            <div class="result-verify-copy">
              <b v-if="finalMode === 'streamers'">Complete streamer build</b>
              <b v-else-if="finalMode === 'chaos'">No gate. No class filter.</b>
              <b v-else-if="finalVerification?.filterEnabled === false">PoE.ninja gate bypassed</b>
              <b v-else>PoE.ninja gate passed</b>

              <p v-if="finalMode === 'streamers'">
                This class, main skill, and ascendancy came from
                {{ finalStreamer?.streamer ?? 'a streamer' }}'s
                {{ finalStreamer?.character ?? 'build' }} on the poe.ninja Streamers tab.
                No population floor was applied.
              </p>
              <p v-else-if="finalMode === 'chaos'">
                Chaos ignores the class skill pools and the population gate. Any of the
                {{ finalBuild?.className }} ascendancies could have sealed this build.
              </p>
              <p v-else-if="finalVerification?.filterEnabled !== false">
                At least {{ finalVerification?.threshold }}% of {{ finalBuild?.className }} plays
                this main skill in Covens + SSF Covens. The class pool was checked before the
                final result appeared.
              </p>
              <p v-else>
                The keeper has switched off the {{ finalVerification?.threshold }}% class-usage
                floor. This skill came from the captured class pool and was not gated.
              </p>
            </div>
            <div class="result-threshold">
              <b v-if="finalMode === 'streamers'">{{ finalVerification?.pairs ?? 1 }}</b>
              <b v-else-if="finalMode === 'chaos'">OPEN</b>
              <b v-else-if="finalVerification?.filterEnabled === false">OFF</b>
              <b v-else>≥{{ finalVerification?.threshold }}%</b>
              <small v-if="finalMode === 'streamers'">
                streamer build{{ (finalVerification?.pairs ?? 1) === 1 ? '' : 's' }}
              </small>
              <small v-else-if="finalMode === 'chaos'">no gate</small>
              <small v-else-if="finalVerification?.filterEnabled === false">filter</small>
              <small v-else>class usage</small>
            </div>
          </div>

          <div class="result-actions">
            <a-button type="primary" size="large" @click="resetRoulette">
              <ReloadOutlined />
              {{ mode === 'streamers' ? 'Draw another build' : 'Roll another fate' }}
            </a-button>
            <a-button size="large" @click="changeSelection">
              <ArrowRightOutlined /> Change target
            </a-button>
            <a-button size="large" @click="copyBuild">
              <CheckOutlined v-if="copied" />
              <CopyOutlined v-else />
              {{ copied ? 'Copied' : 'Copy build' }}
            </a-button>
            <a-button v-if="proofLink" size="large" :href="proofLink" target="_blank" rel="noreferrer">
              <ExportOutlined />
              {{ finalMode === 'streamers' ? 'Open streamer build' : 'Open proof' }}
            </a-button>
          </div>

          <p class="result-foot">
            Snapshot {{ formattedSnapshot }}. Live counts on PoE.ninja may move.
            <template v-if="finalMode === 'streamers'">
              Streamer builds change as the tab updates; this draw uses the captured list.
            </template>
            <template v-else-if="finalMode === 'chaos'">
              Chaos results are not checked against the ladder and carry no population floor.
            </template>
            <template v-else-if="finalVerification?.filterEnabled === false">
              The gate is currently switched off by the keeper.
            </template>
            <template v-else>
              The gate uses a conservative floor of {{ finalVerification?.threshold }}% of the class.
            </template>
          </p>
        </section>
      </Transition>
    </section>

    <section
      id="gate"
      class="gate-section"
      :class="{
        'gate-disabled': mode === 'chaos' || (mode === 'classic' && !gateEnabled),
        'gate-streamers': mode === 'streamers',
      }"
    >
      <div class="gate-copy">
        <p class="eyebrow">
          <span class="eyebrow-rule" />
          {{
            mode === 'streamers'
              ? 'THE STREAMERS TAB'
              : mode === 'chaos'
                ? 'CHAOS · NO GATE'
                : 'THE POE.NINJA GATE'
          }}
        </p>
        <h2 v-if="mode === 'streamers'">Real exiles.<br /><em>Real builds.</em></h2>
        <h2 v-else-if="mode === 'chaos'">The gate is gone.<br /><em>Fate is unfiltered.</em></h2>
        <h2 v-else-if="gateEnabled">No dead builds.<br /><em>Only strange ones.</em></h2>
        <h2 v-else>The gate is open.<br /><em>Fate is unfiltered.</em></h2>

        <p v-if="mode === 'streamers'">
          The Streamers tab is a list of complete characters played by streamers, not a
          popularity ladder. This mode draws a class from that list, then keeps the main
          skills and ascendancies those builds actually use.
        </p>
        <p v-else-if="mode === 'chaos'">
          Chaos removes both filters. Any of the {{ allSkills.length }} known main skills can
          land on any class, any of that class's ascendancies can seal it, and the server does
          not check how many characters on poe.ninja use the pairing.
        </p>
        <p v-else-if="gateEnabled">
          A build roulette is only fun if the result is real. Each class pool is taken from
          poe.ninja's Main Skills category in Covens + SSF Covens, with every skill used by
          at least 0.3% of that class.
        </p>
        <p v-else>
          The keeper has switched off the 0.3% class-usage floor. Skills from the captured
          class pools are shown without the count check.
        </p>

        <div class="gate-points">
          <div v-if="mode === 'streamers'">
            <span>01</span>
            <p>
              <b>Class from the tab.</b> A random complete build supplies the class; its
              main skills and ascendancies become the next two pools.
            </p>
          </div>
          <div v-else-if="mode === 'chaos'">
            <span>01</span>
            <p>
              <b>No class filter.</b> The {{ allSkills.length }} known main skills are one
              shared pool. The 0.3% check and the streamer pools do not apply.
            </p>
          </div>
          <div v-else>
            <span>01</span>
            <p v-if="gateEnabled">
              <b>Class-filtered, not guessed.</b> Only skills above 0.3% class usage enter the
              pool.
            </p>
            <p v-else>
              <b>Open pool.</b> The 0.3% check is skipped; the captured class skills still
              apply.
            </p>
          </div>
          <div>
            <span>02</span>
            <p>
              <b>One token per rolled stage.</b> In Classic and Chaos, skill and ascendancy
              each get one reroll. In Streamers, the class also gets one.
            </p>
          </div>
          <div v-if="mode === 'streamers'">
            <span>03</span>
            <p>
              <b>Build proof.</b> The final panel links to the streamer's character page on
              poe.ninja, not to a search query.
            </p>
          </div>
          <div v-else-if="mode === 'chaos'">
            <span>03</span>
            <p>
              <b>No proof, no gate.</b> Chaos results are deliberately allowed to be off-meta;
              the ledger records them as unfiltered.
            </p>
          </div>
          <div v-else>
            <span>03</span>
            <p>
              <b>Proof on demand.</b> Every final build links to its live PoE.ninja search.
            </p>
          </div>
        </div>
      </div>

      <div class="gate-ledger">
        <header>
          <span>
            {{
              mode === 'streamers'
                ? 'STREAMER LEDGER'
                : mode === 'chaos'
                  ? 'OPEN LEDGER'
                  : 'GATE LEDGER'
            }}
          </span>
          <b v-if="mode === 'streamers'">STREAMER TAB</b>
          <b v-else-if="mode === 'chaos'">NO GATE</b>
          <b v-else>{{ gateEnabled ? `THRESHOLD ≥${threshold}%` : 'FILTER OFF' }}</b>
        </header>
        <div v-for="(stage, index) in stages" :key="stage.key" class="gate-row">
          <span class="gate-index">0{{ index + 1 }}</span>
          <div class="gate-value">
            <small>{{ stage.short }}</small>
            <b>{{ results[stage.key]?.label ?? 'Awaiting' }}</b>
          </div>
          <span class="gate-status" :class="gateStatus(stage.key).toLowerCase()">
            {{ gateStatus(stage.key) }}
          </span>
        </div>
        <footer>
          <span v-if="mode === 'streamers'">
            <TeamOutlined /> Drawn from the Streamers tab
          </span>
          <span v-else-if="mode === 'chaos'">
            <UnlockOutlined /> No class filter, no population gate
          </span>
          <span v-else-if="gateEnabled">
            <CheckOutlined /> Checked server-side before reveal
          </span>
          <span v-else><UnlockOutlined /> Gate switched off by the keeper</span>

          <a v-if="proofLink" :href="proofLink" target="_blank" rel="noreferrer">
            {{ mode === 'streamers' ? 'STREAMER BUILD' : 'LIVE PROOF' }} <ExportOutlined />
          </a>
          <span v-else-if="mode === 'chaos'">NO PROOF NEEDED</span>
          <span v-else>PROOF UNLOCKS AT THE END</span>
        </footer>
      </div>
    </section>

    <section id="ledger" class="ledger-section">
      <div class="section-heading ledger-heading">
        <div>
          <p class="eyebrow"><span class="eyebrow-rule" /> THE LEDGER</p>
          <h2>Recent convocations.</h2>
        </div>
        <a-button size="small" :loading="loadingHistory" @click="loadHistory">
          <ReloadOutlined /> Refresh
        </a-button>
      </div>

      <div v-if="history.length" class="ledger-grid">
        <article v-for="roll in history" :key="roll.id" class="ledger-card">
          <div class="ledger-card-top">
            <span>
              {{ roll.goalName ?? 'Free hunt' }}
              <em class="ledger-mode">{{ roll.mode ?? 'classic' }}</em>
            </span>
            <span
              class="ledger-floor"
              :class="{
                open: roll.mode === 'chaos',
                stream: roll.mode === 'streamers',
              }"
            >
              <template v-if="roll.mode === 'streamers'">STREAM</template>
              <template v-else-if="roll.mode === 'chaos'">OPEN</template>
              <template v-else>≥{{ roll.matchFloor }}%</template>
            </span>
          </div>
          <h3>{{ roll.mainSkill }} <em>{{ roll.ascendancy }}</em></h3>
          <p>
            {{ roll.className }} <i>·</i> {{ roll.rerollsUsed }}
            reroll{{ roll.rerollsUsed === 1 ? '' : 's' }} <i>·</i> {{ formatRollTime(roll.createdAt) }}
          </p>
          <a
            v-if="historyProof(roll)"
            :href="historyProof(roll) ?? '#'"
            target="_blank"
            rel="noreferrer"
          >
            {{ roll.mode === 'streamers' ? 'streamers tab' : 'poe.ninja' }} <ExportOutlined />
          </a>
          <span v-else class="ledger-open">unfiltered roll</span>
        </article>
      </div>
      <div v-else class="ledger-empty">
        <span class="empty-sigil">✦</span>
        <p>No builds sealed yet. The first convocation is yours.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.roulette-page {
  padding-top: 1px;
}

/* ---------- hero ---------- */
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) 330px;
  gap: 56px;
  align-items: end;
  padding: 72px 0 40px;
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 18px;
  color: #b7a98f;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}
.eyebrow i { color: var(--nocco-primary); font-style: normal; }
.eyebrow-rule {
  display: inline-block;
  width: 26px;
  height: 1px;
  background: var(--nocco-primary);
  opacity: 0.7;
}
.hero h1 {
  margin: 0;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: clamp(46px, 6.2vw, 86px);
  font-weight: 400;
  line-height: 0.96;
  letter-spacing: -0.035em;
  color: #f4ecdd;
}
.hero h1 em {
  display: block;
  margin-top: 8px;
  color: var(--nocco-primary);
  font-weight: 400;
  font-style: italic;
  letter-spacing: -0.02em;
}
.lede {
  max-width: 620px;
  margin: 26px 0 0;
  color: #b6aa98;
  font-size: 15px;
  line-height: 1.75;
}
.lede strong { color: #e6d9c4; font-weight: 500; }
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  margin-top: 26px;
}
.hero-actions :deep(.ant-btn-lg) { min-width: 212px; height: 46px; }
.hero-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #b9a989;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
  border-bottom: 1px solid rgba(214, 163, 75, 0.24);
  padding-bottom: 3px;
}
.hero-link:hover { color: #f0cd85; border-bottom-color: rgba(214, 163, 75, 0.6); }
.hero-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 24px;
}
.hero-chips span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #a99b84;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.hero-chips span :deep(svg) { color: var(--nocco-primary); }

.snapshot-card {
  position: relative;
  padding: 22px 22px 20px;
  border: 1px solid rgba(214, 163, 75, 0.24);
  background:
    linear-gradient(155deg, rgba(214, 163, 75, 0.075), transparent 46%),
    rgba(18, 15, 10, 0.86);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.26);
}
.snapshot-card::before,
.snapshot-card::after {
  content: '';
  position: absolute;
  width: 7px;
  height: 7px;
  border-color: var(--nocco-primary);
  opacity: 0.7;
}
.snapshot-card::before { top: -1px; left: -1px; border-top: 1px solid; border-left: 1px solid; }
.snapshot-card::after { bottom: -1px; right: -1px; border-bottom: 1px solid; border-right: 1px solid; }
.snapshot-top {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #c8b99f;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.2em;
}
.snapshot-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--nocco-success);
  box-shadow: 0 0 10px rgba(141, 202, 146, 0.6);
}
.snapshot-dot.muted {
  background: var(--nocco-warning);
  box-shadow: 0 0 10px rgba(224, 171, 81, 0.6);
}
.snapshot-date {
  margin: 20px 0 2px;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 34px;
  line-height: 1;
  color: #f0e4d1;
}
.snapshot-league {
  margin: 6px 0 0;
  color: #b7a98f;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.snapshot-league span { color: #746a5b; }
.snapshot-rule {
  height: 1px;
  margin: 18px 0;
  background: linear-gradient(90deg, rgba(214, 163, 75, 0.35), transparent);
}
.snapshot-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.snapshot-stats b {
  display: block;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 22px;
  font-weight: 400;
  color: #e7d8bf;
}
.snapshot-stats small {
  display: block;
  margin-top: 3px;
  color: #7f7566;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.source-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 18px;
  color: #d6a34b;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
  border-bottom: 1px solid rgba(214, 163, 75, 0.3);
  padding-bottom: 3px;
}
.source-link:hover { color: #f0cd85; }

/* ---------- stats ---------- */
.stat-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid rgba(214, 163, 75, 0.16);
  border-bottom: 1px solid rgba(214, 163, 75, 0.16);
  background: rgba(18, 15, 10, 0.38);
}
.stat-cell {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 16px 22px;
  border-right: 1px solid rgba(214, 163, 75, 0.12);
}
.stat-cell:last-child { border-right: none; }
.stat-cell b {
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 25px;
  font-weight: 400;
  color: var(--nocco-primary);
}
.stat-cell span {
  color: #8d8170;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

/* ---------- selection screen ---------- */
.selection-screen {
  margin-top: 76px;
  scroll-margin-top: 90px;
}

/* ---------- mode switch ---------- */
.mode-switch {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 30px;
}
.mode-option {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 16px;
  align-items: start;
  gap: 11px;
  padding: 14px;
  border: 1px solid rgba(214, 163, 75, 0.16);
  background: rgba(14, 12, 9, 0.62);
  color: inherit;
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}
.mode-option:hover {
  transform: translateY(-2px);
  border-color: rgba(214, 163, 75, 0.4);
  background: rgba(20, 16, 11, 0.82);
}
.mode-option.active {
  border-color: rgba(214, 163, 75, 0.6);
  background:
    linear-gradient(140deg, rgba(214, 163, 75, 0.1), transparent 60%),
    rgba(20, 16, 11, 0.9);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);
}
.mode-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(214, 163, 75, 0.2);
  border-radius: 50%;
  color: #8f816c;
  font-size: 16px;
}
.mode-option.active .mode-icon {
  border-color: rgba(214, 163, 75, 0.55);
  color: var(--nocco-primary);
  box-shadow: 0 0 20px rgba(214, 163, 75, 0.1);
}
.mode-copy { display: flex; flex-direction: column; min-width: 0; }
.mode-copy small {
  color: #7d7262;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.14em;
}
.mode-option.active .mode-copy small { color: #c8a76a; }
.mode-copy b {
  margin-top: 2px;
  color: #e6d9c4;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 21px;
  font-weight: 400;
  line-height: 1;
}
.mode-copy span {
  margin-top: 4px;
  color: #847866;
  font-size: 10px;
  line-height: 1.45;
}
.mode-mark {
  padding-top: 4px;
  color: var(--nocco-primary);
  font-size: 10px;
}

/* ---------- streamer draft ---------- */
.streamer-deck {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgba(214, 163, 75, 0.17);
  background:
    radial-gradient(ellipse at 18% 0%, rgba(140, 170, 190, 0.06), transparent 48%),
    rgba(13, 11, 8, 0.6);
}
.streamer-source {
  display: flex;
  gap: 15px;
  padding: 16px;
  border: 1px solid rgba(214, 163, 75, 0.16);
  background: rgba(214, 163, 75, 0.035);
}
.streamer-sigil {
  display: grid;
  place-items: center;
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
  border: 1px solid rgba(214, 163, 75, 0.4);
  border-radius: 50%;
  color: var(--nocco-primary);
  font-size: 20px;
}
.streamer-source small {
  color: #8f816c;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.14em;
}
.streamer-source b {
  display: block;
  margin-top: 2px;
  color: #ebdfcc;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 24px;
  font-weight: 400;
  line-height: 1.1;
}
.streamer-source p {
  margin: 7px 0 0;
  color: #9a8c76;
  font-size: 11px;
  line-height: 1.6;
}
.streamer-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: rgba(214, 163, 75, 0.16);
  border: 1px solid rgba(214, 163, 75, 0.16);
}
.streamer-metrics > div {
  padding: 12px 14px;
  background: #0e0c09;
}
.streamer-metrics b {
  display: block;
  color: var(--nocco-primary);
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 26px;
  font-weight: 400;
  line-height: 1;
}
.streamer-metrics span {
  display: block;
  margin-top: 4px;
  color: #8d8170;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.streamer-roster {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.streamer-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid rgba(214, 163, 75, 0.13);
  background: rgba(14, 12, 9, 0.5);
}
.streamer-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 26px;
  width: 26px;
  height: 26px;
  border: 1px solid rgba(214, 163, 75, 0.24);
  border-radius: 50%;
  color: #c9b686;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.04em;
}
.streamer-chip-copy { display: flex; flex-direction: column; min-width: 0; }
.streamer-chip-copy b {
  overflow: hidden;
  color: #e1d4bf;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.streamer-chip-copy small {
  overflow: hidden;
  margin-top: 1px;
  color: #817563;
  font-size: 8px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.streamer-note {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 14px;
  padding-top: 12px;
  border-top: 1px solid rgba(214, 163, 75, 0.12);
  color: #7f7361;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.streamer-note span,
.streamer-note a { display: inline-flex; align-items: center; gap: 5px; }
.streamer-note a { color: #d6a34b; text-decoration: none; }
.streamer-note a:hover { color: #f0cd85; }
.selection-heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 350px;
  gap: 44px;
  align-items: end;
  margin-bottom: 28px;
}
.selection-heading .eyebrow { margin-bottom: 12px; }
.selection-heading h2 {
  margin: 0;
  color: #f1e6d4;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: clamp(36px, 4.5vw, 58px);
  font-weight: 400;
  line-height: 0.98;
  letter-spacing: -0.03em;
}
.selection-heading h2 em {
  color: var(--nocco-primary);
  font-weight: 400;
  font-style: italic;
}
.selection-lede {
  margin: 0;
  padding-left: 18px;
  border-left: 1px solid rgba(214, 163, 75, 0.3);
  color: #a99c89;
  font-size: 12px;
  line-height: 1.7;
}
.selection-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 24px;
  align-items: start;
}
.character-select {
  padding: 18px;
  border: 1px solid rgba(214, 163, 75, 0.17);
  background:
    radial-gradient(ellipse at 18% 0%, rgba(214, 163, 75, 0.06), transparent 48%),
    rgba(13, 11, 8, 0.6);
}
.character-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding: 0 2px 12px;
  border-bottom: 1px solid rgba(214, 163, 75, 0.14);
  color: #a99a83;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.18em;
}
.character-head span:last-child { color: var(--nocco-primary); }
.class-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.class-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(214, 163, 75, 0.14);
  background: #0e0c09;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  font: inherit;
}
.class-card:hover {
  transform: translateY(-3px);
  border-color: var(--class-color);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.3);
}
.class-card.selected {
  transform: translateY(-3px);
  border-color: var(--class-color);
  box-shadow:
    0 0 0 1px var(--class-color),
    0 18px 44px rgba(0, 0, 0, 0.34),
    0 0 30px color-mix(in srgb, var(--class-color) 18%, transparent);
}
.class-card.selected::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, transparent 50%, color-mix(in srgb, var(--class-color) 9%, transparent));
}
.random-card {
  border-style: dashed;
  background:
    linear-gradient(180deg, rgba(214, 163, 75, 0.07), rgba(14, 12, 9, 0.98) 62%),
    #0e0c09;
}
.random-card:hover {
  transform: translateY(-3px);
  border-color: rgba(214, 163, 75, 0.7);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.3), 0 0 24px rgba(214, 163, 75, 0.1);
}
.random-card:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  transform: none;
  box-shadow: none;
}
.random-card .class-card-body strong { color: #f0d6a2; }
.random-card .class-epithet { color: #d6a34b; }
.random-portrait {
  background:
    radial-gradient(circle at 50% 46%, rgba(214, 163, 75, 0.25), transparent 58%),
    repeating-conic-gradient(from 0deg at 50% 50%, rgba(214, 163, 75, 0.06) 0deg 2deg, transparent 2deg 20deg),
    linear-gradient(180deg, #17120b, #0b0907);
}
.random-halo {
  position: absolute;
  width: 94px;
  height: 94px;
  border: 1px dashed rgba(214, 163, 75, 0.5);
  border-radius: 50%;
  animation: randomOrbit 24s linear infinite;
}
.random-halo::before {
  content: '';
  position: absolute;
  inset: 9px;
  border: 1px solid rgba(214, 163, 75, 0.18);
  border-radius: 50%;
}
.random-glyph {
  position: relative;
  z-index: 2;
  color: #e0b96f;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 66px;
  line-height: 1;
  text-shadow: 0 0 26px rgba(214, 163, 75, 0.3);
  transform: translateY(-2px);
}
.random-spark {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #e0b96f;
  box-shadow: 0 0 10px rgba(214, 163, 75, 0.7);
}
.random-spark-a { top: 31px; left: 32px; }
.random-spark-b { top: 54px; right: 29px; width: 3px; height: 3px; }
.random-spark-c { bottom: 30px; left: 47px; width: 2px; height: 2px; opacity: 0.7; }
.random-copy {
  margin-top: 4px;
  color: #b9a27a;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 6px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
@keyframes randomOrbit {
  to { transform: rotate(360deg); }
}
.class-index {
  position: absolute;
  top: 8px;
  left: 9px;
  z-index: 3;
  color: rgba(226, 214, 193, 0.44);
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.1em;
}
.class-portrait {
  position: relative;
  display: grid;
  place-items: center;
  height: 142px;
  overflow: hidden;
  border-bottom: 1px solid rgba(214, 163, 75, 0.12);
  background:
    radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--class-color) 26%, transparent), transparent 56%),
    linear-gradient(180deg, #15110c, #0b0907);
}
.portrait-halo {
  position: absolute;
  top: 18px;
  width: 94px;
  height: 94px;
  border: 1px solid color-mix(in srgb, var(--class-color) 45%, transparent);
  border-radius: 50%;
  box-shadow: 0 0 34px color-mix(in srgb, var(--class-color) 18%, transparent);
}
.portrait-halo::before {
  content: '';
  position: absolute;
  inset: 9px;
  border: 1px dotted color-mix(in srgb, var(--class-color) 38%, transparent);
  border-radius: 50%;
}
.portrait-bust {
  position: relative;
  z-index: 2;
  width: 72px;
  height: 90px;
  color: var(--class-color);
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.5));
}
.portrait-glyph {
  position: absolute;
  right: 5px;
  bottom: -11px;
  color: var(--class-color);
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 62px;
  line-height: 1;
  opacity: 0.12;
  letter-spacing: -0.06em;
}
.chosen-seal {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 4;
  display: grid;
  place-items: center;
  width: 21px;
  height: 21px;
  border-radius: 50%;
  background: var(--class-color);
  color: #0b0a08;
  font-size: 10px;
  box-shadow: 0 0 18px color-mix(in srgb, var(--class-color) 40%, transparent);
}
.class-card-body {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 11px 12px 13px;
}
.class-epithet {
  color: var(--class-color);
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 6px;
  letter-spacing: 0.16em;
}
.class-card-body strong {
  color: #e9ddca;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 21px;
  font-weight: 400;
  line-height: 1;
}
.class-meta {
  margin-top: 1px;
  color: #746959;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 6px;
  letter-spacing: 0.06em;
}
.class-meta i { color: #4e473c; font-style: normal; }
.class-stats { display: grid; gap: 4px; margin-top: 6px; }
.class-stat {
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 5px;
  align-items: center;
  color: #766b5b;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 5px;
  letter-spacing: 0.05em;
}
.stat-bar {
  display: block;
  height: 3px;
  background: rgba(255, 255, 255, 0.075);
}
.stat-bar i {
  display: block;
  height: 100%;
  background: var(--class-color);
  opacity: 0.75;
}

/* ---------- target leaflet ---------- */
.goal-note {
  position: relative;
  padding: 36px 22px 18px;
  background-color: #e7dcc1;
  background-image:
    repeating-linear-gradient(0deg, transparent 0 27px, rgba(83, 62, 34, 0.075) 28px),
    radial-gradient(ellipse at 15% 10%, rgba(255, 250, 233, 0.7), transparent 46%),
    radial-gradient(ellipse at 90% 95%, rgba(124, 92, 45, 0.12), transparent 50%);
  color: #3b2f1f;
  box-shadow: 12px 18px 34px rgba(0, 0, 0, 0.32);
  transform: rotate(-0.7deg);
  clip-path: polygon(
    0 0.8%,
    8% 0,
    18% 0.9%,
    29% 0,
    41% 0.7%,
    55% 0,
    67% 0.8%,
    81% 0,
    91% 0.6%,
    100% 0,
    99.1% 9%,
    100% 20%,
    99.2% 33%,
    100% 48%,
    99.1% 62%,
    100% 77%,
    99.2% 90%,
    100% 100%,
    88% 99.2%,
    76% 100%,
    63% 99.3%,
    50% 100%,
    36% 99.2%,
    22% 100%,
    10% 99.2%,
    0 100%,
    0.7% 87%,
    0 74%,
    0.7% 59%,
    0 44%,
    0.7% 29%,
    0 14%
  );
}
.note-tape {
  position: absolute;
  top: -9px;
  left: 50%;
  width: 92px;
  height: 22px;
  transform: translateX(-50%) rotate(1.8deg);
  background: rgba(224, 211, 181, 0.68);
  border-left: 1px solid rgba(120, 94, 52, 0.16);
  border-right: 1px solid rgba(120, 94, 52, 0.16);
  box-shadow: 0 3px 9px rgba(70, 50, 20, 0.12);
}
.note-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #71583a;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.16em;
}
.note-head span:last-child { color: #8c3a2c; }
.goal-note h3 {
  margin: 15px 0 0;
  color: #2f2415;
  font-family: 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive;
  font-size: 31px;
  font-weight: 600;
  line-height: 1;
  transform: rotate(-1deg);
}
.note-sub {
  margin: 9px 0 12px;
  color: #6e5a3d;
  font-family: 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive;
  font-size: 10px;
  line-height: 1.45;
}
.goal-list { border-top: 1px dashed rgba(83, 62, 34, 0.3); }
.goal-row {
  display: grid;
  grid-template-columns: 19px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  min-height: 41px;
  padding: 8px 2px;
  border-bottom: 1px dashed rgba(83, 62, 34, 0.22);
  cursor: pointer;
  transition: background 130ms ease, padding 130ms ease;
}
.goal-row:hover { background: rgba(99, 64, 24, 0.07); }
.goal-row.selected {
  padding-left: 8px;
  border-left: 2px solid #8c3a2c;
  background: rgba(140, 58, 44, 0.08);
}
.goal-row.completed .goal-text b { text-decoration: line-through; text-decoration-thickness: 1px; }
.goal-row.completed .goal-text span { opacity: 0.6; }
.goal-check {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1px solid #6f5a3d;
  background: rgba(255, 250, 235, 0.25);
  color: #f2e8d2;
  font-size: 8px;
  cursor: pointer;
  transition: background 130ms ease, border-color 130ms ease;
}
.goal-check:hover { border-color: #8c3a2c; background: rgba(140, 58, 44, 0.12); }
.goal-check.checked { border-color: #7e2b21; background: #8c3a2c; }
.goal-check:disabled { opacity: 0.55; cursor: wait; }
.goal-text { display: flex; flex-direction: column; min-width: 0; }
.goal-text b {
  color: #352817;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.15;
}
.goal-text span {
  margin-top: 2px;
  color: #786344;
  font-size: 8px;
  line-height: 1.3;
}
.goal-slain {
  padding: 3px 5px;
  border: 1px solid rgba(126, 43, 33, 0.55);
  color: #8c3a2c;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 6px;
  letter-spacing: 0.13em;
  transform: rotate(-5deg);
}
.goal-pick { color: #8c3a2c; font-size: 10px; }
.note-foot {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding-top: 12px;
  color: #7d6747;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 6px;
  letter-spacing: 0.05em;
}
.note-error {
  padding: 10px;
  border: 1px dashed rgba(126, 43, 33, 0.5);
  color: #6f2a21;
  font-size: 10px;
}
.note-error p { margin: 0 0 6px; }
.note-error button {
  padding: 0;
  border: none;
  background: none;
  color: #7e2b21;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.note-locked {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 28px 10px 24px;
  border-top: 1px dashed rgba(83, 62, 34, 0.3);
  border-bottom: 1px dashed rgba(83, 62, 34, 0.22);
  text-align: center;
}
.note-lock-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  margin-bottom: 4px;
  border: 1px dashed rgba(83, 62, 34, 0.5);
  border-radius: 50%;
  color: #7e2b21;
  font-size: 15px;
}
.note-locked b {
  color: #3a2b18;
  font-family: 'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive;
  font-size: 15px;
}
.note-locked p {
  max-width: 230px;
  margin: 0;
  color: #776141;
  font-size: 9px;
  line-height: 1.5;
}
.goal-loading { display: grid; gap: 8px; padding: 8px 0; }
.goal-loading span {
  display: block;
  height: 36px;
  border: 1px dashed rgba(83, 62, 34, 0.25);
  animation: skeletonPulse 1.2s ease-in-out infinite alternate;
}

/* ---------- start bar ---------- */
.start-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  margin-top: 18px;
  padding: 15px 20px;
  border: 1px solid rgba(214, 163, 75, 0.2);
  background: rgba(16, 13, 9, 0.72);
  transition: border-color 180ms ease, box-shadow 180ms ease;
}
.start-bar.ready {
  border-color: rgba(214, 163, 75, 0.48);
  box-shadow: 0 0 34px rgba(214, 163, 75, 0.07);
}
.start-picks { display: flex; align-items: center; gap: 18px; min-width: 0; }
.start-pick { display: flex; flex-direction: column; gap: 2px; min-width: 120px; }
.start-pick small {
  color: #786d5d;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.16em;
}
.start-pick b {
  color: #e7dac6;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 19px;
  font-weight: 400;
  line-height: 1.1;
}
.start-arrow { color: var(--nocco-primary); font-family: Consolas, monospace; font-size: 14px; }
.start-cta { display: flex; align-items: center; gap: 13px; flex-shrink: 0; }
.start-cta small {
  max-width: 160px;
  color: #8b7e6b;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  line-height: 1.5;
  letter-spacing: 0.04em;
}
.start-cta :deep(.ant-btn-lg) { min-width: 210px; height: 44px; }

/* ---------- selection loading ---------- */
.selection-loading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 24px;
}
.skeleton-class-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.skeleton-class-card {
  height: 256px;
  border: 1px solid rgba(214, 163, 75, 0.1);
  background: rgba(255, 255, 255, 0.015);
  animation: skeletonPulse 1.2s ease-in-out infinite alternate;
}
.skeleton-note {
  height: 430px;
  border: 1px solid rgba(214, 163, 75, 0.1);
  background: rgba(255, 255, 255, 0.015);
  animation: skeletonPulse 1.2s ease-in-out infinite alternate;
}

/* ---------- section heading ---------- */
.roulette-section { margin-top: 78px; scroll-margin-top: 90px; }
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 20px;
  margin-bottom: 22px;
}
.section-heading .eyebrow { margin-bottom: 12px; }
.section-heading h2,
.gate-copy h2 {
  margin: 0;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: clamp(30px, 3.7vw, 48px);
  font-weight: 400;
  line-height: 1.02;
  letter-spacing: -0.025em;
  color: #f0e6d5;
}
.roulette-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.roulette-head-actions :deep(.ant-btn) { font-size: 8px; }
.mode-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  border: 1px solid rgba(214, 163, 75, 0.25);
  color: #c9b897;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  white-space: nowrap;
}
.mode-pill :deep(svg) { color: var(--nocco-primary); }
.step-counter {
  padding: 7px 12px;
  border: 1px solid rgba(214, 163, 75, 0.25);
  color: #c9b897;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.18em;
  white-space: nowrap;
}
.hunt-banner {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 13px;
  margin-bottom: 18px;
  padding: 11px 16px;
  border: 1px solid rgba(214, 163, 75, 0.22);
  background:
    linear-gradient(90deg, rgba(214, 163, 75, 0.07), transparent 52%),
    rgba(14, 12, 8, 0.66);
}
.hunt-label {
  color: var(--nocco-primary);
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.2em;
}
.hunt-banner b {
  color: #ebdfcc;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 19px;
  font-weight: 400;
}
.hunt-banner em {
  color: #a49379;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 12px;
}
.hunt-tip {
  margin-left: auto;
  color: #806f59;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.04em;
}
.hunt-done {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 6px;
  border: 1px solid rgba(141, 202, 146, 0.35);
  color: #8dca92;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.12em;
}

/* ---------- console ---------- */
.console {
  display: grid;
  grid-template-columns: 356px minmax(0, 1fr);
  gap: 26px;
  align-items: start;
}
.wheel-column {
  position: sticky;
  top: 96px;
  padding: 24px 22px 22px;
  border: 1px solid rgba(214, 163, 75, 0.19);
  background:
    radial-gradient(circle at 50% 16%, rgba(214, 163, 75, 0.075), transparent 44%),
    rgba(16, 13, 9, 0.66);
}
.wheel-wrap {
  position: relative;
  display: grid;
  place-items: center;
  padding: 12px 0 8px;
}
.wheel {
  position: relative;
  width: min(272px, 100%);
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 50% 50%, rgba(214, 163, 75, 0.06), transparent 52%),
    rgba(7, 6, 5, 0.7);
  border: 1px solid rgba(214, 163, 75, 0.3);
  box-shadow:
    inset 0 0 50px rgba(214, 163, 75, 0.06),
    0 0 60px rgba(214, 163, 75, 0.05);
}
.wheel::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    transparent 0 12%,
    rgba(214, 163, 75, 0.7) 12.5% 13%,
    transparent 13.5% 37%,
    rgba(214, 163, 75, 0.7) 37.5% 38%,
    transparent 38.5% 62%,
    rgba(214, 163, 75, 0.7) 62.5% 63%,
    transparent 63.5% 87%,
    rgba(214, 163, 75, 0.7) 87.5% 88%,
    transparent 88.5% 100%
  );
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 1px), #000 calc(100% - 1px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 1px), #000 calc(100% - 1px));
  pointer-events: none;
}
.wheel-outer {
  position: absolute;
  inset: 13px;
  border-radius: 50%;
  border: 1px dashed rgba(214, 163, 75, 0.4);
  animation: orbitSpin 46s linear infinite;
}
.wheel-outer::before,
.wheel-outer::after {
  content: '';
  position: absolute;
  width: 9px;
  height: 9px;
  border: 1px solid rgba(214, 163, 75, 0.75);
  transform: rotate(45deg);
  background: #0c0a07;
}
.wheel-outer::before { top: -5px; left: calc(50% - 5px); }
.wheel-outer::after { bottom: -5px; left: calc(50% - 5px); }
.wheel-rune {
  position: absolute;
  inset: 35px;
  border-radius: 50%;
  border: 1px solid rgba(214, 163, 75, 0.16);
  animation: orbitSpin 30s linear infinite reverse;
}
.wheel-rune::before {
  content: '';
  position: absolute;
  inset: 18px;
  border-radius: 50%;
  border: 1px dotted rgba(214, 163, 75, 0.24);
}
.wheel-ticks {
  position: absolute;
  inset: 7px;
  border-radius: 50%;
  background: repeating-conic-gradient(
    from 0deg,
    rgba(214, 163, 75, 0.44) 0deg 0.5deg,
    transparent 0.5deg 9deg
  );
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px));
  opacity: 0.7;
}
.wheel-core {
  position: relative;
  z-index: 2;
  width: 59%;
  aspect-ratio: 1;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 16px;
  text-align: center;
  border: 1px solid rgba(214, 163, 75, 0.4);
  background:
    radial-gradient(circle at 50% 35%, rgba(214, 163, 75, 0.16), transparent 62%),
    #0d0b08;
  box-shadow: 0 0 34px rgba(214, 163, 75, 0.1), inset 0 0 24px rgba(0, 0, 0, 0.8);
}
.wheel-core::before {
  content: '';
  position: absolute;
  inset: 7px;
  border-radius: 50%;
  border: 1px solid rgba(214, 163, 75, 0.16);
}
.wheel-numeral {
  color: rgba(214, 163, 75, 0.55);
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.26em;
}
.wheel-core strong {
  max-width: 100%;
  margin: 6px 0 5px;
  overflow-wrap: anywhere;
  color: #f2e7d5;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: clamp(18px, 2.1vw, 25px);
  font-weight: 400;
  line-height: 1.03;
}
.wheel-core small {
  color: #837765;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.16em;
}
.wheel.is-spinning .wheel-outer { animation-duration: 2.2s; }
.wheel.is-spinning .wheel-rune { animation-duration: 1.3s; }
.wheel.is-spinning .wheel-core { box-shadow: 0 0 52px rgba(214, 163, 75, 0.22), inset 0 0 24px rgba(0, 0, 0, 0.8); }
.wheel.is-spinning .wheel-core strong { animation: reelFlicker 0.16s linear infinite alternate; }

@keyframes orbitSpin { to { transform: rotate(360deg); } }
@keyframes reelFlicker {
  from { opacity: 0.7; transform: translateY(1px); }
  to { opacity: 1; transform: translateY(-1px); }
}

.orbit {
  position: absolute;
  color: #716757;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.16em;
}
.orbit-a { top: 4px; left: 50%; transform: translateX(-50%); }
.orbit-b { right: -2px; top: 50%; transform: translateY(-50%) rotate(90deg); }
.orbit-c { bottom: 4px; left: 50%; transform: translateX(-50%); }

.wheel-legend {
  display: grid;
  gap: 3px;
  margin-top: 18px;
}
.legend-item {
  display: grid;
  grid-template-columns: 26px 1fr 18px;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-left: 1px solid rgba(214, 163, 75, 0.14);
  color: #736a5c;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.13em;
}
.legend-item span { color: #514b41; }
.legend-item b { font-weight: 400; }
.legend-item i { color: var(--nocco-success); font-style: normal; display: none; }
.legend-item.active {
  border-left-color: var(--nocco-primary);
  background: rgba(214, 163, 75, 0.06);
  color: #e2d4bd;
}
.legend-item.active span { color: var(--nocco-primary); }
.legend-item.done { color: #9b8f7c; }
.legend-item.done i { display: inline; }
.wheel-note {
  margin: 18px 0 0;
  padding-top: 16px;
  border-top: 1px solid rgba(214, 163, 75, 0.12);
  color: #746a5b;
  font-size: 11px;
  line-height: 1.65;
}

/* ---------- stages ---------- */
.stage-list { display: grid; gap: 14px; }
.stage-card {
  position: relative;
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  border: 1px solid rgba(214, 163, 75, 0.14);
  background: rgba(16, 13, 9, 0.55);
  transition: border-color 180ms ease, background 180ms ease, opacity 180ms ease;
}
.stage-card.is-active {
  border-color: rgba(214, 163, 75, 0.44);
  background:
    linear-gradient(110deg, rgba(214, 163, 75, 0.06), transparent 48%),
    rgba(18, 15, 10, 0.8);
  box-shadow: 0 18px 46px rgba(0, 0, 0, 0.22);
}
.stage-card.is-active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 18px;
  bottom: 18px;
  width: 2px;
  background: var(--nocco-primary);
  box-shadow: 0 0 14px rgba(214, 163, 75, 0.52);
}
.stage-card.is-locked { opacity: 0.48; }
.stage-card.is-done { opacity: 0.86; }
.stage-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 22px 0 18px;
  border-right: 1px solid rgba(214, 163, 75, 0.11);
}
.stage-rail span {
  color: #786c59;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 20px;
}
.stage-card.is-active .stage-rail span { color: var(--nocco-primary); }
.stage-rail i { width: 1px; flex: 1; background: linear-gradient(rgba(214, 163, 75, 0.22), transparent); }
.stage-content { padding: 20px 24px 22px; min-width: 0; }
.stage-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.stage-kicker {
  margin: 0;
  color: #8f816c;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.22em;
}
.state-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #6e6455;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.14em;
}
.state-tag.live { color: var(--nocco-primary); }
.state-tag.done { color: var(--nocco-success); }
.state-tag.chosen { color: #d6b36d; }
.state-tag :deep(svg) { font-size: 8px; }
.stage-heading { margin-top: 8px; }
.stage-heading h3 {
  margin: 0;
  color: #e8ddcb;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 25px;
  font-weight: 400;
  letter-spacing: -0.01em;
}
.stage-heading p {
  margin: 5px 0 0;
  color: #8d8170;
  font-size: 12px;
  line-height: 1.55;
}
.stage-card.is-done .stage-heading p { display: none; }
.stage-readout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 74px;
  margin-top: 16px;
  padding: 12px 16px;
  border: 1px solid rgba(214, 163, 75, 0.12);
  background: rgba(8, 7, 5, 0.42);
}
.stage-readout.rolling { border-color: rgba(214, 163, 75, 0.4); }
.stage-readout.filled { border-color: rgba(214, 163, 75, 0.2); }
.readout-value { min-width: 0; }
.landed-text,
.reel-text,
.empty-text {
  display: block;
  color: #efe3d0;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: clamp(23px, 3.2vw, 34px);
  line-height: 1.1;
  overflow-wrap: anywhere;
}
.reel-text { color: var(--nocco-primary); animation: reelFlicker 0.12s linear infinite alternate; }
.empty-text { color: #514a40; }
.stage-readout.rolling .reel-text { text-shadow: 0 0 28px rgba(214, 163, 75, 0.35); }
.readout-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: right;
  color: #786e5f;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
  line-height: 1.5;
  flex-shrink: 0;
}
.verify-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 10px;
  color: #8db994;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.verify-icon {
  display: inline-grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border: 1px solid rgba(141, 202, 146, 0.4);
  color: #8dca92;
  font-size: 8px;
}
.verify-floor {
  margin-left: auto;
  color: #b8a887;
  border-left: 1px solid rgba(214, 163, 75, 0.18);
  padding-left: 9px;
}
.verify-line.bypassed { color: #d5b271; }
.verify-line.bypassed .verify-icon {
  border-color: rgba(224, 171, 81, 0.4);
  color: var(--nocco-warning);
}
.verify-line.streamed { color: #c9b68d; }
.verify-line.streamed .verify-icon {
  border-color: rgba(214, 163, 75, 0.4);
  color: var(--nocco-primary);
}
.stage-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 16px; }
.stage-actions :deep(.ant-btn) { min-width: 146px; }
.reroll-button :deep(.ant-btn) { min-width: 0; }
.reroll-token {
  margin-left: 7px;
  padding: 2px 5px;
  border: 1px solid rgba(214, 163, 75, 0.25);
  color: #c9b286;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.08em;
}
.locked-note {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  color: #736959;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.06em;
}
.token-spent { color: #9a6c56; }
.token-unused { color: #9b8b6e; }
.locked-action {
  padding: 0;
  border: none;
  background: none;
  color: #c9a45f;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.06em;
  text-decoration: underline;
  cursor: pointer;
}
.locked-action:hover { color: var(--nocco-primary); }
.inline-error {
  padding: 13px 16px;
  border: 1px solid rgba(215, 108, 88, 0.38);
  background: rgba(215, 108, 88, 0.08);
  color: #e3a396;
  font-size: 12px;
}

/* ---------- result ---------- */
.result-panel {
  position: relative;
  overflow: hidden;
  margin-top: 4px;
  padding: clamp(30px, 5vw, 62px);
  border: 1px solid rgba(214, 163, 75, 0.38);
  background:
    radial-gradient(ellipse at 50% 0%, rgba(214, 163, 75, 0.13), transparent 56%),
    linear-gradient(180deg, rgba(24, 19, 12, 0.94), rgba(12, 10, 7, 0.94));
  text-align: center;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.36);
}
.result-panel::before,
.result-panel::after {
  content: '';
  position: absolute;
  width: 34px;
  height: 34px;
  border-color: rgba(214, 163, 75, 0.6);
}
.result-panel::before { top: 10px; left: 10px; border-top: 1px solid; border-left: 1px solid; }
.result-panel::after { bottom: 10px; right: 10px; border-bottom: 1px solid; border-right: 1px solid; }
.result-halo {
  position: absolute;
  width: 460px;
  height: 460px;
  left: 50%;
  top: -250px;
  transform: translateX(-50%);
  border-radius: 50%;
  border: 1px solid rgba(214, 163, 75, 0.16);
  box-shadow: 0 0 90px rgba(214, 163, 75, 0.08);
  pointer-events: none;
}
.result-eyebrow { justify-content: center; }
.result-panel h2 {
  position: relative;
  margin: 0;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: clamp(42px, 6.2vw, 76px);
  font-weight: 400;
  line-height: 0.98;
  letter-spacing: -0.035em;
  color: #f5ead8;
}
.result-panel h2 span {
  display: block;
  margin-top: 7px;
  color: var(--nocco-primary);
  font-style: italic;
  font-weight: 400;
}
.result-sub {
  margin: 18px 0 0;
  color: #a2947e;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.result-sub i { color: var(--nocco-primary); font-style: normal; }
.result-target {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  max-width: 780px;
  margin: 18px auto 0;
  padding: 10px 14px;
  border: 1px solid rgba(214, 163, 75, 0.22);
  background: rgba(214, 163, 75, 0.045);
}
.result-target-label {
  color: var(--nocco-primary);
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.18em;
}
.result-target b {
  color: #ead8b8;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 19px;
  font-weight: 400;
}
.result-target-tag {
  color: #907e65;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 12px;
  font-style: italic;
}
.result-target :deep(.ant-btn) { margin-left: 8px; font-size: 8px; }
.result-streamer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 16px;
  max-width: 780px;
  margin: 18px auto 0;
  padding: 12px 16px;
  border: 1px solid rgba(201, 182, 141, 0.28);
  background: rgba(201, 182, 141, 0.045);
  text-align: left;
}
.result-streamer-seal {
  display: grid;
  place-items: center;
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(214, 163, 75, 0.35);
  border-radius: 50%;
  color: var(--nocco-primary);
  font-size: 17px;
}
.result-streamer-copy { flex: 1; min-width: 180px; }
.result-streamer-copy small,
.result-streamer-second small {
  display: block;
  color: #8f816c;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.14em;
}
.result-streamer-copy b {
  display: block;
  margin-top: 2px;
  color: #eadcc6;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 22px;
  font-weight: 400;
  line-height: 1.1;
}
.result-streamer-copy span {
  display: block;
  margin-top: 3px;
  color: #95866f;
  font-size: 10px;
}
.result-streamer-copy span i { color: #5d5548; font-style: normal; }
.result-streamer-second {
  padding-left: 15px;
  border-left: 1px solid rgba(214, 163, 75, 0.18);
}
.result-streamer-second b {
  display: block;
  margin-top: 2px;
  color: #d9c7a7;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 15px;
  font-weight: 400;
}
.result-streamer > a {
  color: var(--nocco-primary);
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
  text-decoration: none;
  text-transform: uppercase;
  white-space: nowrap;
}
.result-streamer > a:hover { color: #f0cd85; }
.target-complete {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 8px;
  padding: 4px 7px;
  border: 1px solid rgba(141, 202, 146, 0.3);
  color: #8dca92;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.1em;
}
.result-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  margin: 36px auto 0;
  max-width: 780px;
  background: rgba(214, 163, 75, 0.16);
  border: 1px solid rgba(214, 163, 75, 0.16);
}
.result-grid > div {
  padding: 18px 16px;
  background: #0e0c08;
  text-align: left;
}
.result-grid small {
  display: block;
  color: #7f7361;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.18em;
}
.result-grid b {
  display: block;
  margin-top: 6px;
  color: #e9ddca;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 23px;
  font-weight: 400;
  line-height: 1.1;
}
.result-grid span {
  display: block;
  margin-top: 5px;
  color: #817563;
  font-size: 10px;
}
.result-verify {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 780px;
  margin: 18px auto 0;
  padding: 14px 18px;
  border: 1px solid rgba(141, 202, 146, 0.28);
  background: rgba(141, 202, 146, 0.055);
  text-align: left;
}
.result-seal {
  display: grid;
  place-items: center;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(141, 202, 146, 0.4);
  border-radius: 50%;
  color: #9bd3a0;
  font-size: 19px;
}
.result-verify-copy { flex: 1; min-width: 0; }
.result-verify-copy b {
  color: #b7d8b9;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.result-verify-copy p {
  margin: 4px 0 0;
  color: #8fa68e;
  font-size: 11px;
  line-height: 1.55;
}
.result-threshold {
  flex: 0 0 auto;
  padding-left: 16px;
  border-left: 1px solid rgba(141, 202, 146, 0.24);
  text-align: right;
}
.result-threshold b {
  display: block;
  color: #b7d8b9;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 30px;
  font-weight: 400;
  line-height: 1;
}
.result-threshold small {
  display: block;
  margin-top: 3px;
  color: #7f9a80;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.result-verify.bypassed {
  border-color: rgba(224, 171, 81, 0.3);
  background: rgba(224, 171, 81, 0.055);
}
.result-verify.bypassed .result-seal {
  border-color: rgba(224, 171, 81, 0.4);
  color: var(--nocco-warning);
}
.result-verify.bypassed .result-verify-copy b,
.result-verify.bypassed .result-threshold b { color: #e0c08a; }
.result-verify.bypassed .result-verify-copy p { color: #a99b82; }
.result-verify.bypassed .result-threshold { border-left-color: rgba(224, 171, 81, 0.24); }
.result-verify.bypassed .result-threshold small { color: #a08f73; }
.result-verify.streamed {
  border-color: rgba(159, 192, 216, 0.3);
  background: rgba(159, 192, 216, 0.05);
}
.result-verify.streamed .result-seal {
  border-color: rgba(159, 192, 216, 0.4);
  color: #9fc0d8;
}
.result-verify.streamed .result-verify-copy b,
.result-verify.streamed .result-threshold b { color: #c4d8e6; }
.result-verify.streamed .result-verify-copy p { color: #97a8b3; }
.result-verify.streamed .result-threshold { border-left-color: rgba(159, 192, 216, 0.24); }
.result-verify.streamed .result-threshold small { color: #8499a7; }
.result-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 28px;
}
.result-foot {
  margin: 22px 0 0;
  color: #716657;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.05em;
}

/* ---------- gate ---------- */
.gate-section {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.95fr);
  gap: 64px;
  align-items: center;
  margin-top: 100px;
  padding-top: 64px;
  border-top: 1px solid rgba(214, 163, 75, 0.14);
}
.gate-copy .eyebrow { margin-bottom: 16px; }
.gate-copy h2 em { color: var(--nocco-primary); font-weight: 400; }
.gate-section.gate-disabled .gate-copy h2 em { color: var(--nocco-warning); }
.gate-section.gate-disabled .gate-ledger header b { color: var(--nocco-warning); }
.gate-section.gate-streamers .gate-copy h2 em { color: #9fc0d8; }
.gate-section.gate-streamers .gate-ledger header b { color: #9fc0d8; }
.gate-copy > p:not(.eyebrow) {
  max-width: 570px;
  margin: 22px 0 0;
  color: #a99c89;
  font-size: 14px;
  line-height: 1.75;
}
.gate-points { display: grid; gap: 12px; margin-top: 26px; }
.gate-points > div {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 12px;
  align-items: start;
}
.gate-points span {
  color: var(--nocco-primary);
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.08em;
}
.gate-points p {
  margin: 0;
  color: #8d8170;
  font-size: 12px;
  line-height: 1.6;
}
.gate-points b { color: #d9cbb5; font-weight: 500; }
.gate-ledger {
  padding: 20px;
  border: 1px solid rgba(214, 163, 75, 0.22);
  background: rgba(15, 12, 8, 0.72);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
}
.gate-ledger header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(214, 163, 75, 0.14);
  color: #a69780;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.18em;
}
.gate-ledger header b { color: var(--nocco-primary); font-weight: 400; }
.gate-row {
  display: grid;
  grid-template-columns: 30px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(214, 163, 75, 0.09);
}
.gate-index {
  color: #5d5548;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 20px;
}
.gate-value small {
  display: block;
  color: #716657;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.14em;
}
.gate-value b {
  display: block;
  margin-top: 2px;
  color: #dbcdb7;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 16px;
  font-weight: 400;
}
.gate-status {
  padding: 4px 7px;
  border: 1px solid rgba(214, 163, 75, 0.17);
  color: #766b5b;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.12em;
}
.gate-status.pass { border-color: rgba(141, 202, 146, 0.28); color: #8dca92; background: rgba(141, 202, 146, 0.05); }
.gate-status.bypass { border-color: rgba(224, 171, 81, 0.3); color: var(--nocco-warning); background: rgba(224, 171, 81, 0.05); }
.gate-status.open { border-color: rgba(224, 171, 81, 0.3); color: var(--nocco-warning); background: rgba(224, 171, 81, 0.05); }
.gate-status.stream { border-color: rgba(159, 192, 216, 0.32); color: #9fc0d8; background: rgba(159, 192, 216, 0.05); }
.gate-status.checking { border-color: rgba(214, 163, 75, 0.3); color: var(--nocco-primary); }
.gate-status.fail { border-color: rgba(215, 108, 88, 0.32); color: #d76c58; }
.gate-ledger footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px;
  padding-top: 14px;
  color: #756a59;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.1em;
}
.gate-ledger footer span { display: inline-flex; align-items: center; gap: 5px; }
.gate-ledger footer span :deep(svg) { color: #8dca92; }
.gate-ledger footer a { color: var(--nocco-primary); text-decoration: none; }
.gate-ledger footer a:hover { color: #f0cd85; }

/* ---------- ledger ---------- */
.ledger-section { margin-top: 96px; }
.ledger-heading { align-items: center; }
.ledger-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.ledger-card {
  padding: 16px 18px;
  border: 1px solid rgba(214, 163, 75, 0.14);
  background: rgba(15, 13, 9, 0.58);
  transition: border-color 160ms ease, background 160ms ease;
}
.ledger-card:hover { border-color: rgba(214, 163, 75, 0.3); background: rgba(20, 16, 11, 0.7); }
.ledger-card-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #a89980;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
.ledger-floor { color: #8dca92; }
.ledger-floor.open { color: var(--nocco-warning); }
.ledger-floor.stream { color: #9fc0d8; }
.ledger-mode {
  margin-left: 6px;
  padding: 1px 4px;
  border: 1px solid rgba(214, 163, 75, 0.17);
  color: #8c7d67;
  font-size: 6px;
  font-style: normal;
  letter-spacing: 0.1em;
}
.ledger-card h3 {
  margin: 9px 0 0;
  color: #e4d8c6;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 21px;
  font-weight: 400;
}
.ledger-card h3 em {
  color: #b8965e;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  font-style: normal;
  letter-spacing: 0.04em;
}
.ledger-card p {
  margin: 5px 0 0;
  color: #7d7262;
  font-size: 10px;
}
.ledger-card p i { color: #514a40; font-style: normal; }
.ledger-card a {
  display: inline-block;
  margin-top: 10px;
  color: #b8965e;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
}
.ledger-card a:hover { color: var(--nocco-primary); }
.ledger-open {
  display: inline-block;
  margin-top: 10px;
  color: #8a7a63;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.ledger-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 120px;
  border: 1px dashed rgba(214, 163, 75, 0.18);
  color: #736858;
  font-size: 12px;
}
.empty-sigil { color: var(--nocco-primary); }
.ledger-empty p { margin: 0; }

/* ---------- loading ---------- */
.console-skeleton {
  display: grid;
  grid-template-columns: 356px minmax(0, 1fr);
  gap: 26px;
}
.skeleton-wheel {
  aspect-ratio: 1;
  border: 1px solid rgba(214, 163, 75, 0.16);
  border-radius: 50%;
  margin: 18px;
  background: radial-gradient(circle, rgba(214, 163, 75, 0.04), transparent 60%);
  animation: skeletonPulse 1.2s ease-in-out infinite alternate;
}
.skeleton-stages { display: grid; gap: 14px; }
.skeleton-stage {
  height: 190px;
  border: 1px solid rgba(214, 163, 75, 0.1);
  background: rgba(255, 255, 255, 0.015);
  animation: skeletonPulse 1.2s ease-in-out infinite alternate;
}
@keyframes skeletonPulse { from { opacity: 0.45; } to { opacity: 0.8; } }
.load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 20px;
  border: 1px solid rgba(215, 108, 88, 0.3);
  background: rgba(215, 108, 88, 0.06);
}
.load-error p { margin: 0; color: #d9a898; font-size: 13px; }

/* ---------- ant overrides + transitions ---------- */
:deep(.ant-btn) {
  border-radius: 1px;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: transparent;
  border-color: rgba(214, 163, 75, 0.26);
  color: #cfc0a9;
  box-shadow: none;
}
:deep(.ant-btn:hover) {
  border-color: rgba(214, 163, 75, 0.58) !important;
  color: #f0e1ca !important;
  background: rgba(214, 163, 75, 0.06) !important;
}
:deep(.ant-btn-primary) {
  background: linear-gradient(180deg, #e0b35f, #bd8730) !important;
  border-color: #d2a04b !important;
  color: #1a1207 !important;
  font-weight: 700;
  box-shadow: 0 7px 24px rgba(190, 135, 47, 0.18);
}
:deep(.ant-btn-primary:hover) {
  background: linear-gradient(180deg, #efc675, #ca963d) !important;
  color: #171006 !important;
}
:deep(.ant-btn-primary:disabled) {
  background: rgba(214, 163, 75, 0.16) !important;
  border-color: rgba(214, 163, 75, 0.18) !important;
  color: #6f6352 !important;
  box-shadow: none;
}
:deep(.ant-btn-sm) { font-size: 9px; }
:deep(.ant-btn-lg) { height: 42px; padding: 0 19px; }

.panel-enter-active,
.panel-leave-active { transition: opacity 260ms ease, transform 260ms ease; }
.panel-enter-from { opacity: 0; transform: translateY(10px); }
.panel-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 1080px) {
  .hero { grid-template-columns: minmax(0, 1fr) 300px; gap: 32px; }
  .selection-heading { grid-template-columns: minmax(0, 1fr) 300px; gap: 30px; }
  .selection-layout { grid-template-columns: minmax(0, 1fr) 320px; }
  .selection-loading { grid-template-columns: minmax(0, 1fr) 320px; }
  .mode-option { grid-template-columns: 34px minmax(0, 1fr); }
  .mode-mark { display: none; }
  .mode-copy b { font-size: 19px; }
  .class-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .skeleton-class-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .console,
  .console-skeleton { grid-template-columns: 300px minmax(0, 1fr); }
  .wheel { width: 238px; }
  .stage-content { padding: 18px 20px 20px; }
  .gate-section { gap: 36px; }
}

@media (max-width: 860px) {
  .hero { grid-template-columns: 1fr; align-items: start; padding-top: 48px; }
  .snapshot-card { max-width: 420px; }
  .selection-heading { grid-template-columns: 1fr; gap: 18px; }
  .selection-lede { max-width: 620px; padding-left: 0; border-left: none; }
  .selection-layout,
  .selection-loading { grid-template-columns: 1fr; }
  .goal-note { max-width: 540px; transform: none; }
  .class-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .skeleton-class-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .console,
  .console-skeleton { grid-template-columns: 1fr; }
  .wheel-column { position: static; }
  .wheel { width: min(260px, 76vw); }
  .wheel-note { text-align: center; }
  .stat-strip { grid-template-columns: repeat(2, 1fr); }
  .stat-cell:nth-child(2) { border-right: none; }
  .stat-cell:nth-child(-n + 2) { border-bottom: 1px solid rgba(214, 163, 75, 0.12); }
  .gate-section { grid-template-columns: 1fr; gap: 30px; margin-top: 74px; padding-top: 46px; }
  .gate-copy > p:not(.eyebrow) { max-width: none; }
  .ledger-section { margin-top: 68px; }
}

@media (max-width: 600px) {
  .hero { padding-top: 38px; padding-bottom: 28px; }
  .hero h1 { font-size: clamp(42px, 13vw, 58px); }
  .lede { font-size: 14px; }
  .hero-actions { align-items: stretch; flex-direction: column; gap: 13px; }
  .hero-actions :deep(.ant-btn-lg) { width: 100%; }
  .hero-chips { display: grid; gap: 7px; }
  .snapshot-card { padding: 18px; }
  .snapshot-date { font-size: 29px; }
  .stat-cell { padding: 13px 14px; }
  .stat-cell b { font-size: 21px; }
  .stat-cell span { font-size: 7px; }
  .selection-screen { margin-top: 52px; }
  .mode-switch { grid-template-columns: 1fr; gap: 6px; }
  .mode-option { grid-template-columns: 34px minmax(0, 1fr) 16px; padding: 11px 12px; }
  .mode-mark { display: block; }
  .mode-copy b { font-size: 19px; }
  .mode-copy span { font-size: 9px; }
  .streamer-roster { grid-template-columns: 1fr; }
  .streamer-metrics > div { padding: 10px; }
  .result-streamer { align-items: flex-start; }
  .result-streamer-second { width: 100%; padding-left: 0; border-left: none; }
  .result-streamer > a { width: 100%; }
  .selection-heading h2 { font-size: clamp(33px, 11vw, 46px); }
  .character-select { padding: 12px; }
  .class-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .skeleton-class-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .class-portrait { height: 128px; }
  .goal-note { padding: 32px 16px 16px; clip-path: none; }
  .goal-note h3 { font-size: 28px; }
  .note-foot { flex-direction: column; gap: 4px; }
  .start-bar { align-items: stretch; flex-direction: column; gap: 16px; padding: 14px; }
  .start-picks { justify-content: space-between; gap: 10px; }
  .start-pick { min-width: 0; }
  .start-pick b { font-size: 16px; }
  .start-cta { align-items: stretch; flex-direction: column; gap: 8px; }
  .start-cta :deep(.ant-btn-lg) { width: 100%; }
  .start-cta small { max-width: none; }
  .section-heading { align-items: start; flex-direction: column; gap: 10px; }
  .roulette-head-actions { align-items: flex-start; flex-wrap: wrap; }
  .step-counter { align-self: flex-start; }
  .hunt-banner { align-items: flex-start; }
  .hunt-tip { width: 100%; margin-left: 0; }
  .stage-card { grid-template-columns: 36px minmax(0, 1fr); }
  .stage-rail span { font-size: 16px; }
  .stage-content { padding: 17px 14px 18px; }
  .stage-heading h3 { font-size: 22px; }
  .stage-readout { align-items: start; flex-direction: column; gap: 9px; }
  .readout-meta { text-align: left; }
  .verify-floor { margin-left: 0; width: 100%; border-left: none; padding-left: 0; }
  .stage-actions { flex-direction: column; }
  .stage-actions :deep(.ant-btn) { width: 100%; }
  .locked-note { align-items: start; flex-direction: column; gap: 6px; }
  .result-panel { padding: 30px 16px; }
  .result-grid { grid-template-columns: 1fr; }
  .result-verify { align-items: start; flex-wrap: wrap; }
  .result-threshold { margin-left: 58px; padding-left: 0; border-left: none; text-align: left; }
  .result-target { align-items: flex-start; flex-direction: column; }
  .result-target :deep(.ant-btn),
  .target-complete { margin-left: 0; }
  .result-actions { flex-direction: column; }
  .result-actions :deep(.ant-btn) { width: 100%; }
  .gate-ledger { padding: 16px; }
  .gate-ledger header { flex-direction: column; gap: 5px; }
  .ledger-grid { grid-template-columns: 1fr; }
  .load-error { align-items: start; flex-direction: column; }
}
</style>
