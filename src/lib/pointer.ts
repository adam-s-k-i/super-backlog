// src/lib/pointer.ts
import { detectEol } from './eol.js';

/** Heading of the CLAUDE.md pointer section owned by super-backlog. */
export const POINTER_HEADING_RE = /^##\s+Workflow system \(managed by super-backlog\)\s*$/m;

const ANY_HEADING_RE = /^#{1,6}\s/;

/** Line indices into `content.split('\n')`; `end` is exclusive. */
export interface PointerSection {
  start: number;
  end: number;
}

export interface PointerRefresh {
  action: 'created' | 'replaced' | 'unchanged';
  content: string;
}

/** First pointer section: from its heading up to the next heading of any level (or the end). */
export function findPointerSection(lines: string[]): PointerSection | null {
  const start = lines.findIndex((line) => POINTER_HEADING_RE.test(line));
  if (start === -1) return null;
  for (let i = start + 1; i < lines.length; i++) {
    if (ANY_HEADING_RE.test(lines[i])) return { start, end: i };
  }
  return { start, end: lines.length };
}

/**
 * Appends the pointer when missing, replaces a stale pointer section and keeps an
 * identical one. Line endings are ignored when comparing and kept when replacing.
 */
export function refreshPointer(current: string, template: string): PointerRefresh {
  const body = template.replace(/\r\n/g, '\n').trimEnd();
  const nl = detectEol(current);
  const lines = current.split('\n');
  const section = findPointerSection(lines);
  if (section === null) {
    const sep =
      current.length === 0 ? '' : current.endsWith(`${nl}${nl}`) ? '' : current.endsWith('\n') ? nl : `${nl}${nl}`;
    return { action: 'created', content: `${current}${sep}${body.split('\n').join(nl)}${nl}` };
  }
  const existing = lines
    .slice(section.start, section.end)
    .map((line) => line.replace(/\r$/, ''))
    .join('\n')
    .trimEnd();
  if (existing === body) return { action: 'unchanged', content: current };
  const cr = nl === '\r\n' ? '\r' : '';
  const atEof = section.end === lines.length;
  const replacement = [...body.split('\n').map((line) => `${line}${cr}`), atEof ? '' : cr];
  return {
    action: 'replaced',
    content: [...lines.slice(0, section.start), ...replacement, ...lines.slice(section.end)].join('\n'),
  };
}
