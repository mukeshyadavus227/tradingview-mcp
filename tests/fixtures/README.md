# CDP Fixture Recorder

Lets the e2e suite run **offline** — without a live TradingView Desktop —
by persisting recorded `Runtime.evaluate` responses keyed by SHA-1 of the
expression string.

## Modes (`tests/e2e.test.js` picks one at startup)

| Mode     | Trigger                                            | Behavior                                                   |
|----------|----------------------------------------------------|------------------------------------------------------------|
| `live`   | CDP reachable at localhost:9222                    | Direct `Runtime.evaluate` — no fixture touched             |
| `record` | CDP reachable **and** `TV_FIXTURE_MODE=record`     | Live evaluate + persist every response into `e2e.json`     |
| `replay` | CDP unreachable **and** `e2e.json` exists          | Returns the recorded response; throws "fixture miss" otherwise |
| `skip`   | CDP unreachable **and** no `e2e.json`              | Whole e2e suite auto-skips (clean CI signal)               |

Startup line printed to stderr: `[e2e] mode=<mode> (cdp=<bool> fixture=<bool>)`

## Recording a new fixture set

```bash
# 1. Launch TradingView Desktop with --remote-debugging-port=9222
# 2. Open a chart with a few indicators on it
# 3. Run:
npm run test:e2e:record
```

This writes `tests/fixtures/e2e.json`. Commit the file so CI can replay.

## Why this design

- **Byte-for-byte deterministic** — fixtures capture the exact shape of
  TradingView's internal objects, which change between releases.
- **No network required** — CI runs in seconds without touching TV.
- **Pins against a snapshot** — if TradingView's internal API changes
  and breaks a probe, the diff shows up immediately against the fixture.
- **Stale fixtures fail loud** — replay mode throws "fixture miss" on
  any unrecorded expression, forcing a re-record rather than silently
  skipping.

## Re-record cadence

- Before cutting a release
- When TradingView Desktop auto-updates
- After adding any new tool that exercises a new CDP path
