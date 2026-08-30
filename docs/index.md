---
layout: page
type: explanation
sidebar: false
---

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  if (window.__sblLandingWired) return
  window.__sblLandingWired = true

  /* smooth in-page scrolling for the hero anchor buttons
     (bypasses the VP router, which swallows plain hash links) */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const el = document.getElementById(a.getAttribute('href').slice(1))
      if (!el) return
      e.preventDefault()
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
      history.replaceState(null, '', a.getAttribute('href'))
    })
  })

  /* whole command card opens the details modal; copy stays its own action */
  document.querySelectorAll('.sbl-cmd').forEach((card) => {
    card.setAttribute('role', 'button')
    card.setAttribute('tabindex', '0')
    const open = () => card.querySelector('[data-details]')?.click()
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-copy],[data-details],a')) return
      open()
    })
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        open()
      }
    })
  })

  const DETAILS = {
    init: {
      text: 'Plans and applies a change set: installs backlog.md as a devDependency, injects the workflow block into AGENTS.md, copies the glue skills, wires npm scripts, and (with --guard) installs the pre-commit hook. Pick the package manager with --pm, target harnesses with --harness, and preview everything first with --dry-run.',
      cmds: [
        ['sbl init', 'defaults for both harnesses'],
        ['sbl init --pm npm --guard', 'pin package manager + integrity hook'],
        ['sbl init --dry-run', 'preview the exact change set'],
        ['sbl init --pm npm --guard --dry-run', 'combine: pm + guard + preview'],
      ],
    },
    dashboard: {
      text: 'Starts a local hub that renders a live cockpit from your backlog data: status KPIs, milestone bars beside the status donut, phase pipeline with live counts, drafts, a sortable tasks table with page sizes, activity heatmap, and decisions & docs.',
      cmds: [
        ['sbl dashboard', 'port 6428, opens the browser'],
        ['sbl dashboard --port 8080 --no-open', 'custom port, headless'],
      ],
    },
    phase: {
      text: 'Every task carries its pipeline phase as a label. The CLI validates every transition — no typos, no double labels, no skipped gates — and the dashboard renders the live phase.',
      cmds: [
        ['sbl phase TASK-1', 'show the current phase'],
        ['sbl phase TASK-1 plan', 'advance: spec to plan'],
        ['sbl phase TASK-1 done', 'clear the label at archival'],
      ],
    },
    doctor: {
      text: 'One [ok]/[warn]/[skip]/[fail] line per check: Node version, PowerShell execution policy (Windows), backlog CLI resolvability, and phase-label hygiene across all tasks — with concrete fix hints for anything off.',
      cmds: [['sbl doctor', 'full environment report']],
    },
    update: {
      text: 'Self-updates a globally installed CLI to the latest npm version (opt out with --no-self), then refreshes every kit-managed file in the project and prints harness/plugin versions.',
      cmds: [
        ['sbl update', 'self-update + refresh'],
        ['sbl update --no-self', 'refresh only'],
      ],
    },
    models: {
      text: 'The optional model router sends simple agents to cheaper tiers and keeps your main model for complex work. Installed with sbl init --models; configured per project under .super-backlog/models.json.',
      cmds: [
        ['sbl models enable', 'turn routing on'],
        ['sbl models show', 'inspect current config'],
        ['sbl models discover', 'rank available models into tiers'],
      ],
    },
    uninstall: {
      text: 'Removes only provably owned artifacts, reports every decision (removed / kept / skipped), and keeps your backlog/ task data unless you ask otherwise.',
      cmds: [
        ['sbl uninstall', 'kit files out, data stays'],
        ['sbl uninstall --with-backlog', 'also remove task data — permanent'],
      ],
    },
  }

  function flash(btn) {
    const orig = btn.textContent
    btn.textContent = 'copied ✓'
    btn.classList.add('done')
    setTimeout(() => {
      btn.textContent = orig
      btn.classList.remove('done')
    }, 1100)
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy]')
    if (!btn) return
    navigator.clipboard?.writeText(btn.dataset.copy || '').catch(() => {})
    flash(btn)
  })

  const dlg = document.getElementById('sbl-cmd-dialog')
  document.querySelectorAll('.sbl-cmd [data-details]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = DETAILS[btn.dataset.details]
      if (!d || !dlg) return
      dlg.querySelector('#sbl-dlg-name').textContent =
        btn.closest('.sbl-cmd').querySelector('.cmd-name').textContent
      let html = `<p>${d.text}</p>`
      if (d.cmds.length > 1) html += '<h5>Commands</h5>'
      d.cmds.forEach(([cmd, note]) => {
        html += `<div class="t-cmd"><code>${cmd}</code><button class="copy" data-copy="${cmd}">copy</button><span class="note">${note}</span></div>`
      })
      dlg.querySelector('#sbl-dlg-body').innerHTML = html
      dlg.showModal()
    })
  })

  const chip = document.getElementById('sbl-ver-chip')
  if (chip) {
    chip.addEventListener('click', () => {
      navigator.clipboard?.writeText('npm i -g super-backlog').catch(() => {})
      flash(chip)
    })
    fetch('https://registry.npmjs.org/super-backlog/latest')
      .then((r) => r.json())
      .then((j) => {
        if (j.version) chip.textContent = 'v' + j.version
      })
      .catch(() => {})
  }
})
</script>

