<script setup lang="ts">
import {
  ArrowLeftOutlined,
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
  UnlockOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { computed, onMounted, reactive, ref } from 'vue';

useHead({ title: "Keeper's Table — PoE Build Roulette" });

type GoalCategory = 'ELDRITCH' | 'ATLAS';

type AdminGoal = {
  id: string;
  name: string;
  category: GoalCategory;
  tagline: string;
  tip: string;
  active: boolean;
  sortOrder: number;
  updatedAt: string | null;
};

type AdminClass = {
  name: string;
  skills: string[];
  active: boolean;
  sortOrder: number;
  updatedAt: string | null;
  availableSkills: string[];
};

type AdminConfig = {
  goals: AdminGoal[];
  classes: AdminClass[];
  settings: { poeNinjaFilter: boolean };
  threshold: number;
  stats: {
    goals: number;
    activeGoals: number;
    classes: number;
    activeClasses: number;
    skills: number;
    rolls: number;
  };
};

type AchievementTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'MYTHIC';

type AdminAchievement = {
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

type AchievementBoard = {
  classes: Array<{ name: string; active: boolean; sortOrder: number }>;
  goals: Array<{
    id: string;
    name: string;
    category: GoalCategory;
    tagline: string;
    tip: string;
    active: boolean;
    sortOrder: number;
  }>;
  achievements: AdminAchievement[];
  stats: { total: number; claimed: number; classes: number; goals: number };
};

const ACHIEVEMENT_TIERS: AchievementTier[] = ['BRONZE', 'SILVER', 'GOLD', 'MYTHIC'];
const ACHIEVEMENT_SIGILS = ['✦', '✧', '◈', '✹', '☉', '✶', '☾', '⚔'];

const { user, loaded, refresh, login } = useAuth();

const authForm = reactive({ username: 'admin', password: '' });
const authBusy = ref(false);
const authError = ref('');

const config = ref<AdminConfig | null>(null);
const loading = ref(false);
const loadError = ref('');
const savingGate = ref(false);

const modalOpen = ref(false);
const editingId = ref<string | null>(null);
const savingGoal = ref(false);
const formError = ref('');
const removingId = ref<string | null>(null);
const resetting = ref(false);

const classModalOpen = ref(false);
const editingClass = ref<AdminClass | null>(null);
const savingClass = ref(false);
const savingClassId = ref<string | null>(null);
const classFormError = ref('');
const resettingClasses = ref(false);

const achievementBoard = ref<AchievementBoard | null>(null);
const loadingAchievements = ref(false);
const achievementsError = ref('');
const achievementClass = ref('all');
const deedModalOpen = ref(false);
const editingDeed = ref<AdminAchievement | null>(null);
const savingDeed = ref(false);
const savingDeedKey = ref<string | null>(null);
const deedFormError = ref('');
const resettingDeeds = ref(false);

const deedForm = reactive({
  title: '',
  description: '',
  tier: 'BRONZE' as AchievementTier,
  sigil: '✦',
  active: true,
});

const classForm = reactive({
  skills: [] as string[],
  active: true,
});

const form = reactive({
  name: '',
  category: 'ATLAS' as GoalCategory,
  tagline: '',
  tip: '',
  active: true,
  sortOrder: 0,
});

const isAdmin = computed(() => user.value?.role === 'admin');
const classSkillOptions = computed(() =>
  (editingClass.value?.availableSkills ?? []).map((skill) => ({ label: skill, value: skill })),
);
const goalCount = computed(() => config.value?.goals.length ?? 0);
const activeGoalCount = computed(() => config.value?.goals.filter((goal) => goal.active).length ?? 0);
const classCount = computed(() => config.value?.classes.length ?? 0);
const activeClassCount = computed(
  () => config.value?.classes.filter((entry) => entry.active).length ?? 0,
);
const skillsInPools = computed(
  () => new Set((config.value?.classes ?? []).flatMap((entry) => entry.skills)).size,
);
const previewId = computed(() => slugify(form.name));
const modalTitle = computed(() => (editingId.value ? 'Edit target' : 'Add a target'));

const achievementCount = computed(() => achievementBoard.value?.stats.total ?? 0);
const claimedAchievementCount = computed(() => achievementBoard.value?.stats.claimed ?? 0);
const achievementGoalOrder = computed(() => {
  const map = new Map<string, number>();
  (achievementBoard.value?.goals ?? []).forEach((goal, index) => map.set(goal.id, index));
  return map;
});
const achievementGroups = computed(() => {
  const board = achievementBoard.value;
  if (!board) return [];
  const classes =
    achievementClass.value === 'all'
      ? board.classes
      : board.classes.filter((entry) => entry.name === achievementClass.value);

  return classes.map((entry) => {
    const deeds = board.achievements
      .filter((deed) => deed.className === entry.name)
      .sort(
        (a, b) =>
          (achievementGoalOrder.value.get(a.goalId) ?? 99) -
          (achievementGoalOrder.value.get(b.goalId) ?? 99),
      );
    const claimed = deeds.filter((deed) => deed.unlocked).length;
    return {
      ...entry,
      deeds,
      claimed,
      total: deeds.length,
      percent: deeds.length ? Math.round((claimed / deeds.length) * 100) : 0,
    };
  });
});

const CLASS_COLORS: Record<string, string> = {
  Duelist: '#c76b4a',
  Marauder: '#c58a48',
  Ranger: '#7fa46b',
  Shadow: '#8e76b2',
  Templar: '#7fa1c2',
  Witch: '#b56d9e',
  Scion: '#c9b686',
};

function classColor(name: string): string {
  return CLASS_COLORS[name] ?? '#d6a34b';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
}

function apiError(error: unknown): string {
  const typed = error as { data?: { error?: string }; statusMessage?: string; message?: string };
  return typed?.data?.error ?? typed?.statusMessage ?? typed?.message ?? 'The table refused that change.';
}

async function loadConfig() {
  loading.value = true;
  loadError.value = '';
  try {
    config.value = await $fetch<AdminConfig>('/api/admin/config');
  } catch (error) {
    loadError.value = apiError(error);
    if ((error as { statusCode?: number })?.statusCode === 401) {
      await refresh();
    }
  } finally {
    loading.value = false;
  }
}

async function loadAchievements() {
  loadingAchievements.value = true;
  achievementsError.value = '';
  try {
    achievementBoard.value = await $fetch<AchievementBoard>('/api/admin/achievements');
    if (
      achievementClass.value !== 'all' &&
      !achievementBoard.value.classes.some((entry) => entry.name === achievementClass.value)
    ) {
      achievementClass.value = 'all';
    }
  } catch (error) {
    achievementsError.value = apiError(error);
    if ((error as { statusCode?: number })?.statusCode === 401) {
      await refresh();
    }
  } finally {
    loadingAchievements.value = false;
  }
}

function deedKey(deed: AdminAchievement): string {
  return `${deed.className}:${deed.goalId}`;
}

function deedGoal(deed: AdminAchievement): AchievementBoard['goals'][number] | undefined {
  return achievementBoard.value?.goals.find((goal) => goal.id === deed.goalId);
}

function deedGoalName(deed: AdminAchievement): string {
  return deedGoal(deed)?.name ?? deed.goalId;
}

function deedGoalCategory(deed: AdminAchievement): string {
  return deedGoal(deed)?.category ?? 'ATLAS';
}

async function signIn() {
  authError.value = '';
  if (!authForm.username.trim() || !authForm.password) {
    authError.value = 'Enter the admin name and password.';
    return;
  }

  authBusy.value = true;
  try {
    await login(authForm.username.trim(), authForm.password);
    if (!isAdmin.value) {
      authError.value = 'That account cannot edit the leaflet.';
      return;
    }
    authForm.password = '';
    await Promise.all([loadConfig(), loadAchievements()]);
  } catch {
    authError.value = 'Wrong admin name or password.';
  } finally {
    authBusy.value = false;
  }
}

async function signOut() {
  await $fetch('/api/auth/logout', { method: 'POST' });
  await refresh();
  config.value = null;
}

async function setGate(value: boolean | string | number) {
  if (!config.value || savingGate.value) return;
  const next = Boolean(value);
  const previous = config.value.settings.poeNinjaFilter;
  config.value.settings.poeNinjaFilter = next;
  savingGate.value = true;

  try {
    const response = await $fetch<{ poeNinjaFilter: boolean }>('/api/admin/settings', {
      method: 'PUT',
      body: { poeNinjaFilter: next },
    });
    config.value.settings.poeNinjaFilter = response.poeNinjaFilter;
    message.success(
      response.poeNinjaFilter
        ? 'PoE.ninja gate enabled. The 0.3% class-usage floor is enforced again.'
        : 'PoE.ninja gate disabled. Captured class skills are now shown without the gate.',
    );
  } catch (error) {
    config.value.settings.poeNinjaFilter = previous;
    message.error(apiError(error));
  } finally {
    savingGate.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, {
    name: '',
    category: 'ATLAS',
    tagline: '',
    tip: '',
    active: true,
    sortOrder: config.value?.goals.length ?? 0,
  });
  formError.value = '';
  modalOpen.value = true;
}

function openEdit(goal: AdminGoal) {
  editingId.value = goal.id;
  Object.assign(form, {
    name: goal.name,
    category: goal.category,
    tagline: goal.tagline,
    tip: goal.tip,
    active: goal.active,
    sortOrder: goal.sortOrder,
  });
  formError.value = '';
  modalOpen.value = true;
}

async function saveGoal() {
  formError.value = '';
  if (form.name.trim().length < 2) {
    formError.value = 'Give the target a name of at least two characters.';
    return;
  }

  const body = {
    name: form.name.trim(),
    category: form.category,
    tagline: form.tagline.trim(),
    tip: form.tip.trim(),
    active: form.active,
    sortOrder: Number(form.sortOrder) || 0,
  };

  savingGoal.value = true;
  try {
    const url = editingId.value
      ? `/api/admin/goals/${encodeURIComponent(editingId.value)}`
      : '/api/admin/goals';
    const response = await $fetch<{ goals: AdminGoal[] }>(url, {
      method: editingId.value ? 'PUT' : 'POST',
      body: editingId.value ? body : { ...body, id: previewId.value },
    });
    if (config.value) config.value.goals = response.goals;
    modalOpen.value = false;
    void loadAchievements();
    message.success(editingId.value ? 'Target updated.' : 'Target added to the leaflet.');
  } catch (error) {
    formError.value = apiError(error);
  } finally {
    savingGoal.value = false;
  }
}

async function setActive(goal: AdminGoal, value: boolean | string | number) {
  if (!config.value) return;
  const next = Boolean(value);
  const previous = goal.active;
  goal.active = next;

  try {
    const response = await $fetch<{ goals: AdminGoal[] }>(
      `/api/admin/goals/${encodeURIComponent(goal.id)}`,
      {
        method: 'PUT',
        body: {
          name: goal.name,
          category: goal.category,
          tagline: goal.tagline,
          tip: goal.tip,
          active: next,
          sortOrder: goal.sortOrder,
        },
      },
    );
    config.value.goals = response.goals;
    message.success(next ? `${goal.name} is back on the leaflet.` : `${goal.name} hidden from the roulette.`);
  } catch (error) {
    goal.active = previous;
    message.error(apiError(error));
  }
}

async function removeGoal(goal: AdminGoal) {
  if (!config.value || removingId.value) return;
  removingId.value = goal.id;
  try {
    const response = await $fetch<{ goals: AdminGoal[] }>(
      `/api/admin/goals/${encodeURIComponent(goal.id)}`,
      { method: 'DELETE' },
    );
    config.value.goals = response.goals;
    void loadAchievements();
    message.success(`${goal.name} removed. Its class badges were cleared.`);
  } catch (error) {
    message.error(apiError(error));
  } finally {
    removingId.value = null;
  }
}

async function restoreDefaults() {
  if (!config.value || resetting.value) return;
  resetting.value = true;
  try {
    const response = await $fetch<{ goals: AdminGoal[] }>('/api/admin/goals/reset', {
      method: 'POST',
    });
    config.value.goals = response.goals;
    void loadAchievements();
    message.success('The original six-target leaflet is back.');
  } catch (error) {
    message.error(apiError(error));
  } finally {
    resetting.value = false;
  }
}

function openClassEdit(entry: AdminClass) {
  editingClass.value = entry;
  classForm.skills = [...entry.skills];
  classForm.active = entry.active;
  classFormError.value = '';
  classModalOpen.value = true;
}

function selectAllClassSkills() {
  classForm.skills = [...(editingClass.value?.availableSkills ?? [])];
}

function clearClassSkills() {
  classForm.skills = [];
}

async function saveClass() {
  if (!editingClass.value) return;
  classFormError.value = '';
  if (classForm.skills.length === 0) {
    classFormError.value = 'Keep at least one skill in the class pool.';
    return;
  }

  savingClass.value = true;
  try {
    const response = await $fetch<{ classes: AdminClass[] }>(
      `/api/admin/classes/${encodeURIComponent(editingClass.value.name)}`,
      {
        method: 'PUT',
        body: { skills: classForm.skills, active: classForm.active },
      },
    );
    if (config.value) config.value.classes = response.classes;
    classModalOpen.value = false;
    message.success(`${editingClass.value.name}'s skill pool saved.`);
  } catch (error) {
    classFormError.value = apiError(error);
  } finally {
    savingClass.value = false;
  }
}

async function setClassActive(entry: AdminClass, value: boolean | string | number) {
  if (!config.value || savingClassId.value) return;
  const next = Boolean(value);
  const previous = entry.active;
  entry.active = next;
  savingClassId.value = entry.name;

  try {
    const response = await $fetch<{ classes: AdminClass[] }>(
      `/api/admin/classes/${encodeURIComponent(entry.name)}`,
      {
        method: 'PUT',
        body: { skills: entry.skills, active: next },
      },
    );
    config.value.classes = response.classes;
    message.success(
      next
        ? `${entry.name} is back in the character select.`
        : `${entry.name} hidden from the character select.`,
    );
  } catch (error) {
    entry.active = previous;
    message.error(apiError(error));
  } finally {
    savingClassId.value = null;
  }
}

async function restoreClassPools() {
  if (!config.value || resettingClasses.value) return;
  resettingClasses.value = true;
  try {
    const response = await $fetch<{ classes: AdminClass[] }>('/api/admin/classes/reset', {
      method: 'POST',
    });
    config.value.classes = response.classes;
    message.success('All seven class pools restored to their verified defaults.');
  } catch (error) {
    message.error(apiError(error));
  } finally {
    resettingClasses.value = false;
  }
}

function openDeedEdit(deed: AdminAchievement) {
  editingDeed.value = deed;
  Object.assign(deedForm, {
    title: deed.title,
    description: deed.description,
    tier: deed.tier,
    sigil: deed.sigil,
    active: deed.active,
  });
  deedFormError.value = '';
  deedModalOpen.value = true;
}

async function saveDeed() {
  if (!editingDeed.value) return;
  deedFormError.value = '';
  if (deedForm.title.trim().length < 2) {
    deedFormError.value = 'Give the deed a title of at least two characters.';
    return;
  }

  savingDeed.value = true;
  try {
    achievementBoard.value = await $fetch<AchievementBoard>('/api/admin/achievements', {
      method: 'PUT',
      body: {
        className: editingDeed.value.className,
        goalId: editingDeed.value.goalId,
        title: deedForm.title.trim(),
        description: deedForm.description.trim(),
        tier: deedForm.tier,
        sigil: deedForm.sigil,
        active: deedForm.active,
      },
    });
    deedModalOpen.value = false;
    message.success('Deed saved.');
  } catch (error) {
    deedFormError.value = apiError(error);
  } finally {
    savingDeed.value = false;
  }
}

async function setDeedActive(deed: AdminAchievement, value: boolean | string | number) {
  if (!achievementBoard.value || savingDeedKey.value) return;
  const next = Boolean(value);
  const previous = deed.active;
  deed.active = next;
  savingDeedKey.value = deedKey(deed);

  try {
    achievementBoard.value = await $fetch<AchievementBoard>('/api/admin/achievements', {
      method: 'PUT',
      body: {
        className: deed.className,
        goalId: deed.goalId,
        title: deed.title,
        description: deed.description,
        tier: deed.tier,
        sigil: deed.sigil,
        active: next,
      },
    });
    message.success(next ? 'Deed visible on the board.' : 'Deed hidden from the board.');
  } catch (error) {
    deed.active = previous;
    message.error(apiError(error));
  } finally {
    savingDeedKey.value = null;
  }
}

async function restoreDeeds() {
  if (resettingDeeds.value) return;
  resettingDeeds.value = true;
  try {
    achievementBoard.value = await $fetch<AchievementBoard>('/api/admin/achievements/reset', {
      method: 'POST',
    });
    message.success('Every deed restored to its default wording and sigil.');
  } catch (error) {
    message.error(apiError(error));
  } finally {
    resettingDeeds.value = false;
  }
}

onMounted(async () => {
  if (!loaded.value) {
    try {
      await refresh();
    } catch {
      // The page still offers a sign-in form.
    }
  }
  if (isAdmin.value) await Promise.all([loadConfig(), loadAchievements()]);
});
</script>

<template>
  <div class="admin-page">
    <div v-if="!loaded" class="admin-loading">
      <span class="loading-rune">✦</span>
      <p>Opening the keeper's table…</p>
    </div>

    <section v-else-if="!user" class="keeper-gate">
      <div class="gate-sigil"><LockOutlined /></div>
      <p class="eyebrow">KEEPER'S TABLE <i>·</i> RESTRICTED</p>
      <h1>Only the keeper<br /><em>edits the leaflet.</em></h1>
      <p class="gate-copy">
        The roulette is open to every exile. The target leaflet and the PoE.ninja
        gate are kept behind the admin account.
      </p>

      <a-form layout="vertical" :model="authForm" class="gate-form" @finish="signIn">
        <a-form-item label="Admin name" name="username" :rules="[{ required: true, message: 'Enter the admin name.' }]">
          <a-input v-model:value="authForm.username" autocomplete="username" size="large" />
        </a-form-item>
        <a-form-item label="Password" name="password" :rules="[{ required: true, message: 'Enter the password.' }]">
          <a-input-password
            v-model:value="authForm.password"
            autocomplete="current-password"
            size="large"
          />
        </a-form-item>
        <a-alert v-if="authError" type="error" :message="authError" show-icon class="form-alert" />
        <a-button type="primary" html-type="submit" size="large" block :loading="authBusy">
          <UnlockOutlined /> Open the table
        </a-button>
      </a-form>

      <NuxtLink to="/" class="back-link"><ArrowLeftOutlined /> Back to the roulette</NuxtLink>
    </section>

    <section v-else-if="!isAdmin" class="keeper-gate">
      <div class="gate-sigil denied"><LockOutlined /></div>
      <p class="eyebrow">KEEPER'S TABLE <i>·</i> LOCKED</p>
      <h1>This account<br /><em>is not the keeper.</em></h1>
      <p class="gate-copy">
        You are signed in as <b>{{ user.username }}</b>, but only an admin may edit the
        targets or switch the PoE.ninja gate.
      </p>
      <div class="gate-actions">
        <a-button type="primary" @click="signOut">Sign out</a-button>
        <NuxtLink to="/"><a-button>Back to the roulette</a-button></NuxtLink>
      </div>
    </section>

    <template v-else>
      <header class="admin-head">
        <div>
          <p class="eyebrow">KEEPER'S TABLE <i>·</i> ADMIN</p>
          <h1>The leaflet<br /><em>is yours to edit.</em></h1>
          <p class="admin-lede">
            Add, remove, hide, and rewrite pinnacle targets. Class pools and the
            PoE.ninja gate belong to <b>Classic</b>; <b>Chaos</b> ignores both, and
            <b>Streamers</b> draws its class and build from the captured poe.ninja
            Streamers tab. Every target also seeds seven editable class achievements.
          </p>
        </div>
        <div class="admin-identity">
          <span class="pulse-dot" />
          <div>
            <small>KEEPER</small>
            <b>{{ user.username }}</b>
          </div>
          <a-button size="small" @click="signOut">Sign out</a-button>
        </div>
      </header>

      <div class="admin-stats">
        <div><b>{{ goalCount }}</b><span>targets on the leaflet</span></div>
        <div><b>{{ activeGoalCount }}</b><span>visible targets</span></div>
        <div><b>{{ activeClassCount }}/{{ classCount }}</b><span>classes in play</span></div>
        <div><b>{{ skillsInPools }}</b><span>skills in Classic pools</span></div>
        <div><b>{{ config?.stats.rolls ?? '—' }}</b><span>builds sealed</span></div>
      </div>

      <a-alert
        v-if="loadError"
        type="error"
        :message="loadError"
        show-icon
        class="load-alert"
      >
        <template #action>
          <a-button size="small" @click="loadConfig">Retry</a-button>
        </template>
      </a-alert>

      <div class="admin-grid">
        <section class="gate-panel">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">CLASSIC MODE GATE</p>
              <h2>PoE.ninja filter</h2>
            </div>
            <a-switch
              :checked="config?.settings.poeNinjaFilter ?? true"
              :loading="savingGate"
              checked-children="ON"
              un-checked-children="OFF"
              @change="setGate"
            />
          </div>

          <div class="gate-state" :class="{ off: config && !config.settings.poeNinjaFilter }">
            <component :is="config?.settings.poeNinjaFilter ? SafetyCertificateOutlined : UnlockOutlined" />
            <div>
              <b>
                {{ config?.settings.poeNinjaFilter ? 'Gate enforced' : 'Gate bypassed' }}
              </b>
              <p v-if="config?.settings.poeNinjaFilter">
                Only <b>Classic</b> applies the {{ config?.threshold ?? 0.3 }}% class-usage
                floor from Covens + SSF Covens. Chaos and Streamers ignore this switch.
              </p>
              <p v-else>
                The {{ config?.threshold ?? 0.3 }}% class-usage floor is off for
                <b>Classic</b>. Chaos and Streamers do not use the gate at all.
              </p>
            </div>
          </div>

          <div class="gate-note">
            <span><CheckOutlined /> Classic rolls only</span>
            <span><ReloadOutlined /> No restart required</span>
          </div>
        </section>

        <section class="rules-panel">
          <p class="panel-kicker">HOUSE RULES</p>
          <h2>How the table behaves</h2>
          <ol>
            <li><b>Three modes.</b> Classic uses the pools and gate below. Chaos ignores both. Streamers uses the captured streamer builds.</li>
            <li><b>Classic pools</b> decide which main skills can roll for that class. The target never filters the skill reel.</li>
            <li><b>Inactive classes</b> disappear from the character select; their saved pools remain.</li>
            <li><b>Inactive targets</b> disappear from the leaflet but keep their saved class badges.</li>
            <li><b>Deleting a target</b> clears every class badge and its seven achievements. History keeps the old name.</li>
            <li><b>Achievements</b> are one per class and target. Their titles, descriptions, tiers, sigils, and visibility are editable; claimed state follows the class hit list.</li>
            <li><b>Restore class pools</b> returns all seven classes to their verified Classic defaults.</li>
          </ol>
        </section>
      </div>

      <section class="class-panel">
        <div class="leaflet-head">
          <div>
            <p class="panel-kicker">CLASSES</p>
            <h2>Class skill pools</h2>
          </div>
          <div class="leaflet-actions">
            <a-popconfirm
              title="Restore every class to its verified default skill pool?"
              ok-text="Restore"
              cancel-text="Cancel"
              @confirm="restoreClassPools"
            >
              <a-button :loading="resettingClasses">
                <ReloadOutlined /> Restore class pools
              </a-button>
            </a-popconfirm>
          </div>
        </div>

        <p class="class-intro">
          A skill can only roll for a class whose pool contains it in <b>Classic</b>. Pools are
          captured from poe.ninja's Main Skills for Covens + SSF Covens at a 0.3% class-usage
          floor. Chaos and Streamers do not use these pools.
        </p>

        <div v-if="config?.classes.length" class="class-admin-grid">
          <article
            v-for="entry in config.classes"
            :key="entry.name"
            class="class-admin-card"
            :class="{ inactive: !entry.active }"
            :style="{ '--class-color': classColor(entry.name) }"
          >
            <header>
              <div class="class-admin-name">
                <span class="class-glyph">{{ entry.name.slice(0, 2).toUpperCase() }}</span>
                <div>
                  <b>{{ entry.name }}</b>
                  <small>{{ entry.skills.length }} / {{ entry.availableSkills.length }} verified skills</small>
                </div>
              </div>
              <a-switch
                size="small"
                :checked="entry.active"
                :loading="savingClassId === entry.name"
                @change="(value) => setClassActive(entry, value)"
              />
            </header>

            <div class="class-skill-chips">
              <span v-for="skill in entry.skills" :key="skill">{{ skill }}</span>
            </div>

            <footer>
              <a-button size="small" @click="openClassEdit(entry)">
                <EditOutlined /> Edit pool
              </a-button>
            </footer>
          </article>
        </div>

        <div v-else-if="!loading" class="leaflet-empty">
          <span>✦</span>
          <p>No class pools loaded.</p>
        </div>
      </section>

      <section class="deed-panel">
        <div class="leaflet-head">
          <div>
            <p class="panel-kicker">ACHIEVEMENTS</p>
            <h2>Hall of deeds</h2>
          </div>
          <div class="leaflet-actions">
            <span class="deed-summary">
              <TrophyOutlined /> {{ claimedAchievementCount }} / {{ achievementCount }} claimed
            </span>
            <a-popconfirm
              title="Replace every deed title, description, tier, and sigil with its default?"
              ok-text="Restore"
              cancel-text="Cancel"
              @confirm="restoreDeeds"
            >
              <a-button :loading="resettingDeeds">
                <ReloadOutlined /> Restore deed text
              </a-button>
            </a-popconfirm>
          </div>
        </div>

        <p class="deed-intro">
          One deed for every class and target. The matrix follows the leaflet: add a target and
          seven new deeds are seeded. Claimed state is read from the class hit list, so the keeper
          edits the wording, tier, sigil, and visibility — not the unlock itself.
        </p>

        <div class="deed-filters" role="tablist" aria-label="Filter deeds by class">
          <button
            type="button"
            class="deed-filter"
            :class="{ active: achievementClass === 'all' }"
            role="tab"
            :aria-selected="achievementClass === 'all'"
            @click="achievementClass = 'all'"
          >
            All classes
            <small>{{ claimedAchievementCount }}/{{ achievementCount }}</small>
          </button>
          <button
            v-for="entry in achievementBoard?.classes ?? []"
            :key="entry.name"
            type="button"
            class="deed-filter"
            :class="{ active: achievementClass === entry.name }"
            :style="{ '--class-color': classColor(entry.name) }"
            role="tab"
            :aria-selected="achievementClass === entry.name"
            @click="achievementClass = entry.name"
          >
            {{ entry.name }}
          </button>
        </div>

        <a-alert
          v-if="achievementsError"
          type="error"
          :message="achievementsError"
          show-icon
          class="deed-alert"
        >
          <template #action>
            <a-button size="small" @click="loadAchievements">Retry</a-button>
          </template>
        </a-alert>

        <div v-else-if="loadingAchievements && !achievementBoard" class="leaflet-loading">
          <span v-for="n in 4" :key="n" />
        </div>

        <div v-else-if="achievementGroups.length" class="deed-admin-groups">
          <article
            v-for="group in achievementGroups"
            :key="group.name"
            class="deed-admin-group"
            :style="{ '--class-color': classColor(group.name) }"
          >
            <header class="deed-admin-group-head">
              <div class="class-admin-name">
                <span class="class-glyph">{{ group.name.slice(0, 2).toUpperCase() }}</span>
                <div>
                  <b>{{ group.name }}</b>
                  <small>{{ group.claimed }} of {{ group.total }} deeds claimed</small>
                </div>
              </div>
              <div class="deed-admin-meter">
                <span>{{ group.percent }}%</span>
                <div class="meter-track"><i :style="{ width: `${group.percent}%` }" /></div>
              </div>
            </header>

            <div class="deed-admin-rows">
              <div
                v-for="deed in group.deeds"
                :key="deedKey(deed)"
                class="deed-admin-row"
                :class="{ inactive: !deed.active }"
              >
                <span class="deed-admin-sigil">{{ deed.sigil }}</span>
                <div class="deed-admin-copy">
                  <b>{{ deed.title }}</b>
                  <span>{{ deed.description || 'No description yet.' }}</span>
                  <small>{{ deedGoalName(deed) }} · {{ deedGoalCategory(deed) }}</small>
                </div>
                <span class="deed-admin-tier" :class="deed.tier.toLowerCase()">{{ deed.tier }}</span>
                <span class="deed-admin-state" :class="{ claimed: deed.unlocked }">
                  <CheckOutlined v-if="deed.unlocked" />
                  <LockOutlined v-else />
                  {{ deed.unlocked ? 'CLAIMED' : 'SEALED' }}
                </span>
                <a-switch
                  size="small"
                  :checked="deed.active"
                  :loading="savingDeedKey === deedKey(deed)"
                  @change="(value) => setDeedActive(deed, value)"
                />
                <a-button size="small" @click="openDeedEdit(deed)">
                  <EditOutlined /> Edit
                </a-button>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="leaflet-empty">
          <span>✦</span>
          <p>No deeds on the board. Add a target or restore the leaflet.</p>
        </div>
      </section>

      <section class="leaflet-panel">
        <div class="leaflet-head">
          <div>
            <p class="panel-kicker">THE LEAFLET</p>
            <h2>{{ config?.goals.length ?? 0 }} target{{ (config?.goals.length ?? 0) === 1 ? '' : 's' }}</h2>
          </div>
          <div class="leaflet-actions">
            <a-popconfirm
              title="Replace the leaflet with the original six targets?"
              ok-text="Restore"
              cancel-text="Cancel"
              @confirm="restoreDefaults"
            >
              <a-button :loading="resetting">
                <ReloadOutlined /> Restore defaults
              </a-button>
            </a-popconfirm>
            <a-button type="primary" @click="openCreate">
              <PlusOutlined /> Add target
            </a-button>
          </div>
        </div>

        <div v-if="loading && !config" class="leaflet-loading">
          <span v-for="n in 5" :key="n" />
        </div>

        <div v-else-if="config?.goals.length" class="goal-table">
          <div class="goal-table-head">
            <span>#</span>
            <span>TARGET</span>
            <span>CATEGORY</span>
            <span>VISIBLE</span>
            <span />
          </div>
          <div
            v-for="(goal, index) in config.goals"
            :key="goal.id"
            class="goal-admin-row"
            :class="{ inactive: !goal.active }"
          >
            <span class="goal-order">{{ String(index + 1).padStart(2, '0') }}</span>

            <div class="goal-identity">
              <b>{{ goal.name }}</b>
              <span class="goal-id">{{ goal.id }}</span>
              <p>{{ goal.tagline || 'No tagline yet.' }}</p>
            </div>

            <span class="category-tag" :class="goal.category.toLowerCase()">{{ goal.category }}</span>

            <a-switch
              size="small"
              :checked="goal.active"
              @change="(value) => setActive(goal, value)"
            />

            <div class="row-actions">
              <a-button size="small" @click="openEdit(goal)">
                <EditOutlined /> Edit
              </a-button>
              <a-popconfirm
                :title="`Remove ${goal.name} and its class badges?`"
                ok-text="Remove"
                cancel-text="Keep"
                @confirm="removeGoal(goal)"
              >
                <a-button size="small" danger :loading="removingId === goal.id">
                  <DeleteOutlined />
                </a-button>
              </a-popconfirm>
            </div>
          </div>
        </div>

        <div v-else-if="!loading" class="leaflet-empty">
          <span>✦</span>
          <p>No targets left. Add one or restore the original leaflet.</p>
        </div>
      </section>

      <p class="admin-foot">
        Changes are stored in SQLite and applied on the next request.
        <NuxtLink to="/">Return to the roulette <ArrowLeftOutlined /></NuxtLink>
      </p>
    </template>

    <a-modal
      v-model:open="modalOpen"
      :title="modalTitle"
      :footer="null"
      width="680px"
      :destroy-on-close="false"
      class="goal-modal"
    >
      <a-form layout="vertical" :model="form" class="goal-form" @finish="saveGoal">
        <a-form-item label="Target name" name="name" required>
          <a-input v-model:value="form.name" size="large" placeholder="e.g. The Maven's Memory" />
        </a-form-item>

        <div class="form-grid">
          <a-form-item label="Category">
            <a-select v-model:value="form.category">
              <a-select-option value="ELDRITCH">Eldritch</a-select-option>
              <a-select-option value="ATLAS">Atlas</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="Order">
            <a-input-number v-model:value="form.sortOrder" :min="0" :max="999" style="width: 100%" />
          </a-form-item>
        </div>

        <a-form-item label="Tagline">
          <a-input v-model:value="form.tagline" placeholder="One line of dread." />
        </a-form-item>

        <a-form-item label="Fight note">
          <a-input v-model:value="form.tip" placeholder="What actually kills exiles here?" />
        </a-form-item>

        <a-form-item label="Visible on the leaflet">
          <a-switch v-model:checked="form.active" />
        </a-form-item>

        <div v-if="!editingId" class="id-preview">
          URL id <code>{{ previewId || '—' }}</code>
          <span v-if="previewId">This becomes the permanent key for progress.</span>
        </div>

        <a-alert v-if="formError" type="error" :message="formError" show-icon class="form-alert" />

        <div class="modal-actions">
          <a-button @click="modalOpen = false">Cancel</a-button>
          <a-button type="primary" html-type="submit" :loading="savingGoal">
            {{ editingId ? 'Save target' : 'Add target' }}
          </a-button>
        </div>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="classModalOpen"
      :title="editingClass ? `${editingClass.name} skill pool` : 'Class skill pool'"
      :footer="null"
      width="620px"
      :destroy-on-close="false"
    >
      <a-form layout="vertical" class="goal-form">
        <div class="pool-toolbar">
          <span>{{ classForm.skills.length }} of {{ editingClass?.availableSkills.length ?? 0 }} verified skills</span>
          <div>
            <a-button size="small" @click="selectAllClassSkills">Select all</a-button>
            <a-button size="small" @click="clearClassSkills">Clear</a-button>
          </div>
        </div>

        <a-form-item label="Main skills this class can roll">
          <a-select
            v-model:value="classForm.skills"
            mode="multiple"
            :options="classSkillOptions"
            option-filter-prop="label"
            placeholder="Choose verified class skills"
          />
          <div class="field-hint">
            Only skills with a verified {{ editingClass?.name }} pairing are offered. This pool
            is used by Classic mode only.
          </div>
        </a-form-item>

        <a-form-item label="Visible in character select">
          <a-switch v-model:checked="classForm.active" />
        </a-form-item>

        <a-alert v-if="classFormError" type="error" :message="classFormError" show-icon class="form-alert" />

        <div class="modal-actions">
          <a-button @click="classModalOpen = false">Cancel</a-button>
          <a-button type="primary" :loading="savingClass" @click="saveClass">
            Save class pool
          </a-button>
        </div>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="deedModalOpen"
      :title="
        editingDeed
          ? `${editingDeed.className} · ${deedGoalName(editingDeed)}`
          : 'Edit achievement'
      "
      :footer="null"
      width="680px"
      :destroy-on-close="false"
      class="deed-modal"
    >
      <a-form layout="vertical" :model="deedForm" class="goal-form" @finish="saveDeed">
        <a-form-item label="Achievement title" name="title" required>
          <a-input
            v-model:value="deedForm.title"
            size="large"
            :maxlength="100"
            show-count
            placeholder="The Blade of the Maven"
          />
        </a-form-item>

        <a-form-item label="Description">
          <a-textarea
            v-model:value="deedForm.description"
            :rows="3"
            :maxlength="260"
            show-count
            placeholder="What did this exile do to claim the deed?"
          />
        </a-form-item>

        <div class="form-grid">
          <a-form-item label="Tier">
            <a-select v-model:value="deedForm.tier">
              <a-select-option v-for="tier in ACHIEVEMENT_TIERS" :key="tier" :value="tier">
                {{ tier }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="Sigil">
            <a-select v-model:value="deedForm.sigil">
              <a-select-option
                v-for="sigil in ACHIEVEMENT_SIGILS"
                :key="sigil"
                :value="sigil"
              >
                <span class="sigil-option">{{ sigil }}</span>
              </a-select-option>
            </a-select>
          </a-form-item>
        </div>

        <a-form-item label="Visible on the achievement board">
          <a-switch v-model:checked="deedForm.active" />
        </a-form-item>

        <div v-if="editingDeed" class="deed-state-line" :class="{ claimed: editingDeed.unlocked }">
          <CheckOutlined v-if="editingDeed.unlocked" />
          <LockOutlined v-else />
          <span v-if="editingDeed.unlocked">
            Claimed by the class hit list. The wording can change; the claim stays tied to
            progress.
          </span>
          <span v-else>
            Still sealed. Mark {{ deedGoalName(editingDeed) }} complete on the
            {{ editingDeed.className }} hit list to claim it.
          </span>
          <small>{{ deedGoalCategory(editingDeed) }}</small>
        </div>

        <a-alert v-if="deedFormError" type="error" :message="deedFormError" show-icon class="form-alert" />

        <div class="modal-actions">
          <a-button @click="deedModalOpen = false">Cancel</a-button>
          <a-button type="primary" html-type="submit" :loading="savingDeed">
            Save deed
          </a-button>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.admin-page {
  padding: 56px 0 20px;
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

.admin-loading {
  min-height: 60vh;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 14px;
  color: #b7a98f;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
.loading-rune {
  color: var(--nocco-primary);
  font-size: 26px;
  animation: keeperPulse 2s ease-in-out infinite;
}
@keyframes keeperPulse {
  0%, 100% { opacity: 0.4; transform: scale(0.92); }
  50% { opacity: 1; transform: scale(1); }
}

/* ---------- gate / sign-in ---------- */
.keeper-gate {
  max-width: 520px;
  margin: 4vh auto 0;
  padding: 38px 38px 34px;
  border: 1px solid rgba(214, 163, 75, 0.24);
  background:
    linear-gradient(155deg, rgba(214, 163, 75, 0.07), transparent 50%),
    rgba(18, 15, 10, 0.88);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.32);
  text-align: center;
}
.gate-sigil {
  width: 52px;
  height: 52px;
  margin: 0 auto 22px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(214, 163, 75, 0.35);
  border-radius: 50%;
  color: var(--nocco-primary);
  font-size: 20px;
}
.gate-sigil.denied { color: var(--nocco-error); border-color: rgba(215, 108, 88, 0.4); }
.keeper-gate .eyebrow { justify-content: center; }
.keeper-gate h1 {
  margin: 0;
  color: #f4ecdd;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: clamp(32px, 4vw, 44px);
  font-weight: 400;
  line-height: 1.03;
  letter-spacing: -0.025em;
}
.keeper-gate h1 em { color: var(--nocco-primary); font-style: italic; }
.gate-copy {
  margin: 18px auto 24px;
  max-width: 410px;
  color: #ad9f8a;
  font-size: 13px;
  line-height: 1.7;
}
.gate-copy b { color: #e7d8bf; }
.gate-form { text-align: left; }
.gate-form :deep(.ant-form-item-label > label) {
  color: #b9aa92;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.form-alert { margin-bottom: 16px; }
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 22px;
  color: #a9987d;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
}
.back-link:hover { color: var(--nocco-primary); }
.gate-actions { display: flex; justify-content: center; gap: 10px; }

/* ---------- admin header ---------- */
.admin-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 32px;
  padding-bottom: 26px;
  border-bottom: 1px solid rgba(214, 163, 75, 0.16);
}
.admin-head h1 {
  margin: 0;
  color: #f4ecdd;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: clamp(38px, 5vw, 66px);
  font-weight: 400;
  line-height: 0.96;
  letter-spacing: -0.035em;
}
.admin-head h1 em { color: var(--nocco-primary); font-style: italic; }
.admin-lede {
  max-width: 620px;
  margin: 20px 0 0;
  color: #ad9f8a;
  font-size: 14px;
  line-height: 1.7;
}
.admin-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  padding: 10px 12px;
  border: 1px solid rgba(214, 163, 75, 0.2);
  background: rgba(214, 163, 75, 0.04);
}
.admin-identity .pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nocco-success);
  box-shadow: 0 0 14px rgba(141, 202, 146, 0.55);
}
.admin-identity small {
  display: block;
  color: #7f7566;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.15em;
}
.admin-identity b { color: #e7d8bf; font-size: 12px; font-weight: 500; }

.admin-stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin: 24px 0 30px;
  border: 1px solid rgba(214, 163, 75, 0.14);
  background: rgba(18, 15, 10, 0.38);
}
.admin-stats > div {
  padding: 15px 20px;
  border-right: 1px solid rgba(214, 163, 75, 0.12);
}
.admin-stats > div:last-child { border-right: none; }
.admin-stats b {
  display: block;
  color: var(--nocco-primary);
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 27px;
  font-weight: 400;
  line-height: 1;
}
.admin-stats span {
  display: block;
  margin-top: 5px;
  color: #8d8170;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
.load-alert { margin-bottom: 20px; }

.admin-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr);
  gap: 20px;
}

