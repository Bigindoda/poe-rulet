# PoE Build Roulette

A fan-made build roulette for **Path of Exile 1**, built around the **Covens of Umbra** ladder snapshot. Choose a class and a pinnacle target, then let the wheel pick the main skill and ascendancy. Every class keeps its own hit list and its own achievements.

![Hall of deeds](docs/hall-of-deeds.png)

> Fan project. Not affiliated with or endorsed by Grinding Gear Games or poe.ninja.
> Ladder data is a fixed snapshot; live builds move.

## Features

### Three roulette modes

| Mode | Class | Main skill | Ascendancy | PoE.ninja check |
| --- | --- | --- | --- | --- |
| **Classic** | Chosen on the start screen | From the class pool captured at 0.3% usage | Verified class path | Yes |
| **Chaos** | Chosen on the start screen | Any of the 198 known main skills | Any class ascendancy | No |
| **Streamers** | Drawn from the poe.ninja Streamers tab | Used by that class in the streamer snapshot | Used by those streamer builds | No |

- One reroll per rolled stage. In Streamers, the class is drawn and can be rerolled once.
- Classic uses the editable class pools and the PoE.ninja usage floor.
- Chaos removes both the class skill filter and the population gate.
- Streamers draws from **80 complete builds by 79 streamers** using **48 main skills** in Covens + SSF Covens, and links the final result to the exact streamer character page.

### Hit list and achievements

- Seven classes, six pinnacle targets, one editable leaflet.
- Marking a target complete on a class hit list claims that class's achievement.
- Unmarking it returns the deed to the sealed state.
- **42 achievements** currently: one for every class and target.
- Filter the hall by class, see per-class progress, claim dates, tiers, and sigils.

![Editing a deed](docs/deed-editor.png)

### Keeper's table (`/admin`)

- Add, edit, hide, delete, and restore pinnacle targets.
- Edit each class's Classic skill pool and visibility.
- Switch the Classic PoE.ninja gate on or off.
- Edit every achievement: title, description, tier, sigil, and visibility; restore all default wording.
- Adding a target seeds seven new achievements. Deleting a target removes them.

## Tech stack

