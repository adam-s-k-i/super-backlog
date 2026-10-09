// src/lib/markers.ts
import { detectEol } from './eol.js';

const START_RE = /<!--\s*SUPER-BACKLOG:(\d+\.\d+\.\d+)\s*START\s*-->/;

export function markerStart(version: string): string {
  return `<!-- SUPER-BACKLOG:${version} START -->`;
}

export const MARKER_END = '<!-- SUPER-BACKLOG END -->';

export interface InjectResult {
  content: string;
  action: 'created' | 'replaced' | 'unchanged';
}

function ownedSpan(content: string): { start: number; end: number } | null {
  const m = START_RE.exec(content);
  if (!m || m.index === -1) return null;
  const start = m.index;
  const endIdx = content.indexOf(MARKER_END, start);
  if (endIdx === -1) return null;
  return { start, end: endIdx + MARKER_END.length };
}

export function injectBlock(content: string, version: string, block: string): InjectResult {
  const nl = detectEol(content);
  const body = block.replace(/\r\n/g, '\n');
  const fresh = `${markerStart(version)}\n${body}\n${MARKER_END}`.split('\n').join(nl);
  const span = ownedSpan(content);
  if (!span) {
    const sep = content.length === 0 ? '' : content.endsWith('\n') ? '' : nl;
    return { content: content + sep + fresh + nl, action: 'created' };
  }
  // Legacy LF block/terminator in a CRLF file: heal the line breaks touching the block too.
  let before = content.slice(0, span.start);
  let after = content.slice(span.end);
  if (nl === '\r\n') {
    if (before.endsWith('\n') && !before.endsWith('\r\n')) before = `${before.slice(0, -1)}\r\n`;
    if (after.startsWith('\n')) after = `\r${after}`;
  }
  const next = before + fresh + after;
  return next === content ? { content, action: 'unchanged' } : { content: next, action: 'replaced' };
}

export function stripOwned(content: string): { content: string; removed: boolean } {
  const span = ownedSpan(content);
  if (!span) return { content, removed: false };
  const before = content.slice(0, span.start);
  let after = content.slice(span.end);
  if (before.endsWith('\n')) {
    if (after.startsWith('\r\n')) after = after.slice(2);
    else if (after.startsWith('\n')) after = after.slice(1);
  }
  return { content: before + after, removed: true };
}
