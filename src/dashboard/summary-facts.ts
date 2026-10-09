// src/dashboard/summary-facts.ts
// Automatic project facts for the summary page (spec D2-D4, D6). Everything
// here is derived from files in the project; nothing is curated.
import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

import { detectPackageManager } from '../lib/pm.js';
import { runCapture as defaultRunCapture, type RunResult } from '../lib/run.js';

export type ManifestKind = 'package.json' | 'composer.json' | 'wordpress';

export interface FactPackage {
  name: string;
  group: 'Runtime' | 'Development';
  /** Resolved lockfile version, or the declared range without a lockfile. */
  version: string;
  source: ManifestKind;
}

export interface FactCommandGroup {
  group: string;
  entries: { run: string; note?: string }[];
}

export interface SummaryFacts {
  name: string | null;
  version: string | null;
  license: string | null;
  /** The manifest that supplied name/version/license (the first one found, D2). */
  manifest: ManifestKind | null;
  /** Every manifest present, in precedence order. */
  manifests: ManifestKind[];
  /** Runtime dependencies summed across manifests (package.json dependencies, composer require minus php/ext-*). */
  dependencies: number;
  devDependencies: number;
  packages: FactPackage[];
  /** Lookup for stack[].package / stack[].name: resolved version or declared range. */
  versions: Record<string, string>;
  extensions: string[];
  fileSource: 'git' | 'walk';
  sourceFiles: number;
  loc: number;
  /** True when reading stopped at the byte budget; the page then shows the LOC with a leading ≈. */
  locApprox: boolean;
  testFiles: number;
  releases: number;
  /** "git unavailable" when the tag listing failed. */
  releasesNote: string | null;
  workflows: number;
  commands: FactCommandGroup[];
  warnings: string[];
}

export interface FactsDeps {
  runCapture?: (cmd: string, args: string[], cwd: string) => RunResult;
  /** Byte budget for LOC counting; defaults to 10 MB. */
  maxBytes?: number;
}

export const FACTS_MAX_BYTES = 10 * 1024 * 1024;
const JS_EXT = ['.ts', '.tsx', '.js', '.mjs', '.cjs'];
const PHP_EXT = ['.php'];
const SKIP_DIRS = new Set(['node_modules', 'vendor', 'dist', 'build', '.git']);
const TEST_DIR_RE = /(^|\/)(test|tests|__tests__)\//;
const TEST_NAME_RE = /\.(test|spec)\.[^/]+$/;
const TAG_RE = /^v?\d/;

type Json = Record<string, unknown>;

function readJson(cwd: string, file: string, warnings: string[]): Json | null {
  const p = join(cwd, file);
  if (!existsSync(p)) return null;
  try {
    const v: unknown = JSON.parse(readFileSync(p, 'utf8'));
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Json;
    warnings.push(`${file}: expected a JSON object`);
  } catch (err) {
    warnings.push(`${file}: ${(err as Error).message}`);
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function strMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v as Json)) if (typeof val === 'string') out[k] = val;
  return out;
}

function licenseOf(v: unknown): string | null {
  if (typeof v === 'string') return str(v);
  if (Array.isArray(v)) {
    const parts = v.filter((x): x is string => typeof x === 'string');
    return parts.length > 0 ? parts.join(' OR ') : null;
  }
  return null;
}

function readHead(path: string, bytes = 8192): string {
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n).toString('utf8');
  } finally {
    closeSync(fd);
  }
}

export interface WordPressHeader {
  type: 'theme' | 'plugin';
  file: string;
  name: string;
  version: string | null;
  license: string | null;
}

function headerField(text: string, field: string): string | null {
  const m = new RegExp(`^[\\s*#@/]*${field}:[ \\t]*(.+)$`, 'mi').exec(text);
  return m ? m[1].replace(/\s*\*\/\s*$/, '').trim() || null : null;
}

