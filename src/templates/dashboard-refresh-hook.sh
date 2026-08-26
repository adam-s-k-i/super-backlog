# >>> super-backlog dashboard-refresh {{VERSION}} >>>
# Regenerates dashboard.html when the just-created commit touched backlog/.
# Post-commit only: this block NEVER blocks a commit - any failure is just a
# stderr note and the exit status stays 0.
root=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -n "$root" ] && [ -f "$root/node_modules/super-backlog/dist/dashboard/regen.js" ]; then
  touch_backlog=0
  if ! git rev-parse --verify --quiet HEAD~1 >/dev/null 2>&1; then
    touch_backlog=1 # initial commit: nothing to diff against - regenerate
  elif [ -n "$(git diff --name-only HEAD~1 HEAD -- 'backlog/*' 2>/dev/null)" ]; then
    touch_backlog=1
  fi
  if [ "$touch_backlog" -eq 1 ]; then
    node "$root/node_modules/super-backlog/dist/dashboard/regen.js" >/dev/null 2>&1 || echo "super-backlog: dashboard regeneration failed (see npm run dashboard)" >&2
  fi
fi
exit 0
# <<< super-backlog dashboard-refresh <<<
