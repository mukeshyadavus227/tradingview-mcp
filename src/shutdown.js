/**
 * Graceful shutdown coordinator.
 *
 * Any module that holds a resource (CDP socket, polling loop, child
 * process) should register a handler here. On SIGINT / SIGTERM / normal
 * exit, handlers run once in reverse-registration order with a soft
 * timeout so a stuck handler can't block the process forever.
 */
const handlers = [];
let installed = false;
let running = false;

/**
 * Register a cleanup callback. Returns an unregister function.
 * @param {string} name
 * @param {() => void | Promise<void>} fn
 */
export function onShutdown(name, fn) {
  const entry = { name, fn };
  handlers.push(entry);
  installOnce();
  return () => {
    const idx = handlers.indexOf(entry);
    if (idx !== -1) handlers.splice(idx, 1);
  };
}

async function runAll(reason, { timeoutMs = 2000 } = {}) {
  if (running) return;
  running = true;
  // reverse order so the last-registered resource releases first
  const reversed = [...handlers].reverse();
  for (const { name, fn } of reversed) {
    try {
      await Promise.race([
        Promise.resolve(fn()),
        new Promise(r => setTimeout(r, timeoutMs)),
      ]);
    } catch (err) {
      process.stderr.write(`[shutdown:${name}] ${err.message}\n`);
    }
  }
  process.stderr.write(`[shutdown] complete (${reason})\n`);
}

function installOnce() {
  if (installed) return;
  installed = true;
  const handleSignal = (sig) => async () => {
    await runAll(sig);
    // eslint-disable-next-line n/no-process-exit
    process.exit(0);
  };
  process.on('SIGINT', handleSignal('SIGINT'));
  process.on('SIGTERM', handleSignal('SIGTERM'));
  process.on('beforeExit', () => runAll('beforeExit'));
}

// Test helper: clear handlers + reset install flag
export function _resetForTests() {
  handlers.length = 0;
  installed = false;
  running = false;
}

/** Internal: invoke shutdown manually (used for tests). */
export async function _triggerShutdown(reason = 'manual', opts) {
  await runAll(reason, opts);
}
