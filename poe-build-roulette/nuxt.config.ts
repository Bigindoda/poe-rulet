export default defineNuxtConfig({
  // The app runs as a single-page app talking to its own server routes.
  ssr: false,
  devtools: { enabled: false },
  app: { head: { title: "PoE Build Roulette", htmlAttrs: { lang: 'en' } } },
  // lang: the language the app was created in; shell pages read it for their own text.
  // signIn: 'required' sends signed-out visitors to /login and closes /api to them;
  // 'off' opens the app to everyone, leaving role checks to the routes that call them.
  runtimeConfig: { public: { lang: 'en', signIn: 'off' } },
  // Ant Design Vue pulls in CommonJS modules (its date library among them).
  // Pre-bundling the library lets the browser load them as ES modules.
  vite: {
    optimizeDeps: { include: ['ant-design-vue', '@ant-design/icons-vue'] },
    server: {
      // Test artifacts and browser profiles live in the project folder; without
      // these ignores the dev watcher hits EBUSY on locked temp/profile files and
      // restarts Nuxt until the app is unreachable.
      watch: {
        ignored: [
          '**/.artifacts/**',
          '**/.tmp/**',
          '**/.npm-cache/**',
          '**/.edge-profile/**',
          '**/*.tmpdir/**',
          '**/.*.tmpdir',
          '**/.*.tmpdir/**',
          '**/.*.tmp',
          '**/*.tmp',
          '**/.output/**',
          // SQLite writes its journal/WAL beside the database. Those files are
          // not source changes, and a reload mid-rite would erase the results.
          '**/sqlite.db',
          '**/sqlite.db-journal',
          '**/sqlite.db-wal',
          '**/sqlite.db-shm',
          // Editor writes land in dot-prefixed *.tmpdir siblings; chokidar's glob
          // matching misses some of them, so reject the paths directly.
          /(^|[\\/])\.[^\\/]*\.tmpdir([\\/]|$)/,
          /\.[^\\/]*\.tmp$/,
        ],
      },
    },
  },
});
