export function findUnexpectedFiles(entries, allowed) {
  const roots = allowed.filter((a) => !a.endsWith('/**'));
  const prefixes = allowed.filter((a) => a.endsWith('/**')).map((p) => p.slice(0, -2));
  return entries
    .map((e) => e.path)
    .filter((p) => !roots.includes(p) && !prefixes.some((pre) => p.startsWith(pre)));
}

if (process.argv[1]?.endsWith('check-pack-list.mjs')) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => {
    raw += d;
  });
  process.stdin.on('end', () => {
    let packs;
    try {
      packs = JSON.parse(raw);
    } catch {
      console.error('check-pack-list: stdin is not valid JSON');
      process.exit(1);
    }
    const entries = Array.isArray(packs) ? packs.flatMap((p) => p.files ?? []) : [];
    const unexpected = findUnexpectedFiles(entries, [
      'README.md',
      'LICENSE',
      'package.json',
      'dist/**'
    ]);
    if (unexpected.length) {
      console.error('Pack contains unexpected files:');
      for (const f of unexpected) console.error(`  - ${f}`);
      process.exit(1);
    }
  });
}
