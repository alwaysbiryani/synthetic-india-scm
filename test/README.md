# Tests

Three suites cover the engine and the interactive dashboard.

| Command | What it checks | Needs |
| --- | --- | --- |
| `npm run test:engine` | Every metric, scenario, and dropdown value through `lib/engine` (~1,300 assertions): finite stats, weights normalise, cap is respected, unscored windows are flagged. | tsx (dev dep) |
| `npm run test:browser` | Builds, serves, and drives the real UI in Chromium — controls wire to the chart/stats, shareable URLs round-trip, no console/hydration errors, knobs sit under the Stack selector. | a Chromium browser |
| `npm test` | Runs both of the above. | both |

## Browser resolution

`test:browser` needs a Chromium executable. It is auto-detected in this order:

1. `PLAYWRIGHT_CHROMIUM_PATH` (or `PW_CHROMIUM`) if set,
2. a `chromium-*` build under `PLAYWRIGHT_BROWSERS_PATH` or `/opt/pw-browsers`.

If none is found the browser suites **skip** (exit 0) rather than fail, so a
CI job without a browser still passes. To run them locally without a
system Chromium: `npx playwright install chromium` and point
`PLAYWRIGHT_CHROMIUM_PATH` at the result.

## Notes

- The server runs on `PORT` (default `3123`); override `BASE_URL` to point the
  browser suites at an already-running server.
- `test/with-server.mjs` boots `next start`, waits for readiness, runs each
  script, and shuts the server down.