<div class="sbl-land">

<div class="sbl-top">
  <img class="hero-logo" src="./assets/super-backlog-logo.jpg" alt="super-backlog logo">
  <div class="kicker">Agent workflow, wired</div>
  <h1>Supercharge your backlog. <em>Watch it live.</em></h1>
  <p class="tagline">super-backlog installs, maintains, and visualizes a structured agent workflow in any project — with pipeline phases, human gates, and a live dashboard.</p>
  <div class="hero-actions">
    <a class="btn primary" href="#start">Start in 3 steps</a>
    <a class="btn" href="#commands">Browse commands</a>
    <a class="btn" href="https://github.com/adam-s-k-i/super-backlog" target="_blank" rel="noreferrer">GitHub</a>
  </div>
</div>

<section>
  <div class="sec-head">
    <span class="sec-num">01</span>
    <h2>sbl Commands</h2>
    <span class="tagline">click Details for the full picture</span>
  </div>
  <p class="sec-sub">Every command is one click from your clipboard. Click <b>Details</b> for flags, variants, and the full picture.</p>

  <div class="cmd-grid">
    <div class="sbl-cmd cmd-card">
      <div class="cmd-line-row"><span class="cmd-name">sbl init</span><button class="copy" data-copy="sbl init">copy</button></div>
      <div class="cmd-short">Wire Backlog.md, Superpowers skills, npm scripts, and hooks into the current project.</div>
      <div class="cmd-foot">
        <button class="details-btn" data-details="init">Details</button>
      </div>
    </div>

  <div class="sbl-cmd cmd-card">
      <div class="cmd-line-row"><span class="cmd-name">sbl dashboard</span><button class="copy" data-copy="sbl dashboard">copy</button></div>
      <div class="cmd-short">Live Project Dashboard on port 6428 — reloads connected tabs automatically. Alias: sbl db.</div>
      <div class="cmd-foot">
        <button class="details-btn" data-details="dashboard">Details</button>
      </div>
    </div>

  <div class="sbl-cmd cmd-card">
      <div class="cmd-line-row"><span class="cmd-name">sbl phase</span><button class="copy" data-copy="sbl phase TASK-1">copy</button></div>
      <div class="cmd-short">Show or advance a task's pipeline phase: spec → plan → impl → verify, done clears it.</div>
      <div class="cmd-foot">
        <button class="details-btn" data-details="phase">Details</button>
      </div>
    </div>

  <div class="sbl-cmd cmd-card">
      <div class="cmd-line-row"><span class="cmd-name">sbl doctor</span><button class="copy" data-copy="sbl doctor">copy</button></div>
      <div class="cmd-short">Check Node, PowerShell policy, the backlog CLI, and phase-label hygiene.</div>
      <div class="cmd-foot">
        <button class="details-btn" data-details="doctor">Details</button>
      </div>
    </div>

  <div class="sbl-cmd cmd-card">
      <div class="cmd-line-row"><span class="cmd-name">sbl update</span><button class="copy" data-copy="sbl update">copy</button></div>
      <div class="cmd-short">Self-update the CLI to the latest npm version, then refresh every injected file.</div>
      <div class="cmd-foot">
        <button class="details-btn" data-details="update">Details</button>
      </div>
    </div>

  <div class="sbl-cmd cmd-card">
      <div class="cmd-line-row"><span class="cmd-name">sbl models</span><button class="copy" data-copy="sbl models show">copy</button></div>
      <div class="cmd-short">Optional model router: cheap tiers for simple agents, your main model for hard work.</div>
      <div class="cmd-foot">
        <button class="details-btn" data-details="models">Details</button>
      </div>
    </div>

  <div class="sbl-cmd cmd-card">
      <div class="cmd-line-row"><span class="cmd-name">sbl uninstall</span><button class="copy" data-copy="sbl uninstall">copy</button></div>
      <div class="cmd-short">Remove everything super-backlog owns — your backlog/ task data stays.</div>
      <div class="cmd-foot">
        <button class="details-btn" data-details="uninstall">Details</button>
      </div>
    </div>
  </div>