/** style.css with `Theme Name:` wins over a root *.php with `Plugin Name:` (sorted by file name). */
export function readWordPressHeader(cwd: string): WordPressHeader | null {
  const style = join(cwd, 'style.css');
  if (existsSync(style)) {
    const head = readHead(style);
    const name = headerField(head, 'Theme Name');
    if (name) return { type: 'theme', file: 'style.css', name, version: headerField(head, 'Version'), license: headerField(head, 'License') };
  }
  let entries: string[] = [];
  try {
    entries = readdirSync(cwd).filter((f) => f.toLowerCase().endsWith('.php')).sort();
  } catch {
    return null;
  }
  for (const f of entries) {
    const p = join(cwd, f);
    try {
      if (!statSync(p).isFile()) continue;
    } catch {
      continue;
    }
    const head = readHead(p);
    const name = headerField(head, 'Plugin Name');
    if (name) return { type: 'plugin', file: f, name, version: headerField(head, 'Version'), license: headerField(head, 'License') };
  }
  return null;
}

function npmLockVersions(cwd: string, warnings: string[]): Record<string, string> {
  const lock = readJson(cwd, 'package-lock.json', warnings);
  const out: Record<string, string> = {};
  const pkgs = lock?.packages;
  if (!pkgs || typeof pkgs !== 'object') return out;
  for (const [key, val] of Object.entries(pkgs as Json)) {
    if (!key.startsWith('node_modules/') || key.lastIndexOf('node_modules/') !== 0) continue;
    const v = (val as Json | null)?.version;
    if (typeof v === 'string') out[key.slice('node_modules/'.length)] = v;
  }
  return out;
}

function composerLockVersions(cwd: string, warnings: string[]): Record<string, string> {
  const lock = readJson(cwd, 'composer.lock', warnings);
  const out: Record<string, string> = {};
  for (const listKey of ['packages', 'packages-dev']) {
    const list = lock?.[listKey];
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      const name = (p as Json | null)?.name;
      const version = (p as Json | null)?.version;
      if (typeof name === 'string' && typeof version === 'string') out[name] = version;
    }
  }
  return out;
}

function composerCounts(name: string): boolean {
  return name !== 'php' && !name.startsWith('ext-');
}

/** Paths relative to cwd with forward slashes: `git ls-files -z`, else a directory walk. */
export function listProjectFiles(
  cwd: string,
  run: (cmd: string, args: string[], cwd: string) => RunResult,
): { source: 'git' | 'walk'; files: string[] } {
  const r = run('git', ['ls-files', '-z'], cwd);
  if (r.status === 0 && r.stdout.length > 0) {
    return { source: 'git', files: r.stdout.split('\0').filter(Boolean).sort() };
  }
  const files: string[] = [];
  const walk = (dir: string, rel: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), relPath);
      } else if (e.isFile()) {
        files.push(relPath);
      }
    }
  };
  walk(cwd, '');
  return { source: 'walk', files };
}

export function isTestFile(rel: string): boolean {
  return TEST_NAME_RE.test(rel) || TEST_DIR_RE.test(rel);
}

function countLines(buf: Buffer): number {
  if (buf.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] === 10) n++;
  return buf[buf.length - 1] === 10 ? n : n + 1;
}

