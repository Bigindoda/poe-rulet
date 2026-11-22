<script setup lang="ts">
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ThunderboltFilled,
  TrophyOutlined,
} from '@ant-design/icons-vue';
import { computed, onMounted, ref } from 'vue';

useHead({ title: 'Achievements — PoE Build Roulette' });

type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'MYTHIC';

type Achievement = {
  className: string;
  goalId: string;
  title: string;
  description: string;
  tier: Tier;
  sigil: string;
  active: boolean;
  updatedAt: string | null;
  unlocked: boolean;
  completedAt: string | null;
};

type BoardClass = { name: string; active: boolean; sortOrder: number };
type BoardGoal = {
  id: string;
  name: string;
  category: 'ELDRITCH' | 'ATLAS';
  tagline: string;
  tip: string;
  active: boolean;
  sortOrder: number;
};

type Board = {
  classes: BoardClass[];
  goals: BoardGoal[];
  achievements: Achievement[];
  stats: { total: number; claimed: number; classes: number; goals: number };
};

const board = ref<Board | null>(null);
const loading = ref(true);
const error = ref('');
const activeClass = ref('all');

const CLASS_COLORS: Record<string, string> = {
  Duelist: '#c76b4a',
  Marauder: '#c58a48',
  Ranger: '#7fa46b',
  Shadow: '#8e76b2',
  Templar: '#7fa1c2',
  Witch: '#b56d9e',
  Scion: '#c9b686',
};

const TIER_ORDER: Tier[] = ['BRONZE', 'SILVER', 'GOLD', 'MYTHIC'];

const TIER_COLORS: Record<Tier, string> = {
  BRONZE: '#c08a5a',
  SILVER: '#b9c0c8',
  GOLD: '#d6a34b',
  MYTHIC: '#c791b5',
};

function classColor(name: string): string {
  return CLASS_COLORS[name] ?? '#d6a34b';
}

function tierColor(tier: Tier): string {
  return TIER_COLORS[tier] ?? '#c08a5a';
}

