# >>> super-backlog guard {{VERSION}} >>>
# Validates staged backlog/** task files structurally.
# Escape hatch: git commit --no-verify
staged=$(git diff --cached --name-only --diff-filter=ACMR -- 'backlog/*' 2>/dev/null || true)
if [ -n "$staged" ]; then
  staged="$staged" node --input-type=commonjs -e '
    const fs = require("fs");
    const errs = [];
    for (const f of process.env.staged.split("\n").filter(Boolean)) {
      if (!/^backlog\/tasks\/.+\.md$/.test(f)) continue;
      const content = fs.readFileSync(f, "utf8");
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
      if (!fm) { errs.push(`${f}: missing frontmatter (use the backlog CLI)`); continue; }
      const get = (n) => { const m = new RegExp("^" + n + ":\\s*(.*?)\\s*$", "m").exec(fm[1]); return m ? m[1].replace(/^["\x27]|["\x27]$/g, "") : null; };
      const id = get("id"), title = get("title");
      const stem = f.replace(/^backlog\/tasks\//, "").replace(/\.md$/, "");
      const base = stem.includes(" - ") ? stem.split(" - ")[0] : stem;
      if (!id) errs.push(`${f}: missing id`);
      else if (id.toLowerCase() !== base.toLowerCase()) errs.push(`${f}: id ${id} != filename stem ${base}`);
      if (!title) errs.push(`${f}: empty title`);
    }
    if (errs.length) { console.error("super-backlog guard rejected this commit:\n" + errs.map(e => "  - " + e).join("\n") + "\nBypass: git commit --no-verify"); process.exit(1); }
  ' || exit 1
fi
# <<< super-backlog guard <<<
