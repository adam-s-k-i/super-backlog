// src/dashboard/layering.ts

export interface DepEdge {
  from: string;
  to: string;
}

/**
 * Layer tasks for the dependency graph: depth = 1 + max(depth of prerequisites).
 *
 * Deterministic by construction:
 * - input node order drives every traversal and is preserved as Map key order;
 * - edges referencing unknown nodes are ignored;
 * - when no node is ready, the remaining cycle members are detected and appended,
 *   as one group, to the deepest safe layer; their downstream dependents then
 *   continue normally.
 */
export function assignLayers(nodes: readonly string[], deps: readonly DepEdge[]): Map<string, number> {
  const nodeSet = new Set(nodes);
  const prereqs = new Map<string, string[]>();
  for (const n of nodes) prereqs.set(n, []);
  for (const d of deps) {
    if (!nodeSet.has(d.from) || !nodeSet.has(d.to)) continue; // dangling ref
    const list = prereqs.get(d.from);
    if (list && !list.includes(d.to)) list.push(d.to);
  }

  const layers = new Map<string, number>();
  const remaining = new Set(nodes);
  let current = 0;

  while (remaining.size > 0) {
    const ready = nodes.filter(
      (n) => remaining.has(n) && prereqs.get(n)?.every((p) => !remaining.has(p)),
    );
    if (ready.length === 0) {
      // Stalled: every remaining node sits behind a cycle. Append exactly the
      // self-reachable members to the next layer; the rest resume peeling.
      const cyclic = cycleMembers(nodes, prereqs, remaining);
      current += 1;
      for (const n of nodes) {
        if (cyclic.has(n)) {
          layers.set(n, current);
          remaining.delete(n);
        }
      }
      if (cyclic.size === 0) break; // unreachable safety net
      continue;
    }
    current += 1;
    for (const n of ready) {
      layers.set(n, current);
      remaining.delete(n);
    }
  }
  if (remaining.size > 0) {
    // Only reachable via the safety net; park leftovers on the deepest layer.
    for (const n of nodes) {
      if (remaining.has(n)) layers.set(n, Math.max(current, 1));
    }
  }

  const out = new Map<string, number>();
  for (const n of nodes) out.set(n, layers.get(n) ?? 1);
  return out;
}

/** Nodes that can reach themselves using only edges inside `remaining`. */
function cycleMembers(
  nodes: readonly string[],
  prereqs: Map<string, readonly string[]>,
  remaining: Set<string>,
): Set<string> {
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    if (!remaining.has(n)) continue;
    adj.set(n, (prereqs.get(n) ?? []).filter((p) => remaining.has(p)));
  }
  const cyclic = new Set<string>();
  for (const start of nodes) {
    if (!remaining.has(start) || cyclic.has(start)) continue;
    const seen = new Set<string>();
    const stack = [...(adj.get(start) ?? [])];
    let found = false;
    while (stack.length > 0 && !found) {
      const cur = stack.pop();
      if (cur === undefined) break;
      if (cur === start) {
        found = true;
        break;
      }
      if (seen.has(cur)) continue;
      seen.add(cur);
      stack.push(...(adj.get(cur) ?? []));
    }
    if (found) cyclic.add(start);
  }
  return cyclic;
}