function classGlyph(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const goalById = computed(() => {
  const map = new Map<string, BoardGoal>();
  for (const goal of board.value?.goals ?? []) map.set(goal.id, goal);
  return map;
});

const goalOrder = computed(() => {
  const map = new Map<string, number>();
  (board.value?.goals ?? []).forEach((goal, index) => map.set(goal.id, index));
  return map;
});

const groups = computed(() => {
  if (!board.value) return [];
  const visibleClasses =
    activeClass.value === 'all'
      ? board.value.classes
      : board.value.classes.filter((entry) => entry.name === activeClass.value);

  return visibleClasses.map((entry) => {
    const deeds = board.value!.achievements
      .filter((deed) => deed.className === entry.name)
      .sort(
        (a, b) =>
          (goalOrder.value.get(a.goalId) ?? 99) - (goalOrder.value.get(b.goalId) ?? 99),
      );
    return {
      ...entry,
      deeds,
      claimed: deeds.filter((deed) => deed.unlocked).length,
      total: deeds.length,
      percent: deeds.length ? Math.round((deeds.filter((deed) => deed.unlocked).length / deeds.length) * 100) : 0,
    };
  });
});

const totalDeeds = computed(() => board.value?.stats.total ?? 0);
const claimedDeeds = computed(() => board.value?.stats.claimed ?? 0);
const overallPercent = computed(() =>
  totalDeeds.value ? Math.round((claimedDeeds.value / totalDeeds.value) * 100) : 0,
);
const remainingDeeds = computed(() => Math.max(0, totalDeeds.value - claimedDeeds.value));

const classFilters = computed(() => {
  if (!board.value) return [];
  return board.value.classes.map((entry) => {
    const deeds = board.value!.achievements.filter((deed) => deed.className === entry.name);
    return {
      ...entry,
      claimed: deeds.filter((deed) => deed.unlocked).length,
      total: deeds.length,
    };
  });
});

function goalName(goalId: string): string {
  return goalById.value.get(goalId)?.name ?? goalId;
}

function goalCategory(goalId: string): string {
  return goalById.value.get(goalId)?.category ?? 'ATLAS';
}

function tierIndex(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

async function loadBoard() {
  loading.value = true;
  error.value = '';
  try {
    board.value = await $fetch<Board>('/api/achievements');
    if (
      activeClass.value !== 'all' &&
      !board.value.classes.some((entry) => entry.name === activeClass.value)
    ) {
      activeClass.value = 'all';
    }
  } catch (fetchError) {
    error.value = 'The hall of deeds could not be opened. Try again.';
    console.warn(fetchError);
  } finally {
    loading.value = false;
  }
}

onMounted(loadBoard);
</script>

<template>
  <div class="achievements-page">
    <section class="ach-hero">
      <div class="ach-hero-copy">
        <p class="eyebrow"><span class="eyebrow-rule" /> HALL OF DEEDS <i>·</i> ACHIEVEMENTS</p>
        <h1>
          Every exile.
          <em>Every pinnacle.</em>
        </h1>
        <p class="ach-lede">
          Seven classes. {{ board?.stats.goals ?? 0 }} pinnacle targets. Each pairing keeps its
          own deed, and the deed is claimed when that target is marked complete on the class
          hit list. No shared credit, no borrowed glory.
        </p>
        <div class="ach-actions">
          <NuxtLink to="/#start">
            <a-button type="primary" size="large">
              <ThunderboltFilled /> Open the roulette
            </a-button>
          </NuxtLink>
          <a href="#deeds" class="ach-link">Browse the deeds <ArrowRightOutlined /></a>
        </div>
        <div class="ach-chips">
          <span><TrophyOutlined /> {{ totalDeeds }} deeds</span>
          <span><SafetyCertificateOutlined /> {{ board?.stats.classes ?? 0 }} classes</span>
          <span><CheckOutlined /> {{ claimedDeeds }} claimed</span>
        </div>
      </div>

      <aside class="ach-progress">
        <div class="progress-seal" :style="{ '--progress': `${overallPercent}%` }">
          <div class="progress-seal-inner">
            <span class="progress-sigil">✦</span>
            <b>{{ claimedDeeds }}</b>
            <small>of {{ totalDeeds }}</small>
          </div>
        </div>
        <div class="progress-copy">
          <span class="progress-kicker">THE KEEPER'S COUNT</span>
          <b>{{ overallPercent }}% of the hall claimed</b>
          <p v-if="remainingDeeds">
            {{ remainingDeeds }} deed{{ remainingDeeds === 1 ? '' : 's' }} still sealed. Pick a
            class, name a target, and finish the hunt.
          </p>
          <p v-else>The hall is complete. Every class has answered every target.</p>
        </div>
      </aside>
    </section>

    <div class="ach-stats">
      <div>
        <b>{{ board?.stats.classes ?? '—' }}</b>
        <span>base classes</span>
      </div>
      <div>
        <b>{{ board?.stats.goals ?? '—' }}</b>
        <span>pinnacle targets</span>
      </div>
      <div>
        <b>{{ totalDeeds }}</b>
        <span>deeds on the board</span>
      </div>
      <div>
        <b>{{ claimedDeeds }}</b>
        <span>deeds claimed</span>
      </div>
    </div>

    <section id="deeds" class="deeds-section">
      <div class="deeds-heading">
        <div>
          <p class="eyebrow"><span class="eyebrow-rule" /> THE MATRIX</p>
          <h2>One deed for every hunt.</h2>
        </div>
        <a-button size="small" :loading="loading" @click="loadBoard">
          <ReloadOutlined /> Refresh
        </a-button>
      </div>

      <div class="class-filter" role="tablist" aria-label="Filter achievements by class">
        <button
          type="button"
          class="filter-chip"
          :class="{ active: activeClass === 'all' }"
          role="tab"
          :aria-selected="activeClass === 'all'"
          @click="activeClass = 'all'"
        >
          <span class="filter-glyph">✦</span>
          <span>All classes</span>
          <small>{{ claimedDeeds }}/{{ totalDeeds }}</small>
        </button>
        <button
          v-for="entry in classFilters"
          :key="entry.name"
          type="button"
          class="filter-chip"
          :class="{ active: activeClass === entry.name }"
          :style="{ '--class-color': classColor(entry.name) }"
          role="tab"
          :aria-selected="activeClass === entry.name"
          @click="activeClass = entry.name"
        >
          <span class="filter-glyph">{{ classGlyph(entry.name) }}</span>
          <span>{{ entry.name }}</span>
          <small>{{ entry.claimed }}/{{ entry.total }}</small>
        </button>
      </div>

      <div v-if="error" class="ach-error">
        <p>{{ error }}</p>
        <a-button type="primary" @click="loadBoard">Try again</a-button>
      </div>

      <div v-else-if="loading && !board" class="ach-loading">
        <div v-for="n in 3" :key="n" class="ach-skeleton">
          <span />
          <div>
            <i v-for="m in 3" :key="m" />
          </div>
        </div>
      </div>

      <div v-else-if="groups.length" class="class-groups">
        <article
          v-for="group in groups"
          :key="group.name"
          class="ach-class"
          :style="{ '--class-color': classColor(group.name) }"
        >
          <header class="ach-class-head">
            <div class="ach-class-identity">
              <span class="ach-class-glyph">{{ classGlyph(group.name) }}</span>
              <div>
                <b>{{ group.name }}</b>
                <small>{{ group.claimed }} of {{ group.total }} deeds claimed</small>
              </div>
            </div>
            <div class="ach-class-meter">
              <span>{{ group.percent }}%</span>
              <div class="meter-track"><i :style="{ width: `${group.percent}%` }" /></div>
            </div>
          </header>

          <div class="deed-grid">
            <article
              v-for="deed in group.deeds"
              :key="`${deed.className}:${deed.goalId}`"
              class="deed-card"
              :class="{ claimed: deed.unlocked, inactive: !deed.active }"
              :style="{ '--tier-color': tierColor(deed.tier) }"
            >
              <div class="deed-top">
                <span class="deed-sigil">{{ deed.sigil }}</span>
                <span class="deed-tier" :class="deed.tier.toLowerCase()">{{ deed.tier }}</span>
                <span class="deed-state" :class="{ claimed: deed.unlocked }">
                  <CheckOutlined v-if="deed.unlocked" />
                  <LockOutlined v-else />
                  {{ deed.unlocked ? 'CLAIMED' : 'SEALED' }}
                </span>
              </div>

              <span class="deed-target">{{ goalName(deed.goalId) }}</span>
              <h3>{{ deed.title }}</h3>
              <p>{{ deed.description || 'A deed without words. The kill is the statement.' }}</p>

              <footer>
                <template v-if="deed.unlocked">
                  <span class="deed-date"><CheckOutlined /> {{ formatDate(deed.completedAt) }}</span>
                  <span class="deed-category">{{ goalCategory(deed.goalId) }}</span>
                </template>
                <template v-else>
                  <span class="deed-locked"><LockOutlined /> Mark the target complete</span>
                  <span class="deed-category">{{ goalCategory(deed.goalId) }}</span>
                </template>
              </footer>
              <span class="deed-rank" :style="{ opacity: 0.1 + tierIndex(deed.tier) * 0.16 }">
                {{ tierIndex(deed.tier) + 1 }}
              </span>
            </article>
          </div>
        </article>
      </div>

      <div v-else-if="!loading" class="ach-empty">
        <span>✦</span>
        <p>No deeds on the board yet. Add targets in the keeper's table.</p>
        <NuxtLink to="/admin"><a-button>Open the keeper's table</a-button></NuxtLink>
      </div>
    </section>

    <section class="ach-how">
      <div class="how-sigil"><TrophyOutlined /></div>
      <div>
        <p class="eyebrow"><span class="eyebrow-rule" /> HOW A DEED IS CLAIMED</p>
        <h2>The hit list is the key.</h2>
        <p>
          Finish a target on a class, then mark it complete in that class's hit list. The
          corresponding deed is claimed automatically. Unmarking the target returns the deed to
          the sealed row; achievements are a mirror of the hit list, not a separate save.
        </p>
      </div>
      <NuxtLink to="/#start" class="how-link">
        Start a hunt <ArrowRightOutlined />
      </NuxtLink>
    </section>

    <p class="ach-foot">
      <NuxtLink to="/"><ArrowLeftOutlined /> Back to the roulette</NuxtLink>
      <span>Seven exiles · one hall · no shared credit</span>
    </p>
  </div>
</template>

<style scoped>
.achievements-page {
  padding-top: 1px;
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

/* ---------- hero ---------- */
.ach-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 350px;
  gap: 54px;
  align-items: end;
  padding: 70px 0 38px;
}
.ach-hero h1 {
  margin: 0;
  color: #f4ecdd;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: clamp(46px, 6vw, 82px);
  font-weight: 400;
  line-height: 0.96;
  letter-spacing: -0.035em;
}
.ach-hero h1 em {
  display: block;
  margin-top: 8px;
  color: var(--nocco-primary);
  font-style: italic;
}
.ach-lede {
  max-width: 640px;
  margin: 24px 0 0;
  color: #b6aa98;
  font-size: 15px;
  line-height: 1.75;
}
.ach-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  margin-top: 25px;
}
.ach-actions :deep(.ant-btn-lg) { min-width: 210px; height: 46px; }
.ach-link {
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
.ach-link:hover { color: #f0cd85; border-bottom-color: rgba(214, 163, 75, 0.6); }
.ach-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 22px;
}
.ach-chips span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #a99b84;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ach-chips :deep(svg) { color: var(--nocco-primary); }

.ach-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 24px;
  border: 1px solid rgba(214, 163, 75, 0.24);
  background:
    linear-gradient(155deg, rgba(214, 163, 75, 0.075), transparent 46%),
    rgba(18, 15, 10, 0.86);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.26);
  text-align: center;
}
.progress-seal {
  position: relative;
  display: grid;
  place-items: center;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  background: conic-gradient(
    var(--nocco-primary) 0 var(--progress),
    rgba(214, 163, 75, 0.12) var(--progress) 100%
  );
  box-shadow: 0 0 40px rgba(214, 163, 75, 0.08);
}
.progress-seal::before {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  background: #0d0b08;
}
.progress-seal-inner {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 1px;
}
.progress-sigil { color: var(--nocco-primary); font-size: 15px; }
.progress-seal-inner b {
  color: #f1e6d4;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 34px;
  font-weight: 400;
  line-height: 1;
}
.progress-seal-inner small {
  color: #817563;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.progress-copy { width: 100%; }
.progress-kicker {
  display: block;
  color: #8d8170;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.16em;
}
.progress-copy b {
  display: block;
  margin-top: 5px;
  color: #e7d8bf;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 21px;
  font-weight: 400;
  line-height: 1.2;
}
.progress-copy p {
  margin: 8px 0 0;
  color: #9a8c76;
  font-size: 11px;
  line-height: 1.6;
}

/* ---------- stats ---------- */
.ach-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid rgba(214, 163, 75, 0.16);
  border-bottom: 1px solid rgba(214, 163, 75, 0.16);
  background: rgba(18, 15, 10, 0.38);
}
.ach-stats > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 16px 22px;
  border-right: 1px solid rgba(214, 163, 75, 0.12);
}
.ach-stats > div:last-child { border-right: none; }
.ach-stats b {
  color: var(--nocco-primary);
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 25px;
  font-weight: 400;
}
.ach-stats span {
  color: #8d8170;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

/* ---------- deeds ---------- */
.deeds-section {
  margin-top: 64px;
  scroll-margin-top: 90px;
}
.deeds-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(214, 163, 75, 0.16);
}
.deeds-heading .eyebrow { margin-bottom: 10px; }
.deeds-heading h2 {
  margin: 0;
  color: #f1e6d4;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: clamp(30px, 3.6vw, 46px);
  font-weight: 400;
  line-height: 1;
  letter-spacing: -0.02em;
}
.class-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 18px 0 26px;
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid rgba(214, 163, 75, 0.16);
  background: rgba(14, 12, 9, 0.6);
  color: #a99b84;
  font: inherit;
  font-size: 10px;
  cursor: pointer;
  transition: border-color 150ms ease, color 150ms ease, background 150ms ease;
}
.filter-chip:hover { border-color: rgba(214, 163, 75, 0.38); color: #e7d8bf; }
.filter-chip.active {
  border-color: color-mix(in srgb, var(--class-color, var(--nocco-primary)) 60%, transparent);
  background: color-mix(in srgb, var(--class-color, var(--nocco-primary)) 9%, transparent);
  color: #f1e6d4;
}
.filter-glyph {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid color-mix(in srgb, var(--class-color, var(--nocco-primary)) 42%, transparent);
  border-radius: 50%;
  color: var(--class-color, var(--nocco-primary));
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.04em;
}
.filter-chip small {
  color: #7d7262;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.06em;
}
.filter-chip.active small { color: #c8b99f; }

.class-groups { display: grid; gap: 26px; }
.ach-class {
  border: 1px solid rgba(214, 163, 75, 0.16);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--class-color) 5%, transparent), transparent 180px),
    rgba(13, 11, 8, 0.5);
}
.ach-class-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 15px 18px;
  border-bottom: 1px solid rgba(214, 163, 75, 0.12);
  border-left: 2px solid var(--class-color);
}
.ach-class-identity { display: flex; align-items: center; gap: 11px; }
.ach-class-glyph {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid color-mix(in srgb, var(--class-color) 55%, transparent);
  border-radius: 50%;
  color: var(--class-color);
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.06em;
}
.ach-class-identity b {
  display: block;
  color: #ebdfcc;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 23px;
  font-weight: 400;
  line-height: 1;
}
.ach-class-identity small {
  display: block;
  margin-top: 3px;
  color: #837765;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.ach-class-meter {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 180px;
}
.ach-class-meter > span {
  color: #c9b99e;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
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
  background: var(--class-color);
  transition: width 400ms ease;
}

