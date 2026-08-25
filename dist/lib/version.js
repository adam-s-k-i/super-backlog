// src/lib/version.ts
import { createRequire } from 'node:module';
import process from 'node:process';
const require = createRequire(import.meta.url);
export const KIT_VERSION = require('../../package.json').version ?? '0.0.0';
export function assertNode20() {
    const major = Number(process.versions.node.split('.')[0]);
    if (major < 20) {
        console.error(`super-backlog requires Node >= 20 (found ${process.versions.node}).`);
        process.exit(1);
    }
}