- [Nuxt 3](https://nuxt.com/) SPA (`ssr: false`)
- Vue 3 `<script setup>`
- [Ant Design Vue](https://www.antdv.com/)
- Nitro API routes
- [Drizzle ORM](https://orm.drizzle.team/) + SQLite (libSQL)
- poe.ninja data captured as a static snapshot and bundled in `server/assets/`

## Requirements

- Node.js **20 or newer**
- npm **10 or newer** (pnpm works too)

## Quick start

```bash
git clone <your-repository-url> poe-build-roulette
cd poe-build-roulette

npm install

# macOS / Linux
cp .env.example .env

# Windows PowerShell
# Copy-Item .env.example .env
```

Open `.env` and set:

```dotenv
NUXT_SESSION_PASSWORD=<at least 32 random characters>
NOCCO_ADMIN_PASSWORD=<your admin password>
```

Local development uses the SQLite file `sqlite.db`. To use a remote Turso database instead (required on Vercel), also set:

```dotenv
TURSO_DATABASE_URL=libsql://your-database-your-org.turso.io
TURSO_AUTH_TOKEN=your-turso-token
```

Then create the SQLite schema and start the dev server:

```bash
npm run db:push
npm run dev
```

Open <http://localhost:3000>. The first start seeds:

- the poe.ninja pairing snapshot,
- the seven editable class pools,
- the six-target leaflet,
- the 42 class/target achievements,
- the admin account (`admin` / `NOCCO_ADMIN_PASSWORD`).

The database file is `sqlite.db` in the project root. It is intentionally ignored by Git.

## Production build

```bash
npm run build
node --env-file=.env .output/server/index.mjs
```

Set `PORT` and `HOST` if the defaults do not fit your host:

```bash
PORT=3000 HOST=0.0.0.0 node --env-file=.env .output/server/index.mjs
```

`--env-file` requires Node.js 20.6+. If your host injects environment variables directly, omit the flag.

## Deploy on Vercel

Vercel has an ephemeral filesystem. The default `file:sqlite.db` database works locally, but it will not persist on Vercel. For a working deployment, use [Turso](https://turso.tech/) (libSQL). The app and Drizzle config already support both modes.

### 1. Create the Turso database

Install the [Turso CLI](https://docs.turso.tech/cli/introduction) or create the database in the Turso dashboard:

```bash
turso db create poe-roulette
turso db show poe-roulette --url
turso db tokens create poe-roulette
```

Put the URL and token into your local `.env`:

```dotenv
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
NUXT_SESSION_PASSWORD=...
NOCCO_ADMIN_PASSWORD=...
```

Apply the schema and seed the remote database once from your machine:

```bash
npm install
npm run db:push
npm run dev
```

Open the app once so the Nitro seed plugins fill Turso with pairings, classes, targets, achievements, and the admin account. Then stop the local server.

### 2. Import the repository into Vercel

1. Push the project to GitHub.
2. In Vercel choose **Add New → Project** and import the repository.
3. If the project files are inside a `poe-build-roulette` subfolder, set **Root Directory** to that folder.
4. Framework preset: **Nuxt.js**. Build command: `npm run build`. Install command: `npm install`.
5. Add these environment variables for **Production** and **Preview**:

```text
NUXT_SESSION_PASSWORD
NOCCO_ADMIN_PASSWORD
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
```

6. Deploy.

After deployment, check:

```text
https://your-project.vercel.app/api/achievements
```

A response with `"total": 42` means the remote database is connected and seeded.

### 3. Later changes

- Environment variable changes require a redeploy.
- If you change `server/db/schema.ts`, run `npm run db:push` locally with the Turso variables set, then redeploy.
- The admin account is seeded once. Changing `NOCCO_ADMIN_PASSWORD` after the first seed does not change an existing password.
- If you prefer the Vercel CLI:

```bash
npm i -g vercel
vercel
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
vercel --prod
```

If you do not configure Turso, Vercel can still serve the frontend, but the database-backed APIs will not work reliably because there is no persistent `sqlite.db`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start Nuxt in development on port 3000 |
| `npm run build` | Build the production client and Nitro server |
| `npm run preview` | Preview the built app |
| `npm run db:push` | Create or update the SQLite schema from `server/db/schema.ts` |

## Data and scope

- League label: **Covens of Umbra**, patch **3.30**.
- Class pools and Classic verification use **Covens + SSF Covens** data, with a **0.3%** class-usage floor.
- The Streamers mode uses a captured snapshot of the [poe.ninja Streamers tab](https://poe.ninja/poe1/builds/streamers), not a live scrape. The final build links to the captured character page.
- Achievements are derived from `goal_progress`; the admin edits presentation, not the unlock state.
- `sqlite.db` is not shipped. Run `npm run db:push` once, then let the seed plugins fill it.

## Project structure

```text
.
├─ assets/                  Global design tokens
├─ components/              Shared Vue components
├─ composables/             Auth and shell helpers
├─ docs/                    README screenshots
├─ layouts/                 Site shell
├─ middleware/              Global auth middleware
├─ pages/
│  ├─ index.vue             Roulette, modes, hit list, ledger
│  ├─ achievements.vue      Hall of deeds
│  ├─ admin.vue             Keeper's table
│  └─ login.vue
├─ plugins/                 Ant Design and dev-preview plugins
├─ server/
│  ├─ api/                  Nitro routes (public + admin)
│  ├─ assets/               Captured poe.ninja JSON snapshots
│  ├─ db/                   Drizzle schema and client
│  ├─ plugins/              Seed jobs
│  └─ utils/                Roulette, achievements, goals, classes
├─ app.vue
├─ nuxt.config.ts
├─ drizzle.config.ts
└─ package.json
```

## Resetting local data

To start over, stop the server, delete `sqlite.db`, and run `npm run db:push` again. This removes rolls, hit-list progress, admin edits, and achievement claims.

To change the admin password on an existing install, remove the database first (or update the `users` row yourself) and start with a new `NOCCO_ADMIN_PASSWORD`.

## Security

- `.env` is ignored by Git. Never commit real session, admin, or Turso secrets.
- The Turso auth token grants database access; treat it like a password.
- The admin routes require the admin role.
- The app has no public account registration; the first admin is seeded from `NOCCO_ADMIN_PASSWORD`.

## License

[MIT No Attribution](LICENSE).

Path of Exile is a trademark of Grinding Gear Games. poe.ninja data belongs to its respective owners.
