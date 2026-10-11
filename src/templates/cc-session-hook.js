// src/templates/cc-session-hook.js
// Compat shim: router v1 registered this file as a Claude Code SessionStart
// hook. Router v2 writes models into agent files and removes the hook on
// `sbl update`; until then this no-op keeps old projects starting cleanly.
// The next major version removes it.
process.exit(0);