.deed-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: rgba(214, 163, 75, 0.1);
}
.deed-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 196px;
  padding: 14px 15px 12px;
  background: #0d0b08;
  overflow: hidden;
  transition: background 160ms ease;
}
.deed-card:hover { background: #12100b; }
.deed-card.inactive { opacity: 0.46; }
.deed-card.claimed {
  background:
    radial-gradient(ellipse at 100% 0%, color-mix(in srgb, var(--class-color) 10%, transparent), transparent 62%),
    #0e0c09;
}
.deed-card.claimed::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, var(--tier-color), transparent);
}
.deed-top {
  display: flex;
  align-items: center;
  gap: 7px;
}
.deed-sigil {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid color-mix(in srgb, var(--tier-color) 45%, transparent);
  border-radius: 50%;
  color: var(--tier-color);
  font-size: 12px;
}
.deed-card.claimed .deed-sigil {
  background: color-mix(in srgb, var(--tier-color) 12%, transparent);
  box-shadow: 0 0 18px color-mix(in srgb, var(--tier-color) 12%, transparent);
}
.deed-tier {
  padding: 2px 5px;
  border: 1px solid rgba(214, 163, 75, 0.16);
  color: #a99b84;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 6px;
  letter-spacing: 0.12em;
}
.deed-tier.bronze { color: #c08a5a; border-color: rgba(192, 138, 90, 0.32); }
.deed-tier.silver { color: #b9c0c8; border-color: rgba(185, 192, 200, 0.3); }
.deed-tier.gold { color: #d6a34b; border-color: rgba(214, 163, 75, 0.38); }
.deed-tier.mythic { color: #c791b5; border-color: rgba(199, 145, 181, 0.38); }
.deed-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  color: #6f6556;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 6px;
  letter-spacing: 0.12em;
}
.deed-state.claimed { color: var(--nocco-success); }
.deed-target {
  display: block;
  margin-top: 14px;
  color: #8b7e6b;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
.deed-card h3 {
  margin: 5px 0 0;
  color: #e9dcc7;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 19px;
  font-weight: 400;
  line-height: 1.14;
}
.deed-card:not(.claimed) h3 { color: #9d907c; }
.deed-card p {
  margin: 7px 0 0;
  color: #8f826f;
  font-size: 10px;
  line-height: 1.55;
}
.deed-card.claimed p { color: #a99b86; }
.deed-card footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(214, 163, 75, 0.08);
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 7px;
  letter-spacing: 0.05em;
}
.deed-date,
.deed-locked {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #7f7361;
}
.deed-date { color: #8dbb8f; }
.deed-locked :deep(svg) { color: #6f6556; }
.deed-category { color: #6f6556; letter-spacing: 0.1em; }
.deed-rank {
  position: absolute;
  right: 10px;
  bottom: -14px;
  color: var(--tier-color);
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 78px;
  line-height: 1;
  pointer-events: none;
}

/* ---------- loading / empty ---------- */
.ach-loading { display: grid; gap: 10px; }
.ach-skeleton {
  display: flex;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgba(214, 163, 75, 0.12);
  background: rgba(14, 12, 9, 0.5);
}
.ach-skeleton > span {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(214, 163, 75, 0.08);
}
.ach-skeleton > div { display: grid; flex: 1; gap: 8px; align-content: center; }
.ach-skeleton i {
  display: block;
  height: 8px;
  background: linear-gradient(90deg, rgba(214, 163, 75, 0.04), rgba(214, 163, 75, 0.09), rgba(214, 163, 75, 0.04));
  animation: shimmer 1.4s ease-in-out infinite;
}
.ach-skeleton i:nth-child(1) { width: 28%; }
.ach-skeleton i:nth-child(2) { width: 54%; }
.ach-skeleton i:nth-child(3) { width: 38%; }
@keyframes shimmer {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}
.ach-error,
.ach-empty {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 50px 20px;
  border: 1px solid rgba(214, 163, 75, 0.16);
  color: #9a8c76;
  text-align: center;
}
.ach-error p,
.ach-empty p { margin: 0; font-size: 12px; }
.ach-empty > span { color: var(--nocco-primary); font-size: 24px; }

/* ---------- how / foot ---------- */
.ach-how {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  align-items: center;
  gap: 22px;
  margin-top: 34px;
  padding: 22px 24px;
  border: 1px solid rgba(214, 163, 75, 0.18);
  background:
    linear-gradient(120deg, rgba(214, 163, 75, 0.06), transparent 58%),
    rgba(18, 15, 10, 0.55);
}
.how-sigil {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border: 1px solid rgba(214, 163, 75, 0.35);
  border-radius: 50%;
  color: var(--nocco-primary);
  font-size: 21px;
}
.ach-how .eyebrow { margin-bottom: 5px; }
.ach-how h2 {
  margin: 0;
  color: #f0e4d1;
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 27px;
  font-weight: 400;
}
.ach-how p:not(.eyebrow) {
  max-width: 720px;
  margin: 7px 0 0;
  color: #a99b86;
  font-size: 12px;
  line-height: 1.65;
}
.how-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #d6a34b;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
  white-space: nowrap;
}
.how-link:hover { color: #f0cd85; }

.ach-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px 20px;
  margin: 24px 0 0;
  color: #786f60;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.ach-foot a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #c4b193;
  text-decoration: none;
}
.ach-foot a:hover { color: var(--nocco-primary); }

@media (max-width: 1050px) {
  .ach-hero { grid-template-columns: minmax(0, 1fr) 320px; gap: 32px; }
  .deed-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 820px) {
  .ach-hero { grid-template-columns: 1fr; align-items: start; padding-top: 46px; }
  .ach-progress { flex-direction: row; text-align: left; align-items: center; }
  .progress-seal { flex: 0 0 108px; width: 108px; height: 108px; }
  .ach-stats { grid-template-columns: 1fr 1fr; }
  .ach-stats > div:nth-child(2n) { border-right: none; }
  .ach-stats > div:nth-child(-n + 2) { border-bottom: 1px solid rgba(214, 163, 75, 0.12); }
  .ach-class-head { align-items: flex-start; flex-direction: column; gap: 10px; }
  .ach-class-meter { flex-basis: auto; width: 100%; }
  .ach-how { grid-template-columns: 46px minmax(0, 1fr); }
  .how-link { grid-column: 2; }
}
@media (max-width: 600px) {
  .deed-grid { grid-template-columns: 1fr; }
  .ach-progress { flex-direction: column; text-align: center; }
  .progress-seal { width: 120px; height: 120px; }
  .ach-actions { align-items: flex-start; flex-direction: column; }
  .ach-actions :deep(.ant-btn-lg) { width: 100%; }
  .deeds-heading { align-items: flex-start; flex-direction: column; }
  .ach-class { border-left: none; }
  .deed-card { min-height: 176px; }
  .ach-how { grid-template-columns: 1fr; text-align: left; padding: 18px; }
  .how-sigil { width: 42px; height: 42px; font-size: 17px; }
  .how-link { grid-column: 1; }
}
</style>
