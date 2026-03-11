import { wrap } from 'comlink';
import type { DBWorkerAPI } from '../workers/db.worker';

// Instantiate the Web Worker using Vite's worker import syntax
const worker = new Worker(new URL('../workers/db.worker.ts', import.meta.url), {
  type: 'module',
});

// Wrap the worker with Comlink to create a fully typed RPC proxy.
// This allows us to call worker methods as if they were normal async functions on the main thread.
export const dbClient = wrap<DBWorkerAPI>(worker);
