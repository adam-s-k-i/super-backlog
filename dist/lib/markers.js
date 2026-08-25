// src/lib/markers.ts
const START_RE = /<!--\s*SUPER-BACKLOG:(\d+\.\d+\.\d+)\s*START\s*-->/;
export function markerStart(version) {
    return `<!-- SUPER-BACKLOG:${version} START -->`;
}
export const MARKER_END = '<!-- SUPER-BACKLOG END -->';
function ownedSpan(content) {
    const m = START_RE.exec(content);
    if (!m || m.index === -1)
        return null;
    const start = m.index;
    const endIdx = content.indexOf(MARKER_END, start);
    if (endIdx === -1)
        return null;
    return { start, end: endIdx + MARKER_END.length };
}
export function injectBlock(content, version, block) {
    const fresh = `${markerStart(version)}\n${block}\n${MARKER_END}`;
    const span = ownedSpan(content);
    if (!span) {
        const sep = content.length === 0 ? '' : content.endsWith('\n') ? '' : '\n';
        return { content: content + sep + fresh + '\n', action: 'created' };
    }
    const existing = content.slice(span.start, span.end);
    if (existing === fresh)
        return { content, action: 'unchanged' };
    return {
        content: content.slice(0, span.start) + fresh + content.slice(span.end),
        action: 'replaced',
    };
}
export function stripOwned(content) {
    const span = ownedSpan(content);
    if (!span)
        return { content, removed: false };
    const before = content.slice(0, span.start);
    let after = content.slice(span.end);
    if (before.endsWith('\n') && after.startsWith('\n'))
        after = after.slice(1);
    return { content: before + after, removed: true };
}
