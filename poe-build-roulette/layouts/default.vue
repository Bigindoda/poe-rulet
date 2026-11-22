<script setup lang="ts">
const year = 2026;
</script>

<template>
  <div class="site-shell">
    <div class="ambient ambient-a" />
    <div class="ambient ambient-b" />
    <div class="grain" />

    <header class="site-head">
      <NuxtLink to="/" class="brand" aria-label="PoE Build Roulette home">
        <span class="brand-sigil" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none">
            <path d="M24 2.8 43.5 14v20L24 45.2 4.5 34V14L24 2.8Z" stroke="currentColor" stroke-width="1.2" />
            <path d="M24 9.5 37.6 17.4v13.2L24 38.5 10.4 30.6V17.4L24 9.5Z" stroke="currentColor" stroke-width=".7" opacity=".55" />
            <path d="M24 15.2 29.8 24 24 32.8 18.2 24 24 15.2Z" fill="currentColor" opacity=".9" />
            <circle cx="24" cy="24" r="2" fill="#0b0a08" />
          </svg>
        </span>
        <span class="brand-text">
          <b>BUILD ROULETTE</b>
          <small>PATH OF EXILE I</small>
        </span>
      </NuxtLink>

      <nav class="site-nav" aria-label="Sections">
        <NuxtLink to="/#roulette">Roulette</NuxtLink>
        <NuxtLink to="/#gate">The gate</NuxtLink>
        <NuxtLink to="/#ledger">Ledger</NuxtLink>
        <NuxtLink to="/achievements" class="nav-achievements">Achievements</NuxtLink>
        <NuxtLink to="/admin" class="nav-admin">Keeper's table</NuxtLink>
      </nav>

      <NuxtLink to="/achievements" class="head-deeds">DEEDS</NuxtLink>

      <div class="head-state">
        <span class="pulse-dot" />
        <span class="league-chip">COVENS <i>·</i> 3.30</span>
      </div>
    </header>

    <main class="site-main">
      <slot />
    </main>

    <footer class="site-foot">
      <div class="foot-mark">
        <span class="mini-sigil">✦</span>
        <span>FATE IS A FILTER</span>
      </div>
      <p>
        A fan-made toy for Path of Exile 1. Not affiliated with or endorsed by Grinding Gear Games
        or poe.ninja. Ladder data is a fixed snapshot; live builds move.
      </p>
      <NuxtLink to="/achievements" class="foot-admin">ACHIEVEMENTS</NuxtLink>
      <NuxtLink to="/admin" class="foot-admin">KEEPER'S TABLE</NuxtLink>
      <span class="foot-year">MMXXVI · {{ year }}</span>
    </footer>
  </div>
</template>

<style scoped>
.site-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: clip;
  background:
    radial-gradient(ellipse 72% 46% at 78% -8%, rgba(122, 84, 25, 0.2), transparent 70%),
    radial-gradient(ellipse 60% 42% at 4% 44%, rgba(88, 59, 22, 0.14), transparent 72%),
    linear-gradient(180deg, #0c0b09 0%, #0a0907 48%, #080706 100%);
}

.ambient {
  position: absolute;
  border-radius: 999px;
  filter: blur(1px);
  pointer-events: none;
  opacity: 0.5;
}
.ambient-a {
  width: 560px;
  height: 560px;
  right: -220px;
  top: 120px;
  background: radial-gradient(circle, rgba(194, 140, 55, 0.13), transparent 66%);
}
.ambient-b {
  width: 680px;
  height: 680px;
  left: -340px;
  top: 720px;
  background: radial-gradient(circle, rgba(137, 95, 34, 0.1), transparent 68%);
}
.grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.17;
  background-image:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 3px),
    radial-gradient(rgba(255, 255, 255, 0.08) 0.5px, transparent 0.6px);
  background-size: auto, 4px 4px;
  mix-blend-mode: soft-light;
}

