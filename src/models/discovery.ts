import { runCapture } from '../lib/run.js';
import type { FamilyTiers } from './types.js';

export interface ResolvedTiers {
  discoveredAt: string;
  workhorse: string;
  budget: string;
}

export function parseOpenCodeModels(output: string): string[] {
  return output
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.includes('/'));
}

function scoreForTier(modelId: string, tier: 'workhorse' | 'budget'): number {
  const lower = modelId.toLowerCase();
  // Prefer flagship-ish names for workhorse, avoid 'nano/lite' for workhorse
  if (tier === 'workhorse') {
    if (lower.includes('opus')) return 100;
    if (lower.includes('sonnet')) return 90;
    if (lower.includes('k2.7-code') || lower.includes('k2.6-code')) return 85;
    if (lower.includes('gpt-5.1') || lower.includes('gpt-5.2') || lower.includes('k3')) return 80;
    if (lower.includes('gemini-3.1') || lower.includes('gemini-3.5') || lower.includes('gemini-3.6')) return 70;
    if (lower.includes('k2.7') || lower.includes('k2.6')) return 60;
    if (lower.includes('grok-4.6')) return 55;
    if (lower.includes('grok-4.5')) return 50;
    return 10;
  }
  // Budget tier: prefer nano/lite/flash names
  if (lower.includes('nano') || lower.includes('lite')) return 100;
  if (lower.includes('flash')) return 90;
  if (lower.includes('haiku')) return 85;
  if (lower.includes('k2.5')) return 80;
  if (lower.includes('grok-4.3')) return 70;
  return 10;
}

export function rankTiers(available: string[]): Pick<FamilyTiers, 'workhorse' | 'budget'> {
  const workhorse = [...available].sort((a, b) => scoreForTier(b, 'workhorse') - scoreForTier(a, 'workhorse'))[0] || '';
  const budget = [...available].sort((a, b) => scoreForTier(b, 'budget') - scoreForTier(a, 'budget'))[0] || '';
  return { workhorse, budget };
}

export async function discoverModels(cwd: string): Promise<ResolvedTiers | null> {
  try {
    const result = runCapture('opencode', ['models'], cwd);
    if (result.status !== 0) return null;
    const available = parseOpenCodeModels(result.stdout);
    if (available.length === 0) return null;
    const ranked = rankTiers(available);
    return {
      discoveredAt: new Date().toISOString(),
      workhorse: ranked.workhorse,
      budget: ranked.budget,
    };
  } catch {
    return null;
  }
}
