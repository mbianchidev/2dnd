# Utility scripts

- `run-browser-tests.mjs` allocates an unused localhost port, passes it to the
  Playwright config, and runs the browser suite without reusing stale Vite
  servers. Invoke it through `npm run test:browser`.
- `measure-performance-baseline.mjs` builds the production `/2dnd/` target,
  launches it on an unused local port, and prints reproducible bundle, startup,
  Boot texture, memory, DOM/listener, and fresh-save metrics. Run
  `npm run test:browser:install` once, then invoke it through
  `npm run benchmark:baseline`.
