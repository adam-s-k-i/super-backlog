// src/models/render.ts
import { claudeModel } from './config.js';
import { TIERS } from './defaults.js';
import type { RouterConfig } from './types.js';

/** "Wrap at 80 columns": no rendered line is longer than 79 characters. */
const MAX_LINE = 79;

const DEFAULT_OPENCODE_ITEM = [
  "- OpenCode: set the tier's model on the subagent, e.g. the `model` field of",
  '  an agent in `.opencode/agents/`.',
].join('\n');

const OTHER_ITEM = '- Other harnesses: the equivalent per-subagent model setting.';

/** The block's example paragraph before router v2; rendered without a config or while disabled. */
export const DEFAULT_MODEL_EXAMPLES = [
  'Examples (current as of this super-backlog release):',
  '',
  "- Claude Code: the Agent tool's `model` parameter — light `haiku`, standard",
  '  `sonnet`, strong `opus`, top = the strongest available model (e.g. Fable).',
  DEFAULT_OPENCODE_ITEM,
  OTHER_ITEM,
].join('\n');

const CONFIGURED_HEADER = [
  'Examples (from `.super-backlog/models.json`; change them with',
  '`sbl models set <harness> <tier> <model>`):',
].join('\n');

/** Greedy word wrap into a Markdown list item; words (and so model ids) are never split. */
export function wrapListItem(text: string): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = `- ${words[0]}`;
  for (const word of words.slice(1)) {
    if (line.length + 1 + word.length <= MAX_LINE) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = `  ${word}`;
    }
  }
  lines.push(line);
  return lines.join('\n');
}

export function renderModelExamples(cfg: RouterConfig): string {
  if (!cfg.enabled) return DEFAULT_MODEL_EXAMPLES;
  const claude = TIERS.map((t) => `${t} \`${claudeModel(cfg, t)}\``).join(', ');
  const items = [wrapListItem(`Claude Code: the Agent tool's \`model\` parameter — ${claude}.`)];
  const opencode = cfg.tiers.opencode ?? {};
  const set = TIERS.filter((t) => opencode[t] !== undefined);
  if (set.length === 0) {
    items.push(DEFAULT_OPENCODE_ITEM);
  } else {
    const list = set.map((t) => `${t} \`${opencode[t]}\``).join(', ');
    const tail = set.length < TIERS.length ? '; tiers without a model use the session model.' : '.';
    items.push(wrapListItem(`OpenCode: the \`sbl-<tier>\` agents in \`.opencode/agents/\` — ${list}${tail}`));
  }
  items.push(OTHER_ITEM);
  return [CONFIGURED_HEADER, '', ...items].join('\n');
}
