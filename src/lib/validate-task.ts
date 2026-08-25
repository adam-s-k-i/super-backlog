export function validateTaskMarkdown(filename: string, content: string): string[] {
  const errors: string[] = [];
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!m) return [`backlog/tasks/${filename}: missing YAML frontmatter (edit tasks via the backlog CLI instead)`];
  const fm = m[1];
  const field = (name: string): string | null => {
    const fmMatch = new RegExp(`^${name}:\\s*(.*?)\\s*$`, 'm').exec(fm);
    return fmMatch ? fmMatch[1].replace(/^["']|["']$/g, '') : null;
  };
  const expectedId = filename.replace(/\.md$/, '');
  const id = field('id');
  if (!id) errors.push(`backlog/tasks/${filename}: missing 'id' field`);
  else if (id !== expectedId)
    errors.push(`backlog/tasks/${filename}: id '${id}' does not match filename '${expectedId}'`);
  const title = field('title');
  if (!title) errors.push(`backlog/tasks/${filename}: empty or missing 'title'`);
  return errors;
}
