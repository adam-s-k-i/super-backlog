import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // e2e suites spawn the real CLI; init/uninstall now run preflight and
    // verification probes (powershell/npm spawns), which can exceed 15s on a
    // loaded CI runner.
    testTimeout: 30000,
  },
});
