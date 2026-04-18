# CDP Fixture Recorder

This directory stores recorded CDP `Runtime.evaluate` responses so the e2e
suite can run **offline** — without a live TradingView Desktop.

## How it works

At runtime each CDP call is keyed by a SHA-1 of its `expression` string.
In **record mode** (`TV_FIXTURE_MODE=record`), the harness proxies to a
live CDP target and persists every `{expression, result}` pair into
`tests/fixtures/<suite>.json`. In **replay mode** (default when fixtures
exist), the harness returns the recorded result and never touches the
network.

## Recording a new fixture set

```bash
# Start TradingView Desktop first with --remote-debugging-port=9222
TV_FIXTURE_MODE=record npm run test:e2e:fixture
```

The recording is written to `tests/fixtures/e2e.json` — commit that file
to source control so CI can replay it.

## Why this design

- **Byte-for-byte deterministic** — fixtures capture the exact shape of
  TradingView's internal objects, which change between releases.
- **No network**, no chart required — so CI runs in seconds on every PR.
- **Pins against a snapshot** — if TradingView's internal API changes and
  breaks a probe, the diff shows up immediately against the fixture.

Re-record periodically (and before any release) to pick up upstream
changes.
