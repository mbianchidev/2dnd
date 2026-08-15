# Utility scripts

- `run-browser-tests.mjs` allocates an unused localhost port, passes it to the
  Playwright config, and runs the browser suite without reusing stale Vite
  servers. Invoke it through `npm run test:browser`.
- `run-desktop-dev.mjs` allocates a loopback-only Vite port, waits for it to
  become responsive, launches the Electron shell, and stops both child
  processes together. Invoke it through `npm run dev:desktop`.
- `generate-desktop-icons.mjs` creates the original pixel-d20 PNG, ICO, ICNS,
  and Linux icon set without external assets or image dependencies. Invoke it
  through `npm run generate:desktop-icons`; packaging runs it automatically.