</section>

<section id="start">
  <div class="sec-head">
    <span class="sec-num">02</span>
    <h2>Start in three steps</h2>
    <span class="tagline">install → wire → watch</span>
  </div>

  <div class="steps-frame">
    <div class="steps-title">
      <h3>From zero to a live dashboard</h3>
      <span class="flag">~2 minutes</span>
    </div>
    <div class="steps">
      <div class="step-row">
        <span class="step-num">1</span>
        <div class="step-body">
          <div class="step-cap">Install <span>macOS / Linux · PowerShell below</span></div>
          <div class="step-cmd"><span class="prompt">$</span><code>curl -fsSL https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/install.sh | bash</code><button class="copy" data-copy="curl -fsSL https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/install.sh | bash">copy</button></div>
          <div class="os-note"><b>Windows (PowerShell):</b> <code class="mono">irm https://raw.githubusercontent.com/adam-s-k-i/super-backlog/master/scripts/install.ps1 | iex</code></div>
        </div>
      </div>
      <div class="step-row">
        <span class="step-num">2</span>
        <div class="step-body">
          <div class="step-cap">Wire your project <span>Backlog.md + skills + scripts + hooks</span></div>
          <div class="step-cmd"><span class="prompt">$</span><code>sbl init</code><button class="copy" data-copy="sbl init">copy</button></div>
        </div>
      </div>
      <div class="step-row">
        <span class="step-num">3</span>
        <div class="step-body">
          <div class="step-cap">Open the live dashboard <span>port 6428, auto-reload</span></div>
          <div class="step-cmd"><span class="prompt">$</span><code>sbl dashboard</code><button class="copy" data-copy="sbl dashboard">copy</button></div>
        </div>
      </div>
    </div>
  </div>

  <p class="sec-sub" style="margin-top:18px">Every command above is one click from your clipboard — no typing, no typos.</p>
</section>

<section id="all">
  <div class="sec-head">
    <span class="sec-num">03</span>
    <h2>All commands at a glance</h2>
    <span class="tagline">copy the whole block</span>
  </div>
  <div class="allcode">
    <button class="copy" data-copy="sbl init
sbl dashboard
sbl phase TASK-1
sbl phase TASK-1 plan
sbl doctor
sbl update
sbl models show
sbl uninstall">copy</button>
    <pre><b>sbl init</b>                        wire Backlog.md, skills, scripts, hooks