.site-head {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 36px;
  padding: 18px clamp(20px, 4vw, 64px);
  border-bottom: 1px solid rgba(214, 163, 75, 0.14);
  background: rgba(9, 8, 6, 0.82);
  backdrop-filter: blur(18px) saturate(1.1);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  color: var(--nocco-text);
  text-decoration: none;
  flex-shrink: 0;
}
.brand-sigil {
  width: 38px;
  height: 38px;
  color: var(--nocco-primary);
  filter: drop-shadow(0 0 14px rgba(214, 163, 75, 0.24));
}
.brand-sigil svg { display: block; width: 100%; height: 100%; }
.brand-text { display: grid; gap: 1px; }
.brand-text b {
  font-family: 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.16em;
}
.brand-text small {
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.28em;
  color: var(--nocco-text-secondary);
}

.site-nav {
  display: flex;
  gap: 28px;
  margin-left: 12px;
}
.site-nav a {
  position: relative;
  color: #b9ad99;
  text-decoration: none;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 8px 0;
  transition: color 160ms ease;
}
.site-nav a:hover { color: #f1e8d8; }
.site-nav a::after {
  content: '';
  position: absolute;
  left: 0;
  right: 100%;
  bottom: 2px;
  height: 1px;
  background: var(--nocco-primary);
  transition: right 180ms ease;
}
.site-nav a:hover::after { right: 0; }
.site-nav .nav-admin {
  padding-left: 16px;
  border-left: 1px solid rgba(214, 163, 75, 0.22);
  color: #d2b781;
}
.site-nav .nav-achievements { color: #d2b781; }
.site-nav a.router-link-active { color: #f1e8d8; }
.site-nav a.router-link-active::after { right: 0; }

.head-deeds {
  display: none;
  align-items: center;
  padding: 6px 9px;
  border: 1px solid rgba(214, 163, 75, 0.24);
  color: #d2b781;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 8px;
  letter-spacing: 0.14em;
  text-decoration: none;
}
.head-deeds:hover { color: var(--nocco-primary); border-color: rgba(214, 163, 75, 0.45); }

.head-state {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d6a34b;
  box-shadow: 0 0 0 4px rgba(214, 163, 75, 0.09), 0 0 16px rgba(214, 163, 75, 0.55);
  animation: headPulse 2.8s ease-in-out infinite;
}
@keyframes headPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.82); }
}
.league-chip {
  padding: 6px 10px;
  border: 1px solid rgba(214, 163, 75, 0.26);
  background: rgba(214, 163, 75, 0.05);
  color: #d9c8a9;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.16em;
}
.league-chip i { color: var(--nocco-primary); font-style: normal; }

.site-main {
  flex: 1;
  position: relative;
  z-index: 1;
  width: min(1240px, 100%);
  margin: 0 auto;
  padding: 0 clamp(20px, 4vw, 56px) 90px;
}

.site-foot {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 28px;
  padding: 26px clamp(20px, 4vw, 64px);
  border-top: 1px solid rgba(214, 163, 75, 0.13);
  background: rgba(7, 6, 5, 0.72);
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 9px;
  letter-spacing: 0.06em;
  color: #786f60;
}
.site-foot p { margin: 0; flex: 1; min-width: 240px; line-height: 1.7; }
.foot-mark {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #b8aa92;
  letter-spacing: 0.18em;
}
.mini-sigil { color: var(--nocco-primary); font-size: 12px; }
.foot-admin {
  color: #a8977d;
  text-decoration: none;
  letter-spacing: 0.14em;
  border-bottom: 1px solid rgba(214, 163, 75, 0.22);
  padding-bottom: 2px;
}
.foot-admin:hover { color: var(--nocco-primary); }
.foot-year { margin-left: auto; color: #5f574b; letter-spacing: 0.16em; }

@media (max-width: 820px) {
  .site-head { gap: 16px; padding: 14px 18px; }
  .site-nav { display: none; }
  .head-deeds { display: inline-flex; margin-left: auto; }
  .head-state { margin-left: 0; }
  .brand-text b { font-size: 13px; }
  .league-chip { font-size: 8px; padding: 5px 7px; }
  .site-main { padding: 0 16px 64px; }
  .site-foot { padding: 22px 18px; }
  .foot-year { margin-left: 0; }
}
@media (max-width: 600px) {
  .head-state { display: none; }
  .head-deeds { margin-left: auto; }
}
</style>
