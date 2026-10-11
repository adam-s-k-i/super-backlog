// src/version-refresh.ts
// Detached worker started by the startup version hint (spawnVersionRefresh):
// `node version-refresh.js <home>` refreshes <home>/.super-backlog/version-check.json.
import process from 'node:process';
import { refreshVersionCache } from './lib/version-check.js';

const home = process.argv[2];
if (home) await refreshVersionCache(home);