.gate-panel,
.rules-panel,
.class-panel,
.deed-panel,
.leaflet-panel {
  border: 1px solid rgba(214, 163, 75, 0.18);
  background: rgba(18, 15, 10, 0.55);
}
.gate-panel { padding: 24px; }
.rules-panel { padding: 24px; }
.panel-kicker {
  margin: 0 0 6px;
  color: #8d8170;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.16em;
}
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}
.panel-head h2,
.rules-panel h2,
.leaflet-head h2 {
  margin: 0;
  color: #f0e4d1;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 27px;
  font-weight: 400;
}
.gate-state {
  display: flex;
  gap: 14px;
  margin-top: 22px;
  padding: 16px;
  border-left: 2px solid var(--nocco-success);
  background: rgba(141, 202, 146, 0.06);
}
.gate-state.off {
  border-left-color: var(--nocco-warning);
  background: rgba(224, 171, 81, 0.07);
}
.gate-state :deep(svg) {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--nocco-success);
  font-size: 19px;
}
.gate-state.off :deep(svg) { color: var(--nocco-warning); }
.gate-state b { color: #e9dbc5; font-size: 13px; }
.gate-state p {
  margin: 5px 0 0;
  color: #a99b86;
  font-size: 12px;
  line-height: 1.65;
}
.gate-note {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 16px;
  color: #8f826e;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.gate-note span { display: inline-flex; align-items: center; gap: 6px; }
.gate-note :deep(svg) { color: var(--nocco-primary); }

.rules-panel ol {
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
  counter-reset: rule;
}
.rules-panel li {
  position: relative;
  padding: 10px 0 10px 30px;
  border-top: 1px solid rgba(214, 163, 75, 0.09);
  color: #a99b86;
  font-size: 12px;
  line-height: 1.55;
  counter-increment: rule;
}
.rules-panel li::before {
  content: counter(rule, decimal-leading-zero);
  position: absolute;
  left: 0;
  top: 11px;
  color: var(--nocco-primary);
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
}
.rules-panel li b { color: #dfd0b8; font-weight: 500; }

/* ---------- classes ---------- */
.class-panel { margin-top: 20px; }
.class-intro {
  margin: 0;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(214, 163, 75, 0.12);
  color: #a99b86;
  font-size: 12px;
  line-height: 1.65;
}
.class-admin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  padding: 18px;
}
.class-admin-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(214, 163, 75, 0.16);
  border-top: 2px solid var(--class-color, var(--nocco-primary));
  background: rgba(14, 12, 9, 0.55);
  transition: opacity 160ms ease, border-color 160ms ease;
}
.class-admin-card.inactive { opacity: 0.52; }
.class-admin-card header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.class-admin-name { display: flex; align-items: center; gap: 10px; min-width: 0; }
.class-glyph {
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border: 1px solid color-mix(in srgb, var(--class-color) 55%, transparent);
  border-radius: 50%;
  color: var(--class-color);
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.08em;
}
.class-admin-name b { display: block; color: #eadcc6; font-size: 13px; font-weight: 500; }
.class-admin-name small {
  display: block;
  margin-top: 2px;
  color: #8e816e;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.class-skill-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 118px;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: thin;
  scrollbar-color: rgba(214, 163, 75, 0.35) transparent;
}
.class-skill-chips::-webkit-scrollbar { width: 4px; }
.class-skill-chips::-webkit-scrollbar-track { background: transparent; }
.class-skill-chips::-webkit-scrollbar-thumb {
  border-radius: 4px;
  background: rgba(214, 163, 75, 0.35);
}
.class-skill-chips span {
  padding: 3px 6px;
  border: 1px solid rgba(214, 163, 75, 0.14);
  background: rgba(214, 163, 75, 0.035);
  color: #b7a78f;
  font-size: 9px;
  line-height: 1.35;
}
.class-admin-card footer {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 2px;
}

.pool-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 14px;
  color: #9f917b;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.pool-toolbar > div { display: flex; gap: 6px; }

/* ---------- achievements ---------- */
.deed-panel { margin-top: 20px; }
.deed-summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
  color: #b7a78f;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.deed-summary :deep(svg) { color: var(--nocco-primary); }
.deed-intro {
  margin: 0;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(214, 163, 75, 0.12);
  color: #a99b86;
  font-size: 12px;
  line-height: 1.65;
}
.deed-intro b { color: #dfd0b8; font-weight: 500; }
.deed-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 14px 24px;
  border-bottom: 1px solid rgba(214, 163, 75, 0.1);
}
.deed-filter {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 9px;
  border: 1px solid rgba(214, 163, 75, 0.16);
  background: rgba(14, 12, 9, 0.55);
  color: #9f917b;
  font: inherit;
  font-size: 9px;
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease, background 150ms ease;
}
.deed-filter:hover { border-color: rgba(214, 163, 75, 0.38); color: #e7d8bf; }
.deed-filter.active {
  border-color: color-mix(in srgb, var(--class-color, var(--nocco-primary)) 62%, transparent);
  background: color-mix(in srgb, var(--class-color, var(--nocco-primary)) 9%, transparent);
  color: #f1e6d4;
}
.deed-filter small {
  color: #786f60;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
}
.deed-filter.active small { color: #c8b99f; }
.deed-alert { margin: 16px 24px; }
.deed-admin-groups {
  display: grid;
  gap: 12px;
  padding: 16px;
}
.deed-admin-group {
  border: 1px solid rgba(214, 163, 75, 0.14);
  background: rgba(13, 11, 8, 0.46);
}
.deed-admin-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 15px;
  border-bottom: 1px solid rgba(214, 163, 75, 0.11);
  border-left: 2px solid var(--class-color, var(--nocco-primary));
}
.deed-admin-meter {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 160px;
}
.deed-admin-meter > span {
  color: #c9b99e;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
}
.meter-track {
  flex: 1;
  height: 3px;
  background: rgba(214, 163, 75, 0.13);
  overflow: hidden;
}
.meter-track i {
  display: block;
  height: 100%;
  background: var(--class-color, var(--nocco-primary));
  transition: width 350ms ease;
}
.deed-admin-row {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 62px 78px 36px 72px;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  border-top: 1px solid rgba(214, 163, 75, 0.075);
  transition: background 150ms ease, opacity 150ms ease;
}
.deed-admin-row:first-child { border-top: none; }
.deed-admin-row:hover { background: rgba(214, 163, 75, 0.03); }
.deed-admin-row.inactive { opacity: 0.45; }
.deed-admin-sigil {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid rgba(214, 163, 75, 0.2);
  border-radius: 50%;
  color: #c9b686;
  font-size: 11px;
}
.deed-admin-copy { display: grid; min-width: 0; gap: 2px; }
.deed-admin-copy b {
  overflow: hidden;
  color: #e9dcc7;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.deed-admin-copy span {
  overflow: hidden;
  color: #8f826f;
  font-size: 10px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.deed-admin-copy small {
  color: #6f6556;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.deed-admin-tier {
  justify-self: start;
  padding: 2px 5px;
  border: 1px solid rgba(214, 163, 75, 0.22);
  color: #b9aa92;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 6px;
  letter-spacing: 0.1em;
}
.deed-admin-tier.bronze { color: #c08a5a; border-color: rgba(192, 138, 90, 0.34); }
.deed-admin-tier.silver { color: #b9c0c8; border-color: rgba(185, 192, 200, 0.3); }
.deed-admin-tier.gold { color: #d6a34b; border-color: rgba(214, 163, 75, 0.38); }
.deed-admin-tier.mythic { color: #c791b5; border-color: rgba(199, 145, 181, 0.38); }
.deed-admin-state {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  color: #6f6556;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 6px;
  letter-spacing: 0.08em;
}
.deed-admin-state.claimed { color: var(--nocco-success); }
.deed-admin-row > :deep(.ant-switch) { justify-self: center; }
.deed-admin-row > :deep(.ant-btn) { justify-self: end; }
.deed-state-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 2px 0 16px;
  padding: 10px 12px;
  border-left: 2px solid var(--nocco-warning);
  background: rgba(224, 171, 81, 0.06);
  color: #a99b86;
  font-size: 11px;
  line-height: 1.55;
}
.deed-state-line.claimed {
  border-left-color: var(--nocco-success);
  background: rgba(141, 202, 146, 0.06);
}
.deed-state-line :deep(svg) {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--nocco-warning);
}
.deed-state-line.claimed :deep(svg) { color: var(--nocco-success); }
.deed-state-line span { flex: 1; }
.deed-state-line small {
  color: #7f7566;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.08em;
}
.sigil-option { font-size: 15px; line-height: 1; }

.class-panel + .leaflet-panel { margin-top: 20px; }
.leaflet-panel { margin-top: 20px; }
.leaflet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 24px;
  border-bottom: 1px solid rgba(214, 163, 75, 0.14);
}
.leaflet-actions { display: flex; flex-wrap: wrap; gap: 8px; }

.goal-table-head,
.goal-admin-row {
  display: grid;
  grid-template-columns: 42px minmax(180px, 1.5fr) 86px 64px 132px;
  gap: 14px;
  align-items: center;
}
.goal-table-head {
  padding: 10px 24px;
  border-bottom: 1px solid rgba(214, 163, 75, 0.12);
  color: #786f60;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.14em;
}
.goal-admin-row {
  padding: 15px 24px;
  border-bottom: 1px solid rgba(214, 163, 75, 0.09);
  transition: background 150ms ease;
}
.goal-admin-row:hover { background: rgba(214, 163, 75, 0.035); }
.goal-admin-row.inactive { opacity: 0.5; }
.goal-order {
  color: #756a59;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 10px;
}
.goal-identity b { display: block; color: #e9dcc7; font-size: 13px; font-weight: 500; }
.goal-id {
  display: inline-block;
  margin-top: 2px;
  color: #9f907a;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
}
.goal-identity p {
  margin: 5px 0 0;
  color: #807463;
  font-size: 11px;
  line-height: 1.4;
}
.category-tag {
  justify-self: start;
  padding: 3px 6px;
  border: 1px solid rgba(214, 163, 75, 0.24);
  color: #c9b99e;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.1em;
}
.category-tag.eldritch { border-color: rgba(181, 109, 158, 0.35); color: #c791b5; }
.row-actions { display: flex; justify-content: flex-end; gap: 6px; }

.leaflet-loading { padding: 24px; display: grid; gap: 8px; }
.leaflet-loading span {
  height: 42px;
  background: linear-gradient(90deg, rgba(214, 163, 75, 0.04), rgba(214, 163, 75, 0.09), rgba(214, 163, 75, 0.04));
  animation: keeperShimmer 1.4s ease-in-out infinite;
}
@keyframes keeperShimmer {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}
.leaflet-empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 46px 20px;
  color: #8d8170;
  font-size: 12px;
}
.leaflet-empty span { color: var(--nocco-primary); font-size: 20px; }

.admin-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px 20px;
  margin: 22px 0 0;
  color: #786f60;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.admin-foot a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #c4b193;
  text-decoration: none;
}
.admin-foot a:hover { color: var(--nocco-primary); }

/* ---------- modal ---------- */
.goal-form :deep(.ant-form-item-label > label) {
  color: #b9aa92;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field-hint {
  margin-top: 6px;
  color: #8d8170;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.05em;
}
.id-preview {
  margin: 2px 0 16px;
  color: #9e8f78;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  line-height: 1.6;
}
.id-preview code { color: #d8b97d; }
.id-preview span { display: block; color: #6f6556; }
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

@media (max-width: 900px) {
  .admin-head { flex-direction: column; align-items: flex-start; }
  .admin-grid { grid-template-columns: 1fr; }
  .goal-table-head { display: none; }
  .goal-admin-row {
    grid-template-columns: 34px minmax(0, 1fr) auto;
    gap: 10px;
    padding: 16px 18px;
  }
  .goal-table-head + .goal-admin-row { border-top: none; }
  .goal-order { grid-row: 1 / 3; }
  .goal-identity { grid-column: 2; }
  .category-tag { grid-column: 2; grid-row: 2; }
  .goal-admin-row > :deep(.ant-switch) { grid-column: 3; grid-row: 2; }
  .row-actions { grid-column: 3; grid-row: 1; }
  .leaflet-head { flex-direction: column; align-items: flex-start; }
  .class-admin-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  .deed-admin-row {
    grid-template-columns: 26px minmax(0, 1fr) auto auto;
    row-gap: 6px;
  }
  .deed-admin-sigil,
  .deed-admin-copy { grid-row: 1 / 3; }
  .deed-admin-tier { display: none; }
  .deed-admin-state { grid-column: 3; grid-row: 2; justify-self: end; }
  .deed-admin-row > :deep(.ant-switch) { grid-column: 3; grid-row: 1; }
  .deed-admin-row > :deep(.ant-btn) { grid-column: 4; grid-row: 1 / 3; }
}
@media (max-width: 640px) {
  .admin-page { padding-top: 34px; }
  .keeper-gate { padding: 28px 22px; margin-top: 0; }
  .admin-stats { grid-template-columns: 1fr 1fr; }
  .admin-stats > div { border-bottom: 1px solid rgba(214, 163, 75, 0.12); }
  .admin-stats > div:nth-child(2n) { border-right: none; }
  .admin-stats > div:nth-child(5) { border-bottom: none; }
  .goal-admin-row { grid-template-columns: 30px minmax(0, 1fr); }
  .goal-admin-row > :deep(.ant-switch),
  .row-actions { grid-column: 2; justify-self: start; }
  .goal-admin-row > :deep(.ant-switch) { grid-row: 3; }
  .row-actions { grid-row: 1; justify-self: end; }
  .class-admin-grid { grid-template-columns: 1fr; padding: 14px; }
  .form-grid { grid-template-columns: 1fr; }
  .deed-filters { padding: 12px 14px; }
  .deed-admin-groups { padding: 10px; }
  .deed-admin-row {
    grid-template-columns: 24px minmax(0, 1fr) auto;
    padding: 10px 12px;
  }
  .deed-admin-sigil { grid-row: 1; }
  .deed-admin-copy { grid-row: 1; }
  .deed-admin-state { grid-column: 2; grid-row: 2; justify-self: start; }
  .deed-admin-row > :deep(.ant-switch) { grid-column: 3; grid-row: 1; }
  .deed-admin-row > :deep(.ant-btn) { grid-column: 3; grid-row: 2; }
  .deed-admin-meter { flex-basis: 110px; }
  .deed-admin-group-head { align-items: flex-start; flex-direction: column; gap: 8px; }
  .deed-admin-meter { width: 100%; }
}
</style>
