import { OwnershipError } from './ownership.js';

export const PLUGIN_SPEC = 'superpowers@git+https://github.com/obra/superpowers.git';

export function applyPluginEntry(config: unknown): {
  config: Record<string, unknown>;
  changed: boolean;
} {
  const base: Record<string, unknown> =
    config && typeof config === 'object' && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>) }
      : {};

  const raw = base.plugin;
  const list: unknown[] = Array.isArray(raw) ? [...raw] : raw === undefined ? [] : [raw];

  if (list.includes(PLUGIN_SPEC)) return { config: base, changed: false };

  const suspicious = list.find(
    (e) => typeof e === 'string' && e.startsWith('superpowers@'),
  );
  if (suspicious !== undefined) {
    throw new OwnershipError(
      `refusing to modify existing superpowers plugin entry "${String(suspicious)}" — resolve manually, then re-run`,
    );
  }

  list.push(PLUGIN_SPEC);
  return { config: { ...base, plugin: list }, changed: true };
}
