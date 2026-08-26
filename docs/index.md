---
layout: page
---

<div class="landing">
  <img class="landing-logo" src="./assets/super-backlog-logo.jpg" alt="super-backlog logo" width="190" height="190" />

  <h1>super-backlog</h1>

  <p class="landing-tagline">
    Backlog.md + Superpowers, one command — install, maintain, and visualize a
    structured agent workflow in any project.
  </p>

  <p class="landing-actions">
    <a class="landing-btn primary" href="/super-backlog/guide/architecture">Get started</a>
    <a class="landing-btn" href="/super-backlog/dashboard.html">Project Dashboard</a>
  </p>

  <div class="landing-features">
    <div class="feature">
      <h3>One-command install</h3>
      <p>npx super-backlog init wires Backlog.md, Superpowers skills, npm scripts, and the dashboard into your project.</p>
    </div>
    <div class="feature">
      <h3>Clean uninstall</h3>
      <p>Ownership-proven removal keeps your task data unless you ask otherwise.</p>
    </div>
    <div class="feature">
      <h3>Live project dashboard</h3>
      <p>A single self-contained HTML file generated from your Backlog data — regenerated on every deploy right here.</p>
    </div>
  </div>
</div>

<style>
.landing { max-width: 960px; margin: 0 auto; padding: 48px 24px 64px; text-align: center; }
.landing-logo { border-radius: 24px; box-shadow: var(--vp-shadow-2); }
.landing h1 { font-size: 46px; line-height: 1.1; margin: 22px 0 10px; letter-spacing: -0.5px; border: none; padding: 0; }
.landing-tagline { font-size: 20px; color: var(--vp-c-text-2); max-width: 640px; margin: 0 auto; }
.landing-actions { margin-top: 30px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.landing-btn { display: inline-block; padding: 9px 22px; border-radius: 8px; font-weight: 600; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-1); transition: border-color 0.15s, background-color 0.15s; }
.landing-btn:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.landing-btn.primary { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); color: #fff; }
.landing-btn.primary:hover { background: var(--vp-c-brand-2); color: #fff; }
.landing-features { margin-top: 64px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; text-align: left; }
.feature { padding: 18px 20px; border: 1px solid var(--vp-c-divider); border-radius: 10px; }
.feature h3 { margin: 0 0 8px; font-size: 17px; border: none; padding: 0; }
.feature p { color: var(--vp-c-text-2); margin: 0; font-size: 14.5px; }
@media (max-width: 640px) {
  .landing h1 { font-size: 34px; }
}
</style>
