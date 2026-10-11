// test/unit/summary-facts-io.test.ts
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, readFileSync: vi.fn(actual.readFileSync) };
});

const { collectSummaryFacts } = await import('../../src/dashboard/summary-facts.js');

let cwd = '';
afterEach(() => {
  if (cwd) fs.rmSync(cwd, { recursive: true, force: true });
});

it('checks the size with stat and never reads a file that would exceed the byte budget', () => {
  cwd = fs.mkdtempSync(join(tmpdir(), 'sbl-facts-io-'));
  fs.mkdirSync(join(cwd, 'src'));
  fs.writeFileSync(join(cwd, 'package.json'), '{"name":"demo"}');
  const huge = join(cwd, 'src', 'huge.ts');
  fs.writeFileSync(huge, 'x\n'.repeat(50));
  const noGit = () => ({ status: 127, stdout: '', stderr: 'spawn git ENOENT' });
  const f = collectSummaryFacts(cwd, { runCapture: noGit, maxBytes: 25 });
  expect(f.locApprox).toBe(true);
  expect(f.sourceFiles).toBe(1);
  const readPaths = vi.mocked(fs.readFileSync).mock.calls.map((c) => String(c[0]));
  expect(readPaths).not.toContain(huge);
});
