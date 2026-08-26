export function detectFamily(modelId: string): string | null {
  const lower = modelId.toLowerCase();
  if (lower.includes('kimi')) return 'kimi';
  if (lower.includes('grok')) return 'grok';
  if (lower.includes('claude')) return 'claude';
  if (lower.includes('gemini')) return 'gemini';
  if (lower.includes('gpt')) return 'gpt';
  return null;
}
