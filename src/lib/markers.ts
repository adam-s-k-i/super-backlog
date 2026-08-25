// src/lib/markers.ts
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
  const fresh = `${markerStart(version)}\n${block}\n${MARKER_END}`;
  const span = ownedSpan(content);
  if (!span) {
    const sep = content.length === 0 ? '' : content.endsWith('\n') ? '' : '\n';
    return { content: content + sep + fresh + '\n', action: 'created' };
  }
  const existing = content.slice(span.start, span.end);
  if (existing === fresh) return { content, action: 'unchanged' };
  return {
    content: content.slice(0, span.start) + fresh + content.slice(span.end),
    action: 'replaced',
  };
}

export function stripOwned(content: string): { content: string; removed: boolean } {
  const span = ownedSpan(content);
  if (!span) return { content, removed: false };
  let out = content.slice(0, span.start) + content.slice(span.end);
  out = out.replace(/\n{3,}/g, '\n\n'); // collapse gaps left by removal
  return { content: out, removed: true };
}
