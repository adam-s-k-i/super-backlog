// test/unit/yamlmini.test.ts
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readSimpleKeys } from '../../src/lib/yamlmini.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sbl-yaml-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('readSimpleKeys', () => {
  it('reads flat keys and strips quotes', () => {
    const p = join(dir, 'config.yml');
    writeFileSync(p, 'project_name: "My Project"\ndescription: Plain text\nother:\n  nested: x\n');
    expect(readSimpleKeys(p, ['project_name', 'description'])).toEqual({
      project_name: 'My Project',
      description: 'Plain text',
    });
  });
  it('returns undefined for missing file and missing keys', () => {
    expect(readSimpleKeys(join(dir, 'nope.yml'), ['name'])).toEqual({ name: undefined });
  });
});