<b>sbl init --models</b>               + optional model router
<b>sbl dashboard</b>                   live Project Dashboard (alias: sbl db)
<b>sbl phase TASK-1</b>                show a task's pipeline phase
<b>sbl phase TASK-1 plan</b>           advance phase (spec|plan|impl|verify|done)
<b>sbl doctor</b>                      environment + phase-label hygiene
<b>sbl update</b>                      self-update + refresh injected files
<b>sbl models enable</b>               turn the model router on
<b>sbl models discover</b>             discover and rank available models
<b>sbl uninstall</b>                   remove kit files, keep backlog/ data</pre>
  </div>
</section>

<section id="hosted">
  <div class="sec-head">
    <span class="sec-num">04</span>
    <h2>About the hosted dashboard</h2>
    <span class="tagline">the Pages link is a static preview</span>
  </div>
  <div class="hosted">
    <div class="hosted-card">
      <h3>The Backlog button needs a local hub</h3>
      <p>On this hosted preview the <b>Backlog</b> button cannot open your board — it needs the <code>sbl dashboard</code> server running in your project. Locally it works with one click: clicking the button there opens the full Backlog.md UI in an overlay.</p>
    </div>
    <div class="hosted-card">
      <h3>Try the real thing</h3>
      <p>Run <code>sbl dashboard</code> in any wired project and open <code>http://localhost:6428</code> — same cockpit, live data, working buttons.</p>
      <div class="mock-btns">
        <span class="mock-cmd"><code>sbl dashboard</code></span>
        <button class="copy" data-copy="sbl dashboard">copy</button>
      </div>
    </div>
  </div>
</section>

</div>

<dialog id="sbl-cmd-dialog">
  <div class="dlg-head">
    <span class="cmd-name" id="sbl-dlg-name">sbl</span>
    <button class="dlg-close" onclick="document.getElementById('sbl-cmd-dialog').close()">×</button>
  </div>
  <div class="dlg-body" id="sbl-dlg-body"></div>
</dialog>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

.sbl-land { max-width: 1080px; margin: 0 auto; padding: 0 24px 120px; }
.sbl-land, .sbl-land * { box-sizing: border-box; }

.sbl-top { padding: 40px 0 8px; }
.hero-logo {
  display: block; width: 100%; height: auto;
  border-radius: 20px; margin-bottom: 26px;
  border: 1px solid var(--vp-c-border); box-shadow: 0 18px 50px rgba(0,0,0,.25);
}
.kicker { font: 600 .68rem var(--vp-font-family-mono, monospace); letter-spacing: 2px; color: var(--vp-c-text-3); text-transform: uppercase; }
.sbl-top h1 {
  font-size: clamp(2rem, 5vw, 3.1rem); font-weight: 800; letter-spacing: -1px;
  margin: 10px 0 12px; line-height: 1.08; border: none; padding: 0; background: none;
}
.sbl-top h1 em { font-style: normal; color: var(--vp-c-brand-1); }
.tagline { color: var(--vp-c-text-2); font-size: 1.05rem; max-width: 62ch; }
.hero-actions { display: flex; gap: 12px; margin-top: 26px; flex-wrap: wrap; }
.btn {
  display: inline-flex; align-items: center; gap: 8px; text-decoration: none; cursor: pointer;
  font: 600 .86rem var(--vp-font-family-base, sans-serif); border-radius: 10px; padding: 10px 20px;
  border: 1px solid var(--vp-c-border); color: var(--vp-c-text-1); background: var(--vp-c-bg-elv);
  transition: transform 160ms cubic-bezier(0.23,1,0.32,1), border-color 160ms cubic-bezier(0.23,1,0.32,1);
}
.btn:hover { border-color: var(--vp-c-brand-1); transform: translateY(-1px); }
.btn:active { transform: scale(0.97); }
.btn.primary { background: var(--vp-c-brand-soft); border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }

section { margin-top: 64px; }
.sec-head {
  display: flex; align-items: baseline; gap: 16px;
  border-bottom: 1px solid var(--vp-c-divider); padding-bottom: 10px; margin-bottom: 22px;
}
.sec-num {
  font-family: var(--vp-font-family-mono, monospace); font-size: 2rem; font-weight: 700;
  background: linear-gradient(180deg, var(--vp-c-brand-1), transparent 130%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sec-head h2 { font-size: 1.15rem; letter-spacing: .5px; font-weight: 700; margin: 0; border: none; padding: 0; background: none; }
.sec-head .tagline { color: var(--vp-c-text-3); font-size: .82rem; margin-left: auto; text-align: right; }
.sec-sub { color: var(--vp-c-text-2); font-size: .9rem; margin: 0 0 18px; max-width: 74ch; }

.cmd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 12px; }
.cmd-card {
  position: relative; cursor: pointer;
  background: var(--vp-c-bg-elv); border: 1px solid var(--vp-c-divider); border-radius: 12px;
  padding: 14px 16px 12px;
  transition: transform 160ms cubic-bezier(0.23,1,0.32,1), border-color 160ms cubic-bezier(0.23,1,0.32,1);
}
.cmd-card:hover { transform: translateY(-1px); border-color: var(--vp-c-brand-1); }
.cmd-card:active { transform: scale(0.99); }
.cmd-card:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
.cmd-line-row { display: flex; align-items: center; gap: 8px; }
.cmd-name { font: 700 .86rem var(--vp-font-family-mono, monospace); color: var(--vp-c-brand-1); }
.copy {
  margin-left: auto; border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-3); border-radius: 7px; padding: 4px 9px; cursor: pointer;
  font: 600 .6rem var(--vp-font-family-mono, monospace); letter-spacing: .5px; text-transform: uppercase;
  transition: transform 140ms ease-out, border-color 140ms ease-out, color 140ms ease-out;
}
.copy:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-text-1); }
.copy:active { transform: scale(0.94); }
.copy.done { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.cmd-short { color: var(--vp-c-text-2); font-size: .8rem; margin-top: 7px; min-height: 2.2em; }
.cmd-foot { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.details-btn {
  border: none; background: none; color: var(--vp-c-brand-1); cursor: pointer;
  font: 600 .72rem var(--vp-font-family-base, sans-serif); padding: 3px 6px; border-radius: 6px;
  transition: background 140ms ease-out;
}
.details-btn:hover { background: var(--vp-c-brand-soft); }
.t-cmd {
  display: flex; align-items: center; gap: 8px;
  background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider); border-radius: 7px; padding: 6px 9px;
}
.t-cmd code { font: 500 .7rem var(--vp-font-family-mono, monospace); color: var(--vp-c-text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t-cmd .copy { flex: none; }
.t-cmd .note { font-size: .68rem; color: var(--vp-c-text-3); white-space: nowrap; }

.steps-frame {
  border: 2px solid var(--vp-c-brand-1); border-radius: 16px;
  background: var(--vp-c-brand-soft);
  padding: 26px clamp(18px, 4vw, 38px) 30px;
}
.steps-title { display: flex; align-items: baseline; gap: 12px; margin-bottom: 22px; }
.steps-title h3 { margin: 0; font-size: 1.05rem; font-weight: 700; }
.steps-title .flag { font: 600 .62rem var(--vp-font-family-mono, monospace); letter-spacing: 1.4px; color: var(--vp-c-brand-1);
  text-transform: uppercase; border: 1px solid var(--vp-c-brand-1); border-radius: 999px; padding: 2px 10px; }
.steps { position: relative; }
.steps::before {
  content: ""; position: absolute; left: 21px; top: 24px; bottom: 24px; width: 2px;
  background: var(--vp-c-border);
}
.step-row { position: relative; display: flex; align-items: flex-start; gap: 16px; padding: 12px 0; }
.step-num {
  position: relative; z-index: 1; flex: none; width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--vp-c-bg-elv); border: 2px solid var(--vp-c-brand-1);
  color: var(--vp-c-brand-1); font: 700 .95rem var(--vp-font-family-mono, monospace);
}
.step-body { flex: 1; min-width: 0; }
.step-cap { font-weight: 700; font-size: .95rem; margin-bottom: 3px; }
.step-cap span { color: var(--vp-c-text-3); font-weight: 500; font-size: .8rem; margin-left: 8px; }
.step-cmd {
  display: flex; align-items: center; gap: 10px; margin-top: 6px;
  background: var(--vp-c-bg-elv); border: 1px solid var(--vp-c-divider); border-radius: 10px; padding: 10px 14px;
  transition: border-color 160ms ease-out, transform 160ms ease-out;
}
.step-cmd:hover { border-color: var(--vp-c-brand-1); transform: translateX(2px); }
.step-cmd code { flex: 1; font: 500 .8rem var(--vp-font-family-mono, monospace); color: var(--vp-c-text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.step-cmd .prompt { color: var(--vp-c-text-3); }
.os-note { font-size: .72rem; color: var(--vp-c-text-3); margin-top: 6px; }
.os-note b { color: var(--vp-c-text-2); font-weight: 600; }
.os-note .mono { font-family: var(--vp-font-family-mono, monospace); font-size: .72rem; }

.allcode { position: relative; background: var(--vp-c-bg-elv); border: 1px solid var(--vp-c-divider); border-radius: 12px; }
.allcode pre {
  margin: 0; padding: 20px 22px; overflow-x: auto;
  font: 400 .8rem/1.7 var(--vp-font-family-mono, monospace); color: var(--vp-c-text-2);
}
.allcode pre b { color: var(--vp-c-brand-1); font-weight: 700; }
.allcode .copy { position: absolute; top: 12px; right: 12px; }

.hosted { display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; }
.hosted-card { background: var(--vp-c-bg-elv); border: 1px solid var(--vp-c-divider); border-radius: 12px; padding: 16px 18px; }
.hosted-card h3 { margin: 0 0 6px; font-size: .95rem; border: none; padding: 0; background: none; }
.hosted-card p { margin: 0 0 8px; color: var(--vp-c-text-2); font-size: .8rem; }
.hosted-card code { font-family: var(--vp-font-family-mono, monospace); font-size: .76rem; color: var(--vp-c-brand-1); }
.mock-btns { display: flex; gap: 10px; margin-top: 10px; align-items: center; flex-wrap: wrap; }
.mock-cmd { background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: 6px 11px; }
.mock-cmd code { font: 500 .74rem var(--vp-font-family-mono, monospace); color: var(--vp-c-text-1); }

#sbl-cmd-dialog {
  margin: auto; width: min(560px, 92vw); border: 1px solid var(--vp-c-border); border-radius: 14px;
  background: var(--vp-c-bg-elv); color: var(--vp-c-text-1); box-shadow: 0 24px 80px rgba(0,0,0,.4);
  padding: 0;
}
#sbl-cmd-dialog::backdrop { background: rgba(4,7,12,.55); backdrop-filter: blur(2px); }
#sbl-cmd-dialog .dlg-head {
  position: sticky; top: 0; display: flex; align-items: center; gap: 10px;
  padding: 14px 18px; border-bottom: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-elv);
}
#sbl-cmd-dialog .dlg-head .cmd-name { font-size: .95rem; }
#sbl-cmd-dialog .dlg-close { margin-left: auto; background: none; border: none; color: var(--vp-c-text-3); font-size: 1.3rem; cursor: pointer; line-height: 1; }
#sbl-cmd-dialog .dlg-close:hover { color: var(--vp-c-danger-1, #ff7a7a); }
#sbl-cmd-dialog .dlg-body { padding: 16px 20px 22px; }
#sbl-cmd-dialog .dlg-body p { color: var(--vp-c-text-2); font-size: .84rem; margin: 0 0 10px; }
#sbl-cmd-dialog .dlg-body h5 { margin: 16px 0 6px; font: 600 .66rem var(--vp-font-family-mono, monospace); letter-spacing: 1.2px; color: var(--vp-c-text-3); text-transform: uppercase; }
#sbl-cmd-dialog .t-cmd code { flex: 1; }

@media (max-width: 860px) { .hosted { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) {
  .sbl-land * { transition: none !important; animation: none !important; }
}
</style>
