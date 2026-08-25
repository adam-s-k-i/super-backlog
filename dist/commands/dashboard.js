// src/commands/dashboard.ts
import { isAbsolute, join, resolve } from 'node:path';
import { collectDashboardData } from '../dashboard/data.js';
import { renderDashboard } from '../dashboard/render.js';
import { DASHBOARD_PORT, startServeServer } from '../dashboard/server.js';
import { atomicWrite } from '../lib/atomic.js';
import { KIT_VERSION } from '../lib/version.js';
async function regenerateInto(outPath, cwd) {
    const data = collectDashboardData(cwd, { kitVersion: KIT_VERSION });
    atomicWrite(outPath, renderDashboard(data));
}
/**
 * Generate dashboard.html for the project; with `{ serve: true }`, start the
 * live-reload server afterwards (the listening socket keeps the process up).
 * Called by `sbl init` with serve disabled.
 */
export async function generateDashboard(cwd, o) {
    const outPath = join(cwd, 'dashboard.html');
    await regenerateInto(outPath, cwd);
    if (o.serve) {
        // Dynamic import keeps init resilient if the serve module is unavailable.
        const specifier = '../dashboard/server.js';
        const mod = (await import(specifier));
        if (typeof mod.startServeServer !== 'function') {
            throw new Error('serve module does not export startServeServer');
        }
        await mod.startServeServer(cwd, {
            port: DASHBOARD_PORT,
            regenerate: () => regenerateInto(outPath, cwd),
            openBrowser: true,
        });
    }
    return outPath;
}
/** CLI entry for `sbl dashboard [--serve] [--port N] [--no-open] [--out FILE]`. */
export async function runDashboard(cwd, args) {
    const values = args.values;
    let port = DASHBOARD_PORT;
    if (values['port'] !== undefined) {
        const parsed = Number(values['port']);
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
            console.error(`error: invalid --port "${String(values['port'])}" (expected 0-65535)`);
            return 1;
        }
        port = parsed;
    }
    const serve = values['serve'] === true;
    const noOpen = values['no-open'] === true;
    const outFile = values['out'] === undefined ? 'dashboard.html' : String(values['out']);
    const outPath = isAbsolute(outFile) ? outFile : resolve(cwd, outFile);
    try {
        await regenerateInto(outPath, cwd);
        console.log(`dashboard written: ${outPath}`);
        if (serve) {
            console.log(`serving dashboard at http://127.0.0.1:${port}/ (press Ctrl+C to stop)`);
            await startServeServer(cwd, {
                port,
                file: outPath,
                regenerate: () => regenerateInto(outPath, cwd),
                openBrowser: !noOpen,
            });
        }
        return 0;
    }
    catch (err) {
        console.error(`error: dashboard generation failed (${err instanceof Error ? err.message : String(err)})`);
        return 1;
    }
}
