// Important: background worker runs in plain Node (not Next), so we must
// register runtime aliases for imports like `@/lib/...` used throughout `lib/`.
//
// This reads `_moduleAliases` from package.json (we map `@` -> dist/workers).
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('module-alias/register');

// Use require() to ensure alias registration happens before any other modules load.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const os = require('os');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { startWorker } = require('./process-jobs');

function getEnvNumber(key: string, def: number) {
  const v = process.env[key];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

async function main() {
  const concurrency = getEnvNumber('WORKER_CONCURRENCY', 3);
  const pollIntervalMs = getEnvNumber('POLL_INTERVAL_MS', 2000);

  const workerId = process.env.WORKER_ID || `${os.hostname()}-${process.pid}`;

  console.log(`[worker] Starting. workerId=${workerId} concurrency=${concurrency} pollIntervalMs=${pollIntervalMs}`);
  console.log(`[worker] Log level: ${process.env.WORKER_LOG_LEVEL || 'info'}`);

  const shutdown = (signal: string) => {
    console.log(`[worker] Received ${signal}. Exiting...`);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await startWorker({ workerId, concurrency, pollIntervalMs });
}

main().catch(err => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