export function collectSummaryFacts(cwd: string, deps: FactsDeps = {}): SummaryFacts {
  const run = deps.runCapture ?? defaultRunCapture;
  const maxBytes = deps.maxBytes ?? FACTS_MAX_BYTES;
  const warnings: string[] = [];

  const pkg = readJson(cwd, 'package.json', warnings);
  const composer = readJson(cwd, 'composer.json', warnings);
  const wp = readWordPressHeader(cwd);

  const manifests: ManifestKind[] = [];
  if (pkg) manifests.push('package.json');
  if (composer) manifests.push('composer.json');
  if (wp) manifests.push('wordpress');
  const manifest = manifests[0] ?? null;

  let name: string | null = null;
  let version: string | null = null;
  let license: string | null = null;
  if (manifest === 'package.json' && pkg) {
    name = str(pkg.name);
    version = str(pkg.version);
    license = licenseOf(pkg.license);
  } else if (manifest === 'composer.json' && composer) {
    name = str(composer.name);
    version = str(composer.version);
    license = licenseOf(composer.license);
  } else if (manifest === 'wordpress' && wp) {
    ({ name, version, license } = wp);
  }
  // A plugin/theme header fills gaps a composer.json leaves (composer packages rarely carry a version).
  if (wp && manifest !== 'wordpress') {
    version ??= wp.version;
    license ??= wp.license;
  }

  const npmLock = pkg ? npmLockVersions(cwd, warnings) : {};
  const composerLock = composer ? composerLockVersions(cwd, warnings) : {};
  const packages: FactPackage[] = [];
  const versions: Record<string, string> = {};
  const add = (map: Record<string, string>, group: FactPackage['group'], source: ManifestKind, lock: Record<string, string>, keep: (n: string) => boolean): number => {
    let count = 0;
    for (const [dep, range] of Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      if (!keep(dep)) continue;
      count++;
      const v = lock[dep] ?? range;
      packages.push({ name: dep, group, version: v, source });
      versions[dep] ??= v;
    }
    return count;
  };
  let dependencies = 0;
  let devDependencies = 0;
  if (pkg) {
    dependencies += add(strMap(pkg.dependencies), 'Runtime', 'package.json', npmLock, () => true);
    devDependencies += add(strMap(pkg.devDependencies), 'Development', 'package.json', npmLock, () => true);
  }
  if (composer) {
    const require = strMap(composer.require);
    if (require.php) versions.php ??= require.php;
    dependencies += add(require, 'Runtime', 'composer.json', composerLock, composerCounts);
    devDependencies += add(strMap(composer['require-dev']), 'Development', 'composer.json', composerLock, composerCounts);
  }

  const extensions = manifest === 'package.json' ? JS_EXT : manifest === null ? [...JS_EXT, ...PHP_EXT] : PHP_EXT;
  const listed = listProjectFiles(cwd, run);
  let loc = 0;
  let bytes = 0;
  let locApprox = false;
  let sourceFiles = 0;
  let testFiles = 0;
  for (const rel of listed.files) {
    if (!extensions.includes(extname(rel).toLowerCase())) continue;
    sourceFiles++;
    if (isTestFile(rel)) testFiles++;
    if (locApprox) continue;
    let buf: Buffer;
    try {
      buf = readFileSync(join(cwd, rel));
    } catch {
      continue; // listed by git but deleted in the work tree
    }
    if (bytes + buf.length > maxBytes) {
      locApprox = true;
      continue;
    }
    bytes += buf.length;
    loc += countLines(buf);
  }

  const tags = run('git', ['tag', '--list'], cwd);
  const releases = tags.status === 0 ? tags.stdout.split(/\r?\n/).filter((t) => TAG_RE.test(t.trim())).length : 0;
  const releasesNote = tags.status === 0 ? null : 'git unavailable';

  let workflows = 0;
  try {
    workflows = readdirSync(join(cwd, '.github', 'workflows')).filter((f) => /\.ya?ml$/i.test(f)).length;
  } catch {
    workflows = 0;
  }

  const commands: FactCommandGroup[] = [];
  if (pkg) {
    const pm = detectPackageManager(cwd) ?? 'npm';
    const scripts = Object.entries(strMap(pkg.scripts));
    if (scripts.length > 0) {
      commands.push({ group: 'package.json scripts', entries: scripts.map(([s, body]) => ({ run: `${pm} run ${s}`, note: body.length > 80 ? `${body.slice(0, 79)}…` : body })) });
    }
  }
  if (composer) {
    const scripts = Object.entries(composer.scripts && typeof composer.scripts === 'object' ? (composer.scripts as Json) : {});
    if (scripts.length > 0) commands.push({ group: 'composer.json scripts', entries: scripts.map(([s]) => ({ run: `composer ${s}` })) });
  }

  return {
    name,
    version,
    license,
    manifest,
    manifests,
    dependencies,
    devDependencies,
    packages,
    versions,
    extensions,
    fileSource: listed.source,
    sourceFiles,
    loc,
    locApprox,
    testFiles,
    releases,
    releasesNote,
    workflows,
    commands,
    warnings,
  };
}
