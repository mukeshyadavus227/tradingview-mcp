# Architecture

High-level map of how the repo is wired. Read this before making
changes that cross layer boundaries.

## Layers

```
┌─────────────┐   ┌─────────────┐         ┌────────────────┐
│   Claude    │   │   Your      │         │  Chrome DevTools│
│ (MCP client)│   │  Terminal   │         │    Protocol     │
└──────┬──────┘   └──────┬──────┘         └────────▲────────┘
       │ stdio            │ argv                    │ WebSocket
       ▼                  ▼                         │
┌──────────────┐   ┌──────────────┐                 │
│ src/server.js│   │ src/cli/     │                 │
│ (MCP tools)  │   │   index.js   │                 │
└──────┬───────┘   └──────┬───────┘                 │
       │                   │                         │
       ▼                   ▼                         │
┌──────────────────────────────────────┐             │
│           src/tools/*.js             │             │
│  (zod validation + response wrap)    │             │
└─────────────┬────────────────────────┘             │
              ▼                                       │
┌──────────────────────────────────────┐             │
│           src/core/*.js              │             │
│  (business logic + evaluate() calls) │             │
└─────────────┬────────────────────────┘             │
              ▼                                       │
┌──────────────────────────────────────┐             │
│        src/connection.js             ├─────────────┘
│  (CDP client, retry, auto-reconnect) │
└──────────────────────────────────────┘
```

## Directory reference

| Path                    | Purpose                                        |
|-------------------------|------------------------------------------------|
| `src/server.js`         | MCP stdio entry point; registers all 78 tools  |
| `src/cli/index.js`      | CLI entry point; registers all CLI commands    |
| `src/cli/router.js`     | Zero-dep argv parser using node:util           |
| `src/cli/commands/*.js` | One file per CLI command group (chart, pine…)  |
| `src/tools/*.js`        | MCP tool registration, one file per group      |
| `src/tools/_format.js`  | `jsonResult` + `wrapCall` response envelopes   |
| `src/core/*.js`         | The actual logic. No MCP or CLI concerns here. |
| `src/connection.js`     | Single CDP client, retry/backoff, `evaluate()` |
| `src/errors.js`         | `TvMcpError` hierarchy + `classifyError()`     |
| `src/ratelimit.js`      | `TokenBucket` + shared `pineFacadeLimiter`     |
| `src/shutdown.js`       | SIGINT/SIGTERM handler coordinator             |
| `src/progress.js`       | Optional progress reporter for long ops        |
| `src/types.js`          | JSDoc `@typedef` central file                  |
| `src/wait.js`           | Poll-until-ready helpers                       |
| `tests/*.test.js`       | Unit + e2e tests (node:test)                   |
| `tests/fixtures/`       | Recorded CDP responses for offline e2e         |

## Key invariants

1. **`src/core` never imports `src/tools` or `src/cli`.** Core is the
   lowest layer that multiple transports (MCP, CLI, future HTTP) share.
2. **Every string parameter that ends up inside a CDP `evaluate()`
   template literal must pass through `safeString()` or `JSON.stringify()`.**
   The sanitization audit in `tests/sanitization.test.js` enforces this.
3. **Every `core/*.js` function returns `{ success: true, ...data }` or
   throws.** Tools translate throws into `{ success: false, error,
   error_code, retryable, hint }` via `wrapCall()`.
4. **CDP connection is a singleton.** `getClient()` reuses the cached
   client and auto-reconnects on the next call if the socket died.
5. **Rate-limited upstreams go through `ratelimit.js`.** Direct `fetch`
   calls to `pine-facade.tradingview.com` must acquire a
   `pineFacadeLimiter` token.
6. **All long-running ops take an optional `progress` reporter.**
   Batch, replay autoplay, and stream loops should call
   `reporter.update(pct, msg)` so the MCP transport can forward to the
   client.

## Pine graphics read path

TradingView's Pine Script indicators store `line.new()`, `label.new()`,
`table.new()`, and `box.new()` outputs in an internal tree on each
study:

```
study._graphics._primitivesCollection
  .dwglines      .get('lines')       .get(false)._primitivesDataById   // horizontal/trend lines
  .dwglabels     .get('labels')      .get(false)._primitivesDataById   // text labels
  .dwgtablecells .get('tableCells')  .get(false)._primitivesDataById   // tables
  .dwgboxes      .get('boxes')       .get(false)._primitivesDataById   // zones
```

`core/data.js::buildGraphicsJS` generates the CDP expression that walks
every loaded study, filters by study name, and returns raw items. The
pure helpers (`processPineLines`, `processPineLabels`, `processPineTables`,
`processPineBoxes`) then dedup / cap / sort for client consumption.

## Error taxonomy

Every throw crossing the tools boundary is classified into one of:

| Class                | Retryable | Example trigger                          |
|----------------------|-----------|------------------------------------------|
| `ConnectionError`    | yes       | CDP target not found, ECONNREFUSED       |
| `ConnectionLostError`| yes       | WebSocket closed mid-session             |
| `AuthError`          | no        | 401/403 from `pine-facade`               |
| `RateLimitError`     | yes       | 429 from an upstream API                 |
| `UserInputError`     | no        | bad overrides JSON, unknown enum         |
| `UiStateError`       | no        | Pine Editor not open                     |
| `TimeoutError`       | yes       | `waitForChartReady` exceeded             |
| `TvMcpError` (base)  | —         | catch-all for unclassified errors        |

## Versioning policy for TradingView internals

TradingView's desktop app ships frequent updates that can silently break
the internal API paths in `KNOWN_PATHS`. When adding a new probe:

1. Record a canonical response into `tests/fixtures/e2e.json` so CI pins
   against the known-good shape.
2. Document the probe path in `RESEARCH.md`.
3. Guard every `evaluate()` body with `try { ... } catch(e) { }` so a
   missing sub-property degrades gracefully instead of crashing.
