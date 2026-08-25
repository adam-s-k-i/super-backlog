export class OwnershipError extends Error {}

export const FINGERPRINT_RE =
  /<!--\s*managed-by:\s*super-backlog\s*v?\d+\.\d+\.\d+\s*-->/;

export function renderSkill(templateContent: string, version: string): string {
  const line = `<!-- managed-by: super-backlog ${version} -->`;
  if (/^---\r?\n/.test(templateContent)) {
    const close = templateContent.indexOf('\n---', 3);
    const insertAt = templateContent.indexOf('\n', close + 1) + 1;
    return (
      templateContent.slice(0, insertAt) + `\n${line}` + templateContent.slice(insertAt)
    );
  }
  return `${line}\n${templateContent}`;
}

export function isOwnedSkillFile(content: string): boolean {
  return FINGERPRINT_RE.test(content);
}
