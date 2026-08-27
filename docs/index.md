---
layout: page
type: explanation
---

<div class="landing">
  <img class="landing-logo" src="./assets/super-backlog-logo.jpg" alt="super-backlog logo" />

  <h1>super-backlog</h1>

  <p class="landing-text">
    Backlog.md + Superpowers, one command
  </p>

  <p class="landing-tagline">
    Install, maintain, and visualize a structured agent workflow in any project.
  </p>

  <p class="landing-actions">
    <a class="landing-btn primary" href="/super-backlog/guide/quickstart">Quick start</a>
    <a class="landing-btn" href="/super-backlog/dashboard.html" target="_blank" rel="noreferrer">Project Dashboard</a>
  </p>

  <div class="landing-features">
    <div class="feature">
      <h3>One-command install</h3>
      <p>Run the one-line installer to wire Backlog.md, Superpowers skills, npm scripts, and the dashboard into your project.</p>
    </div>
    <div class="feature">
      <h3>Model router</h3>
      <p>Add <code>--models</code> to route simple agents to cheaper tiers while keeping your main model for the hard work.</p>
    </div>
    <div class="feature">
      <h3>Live project dashboard</h3>
      <p>A single self-contained HTML file generated from your Backlog data — regenerated on every deploy right here.</p>
    </div>
    <div class="feature">
      <h3>Clean uninstall</h3>
      <p>Ownership-proven removal keeps your task data unless you ask otherwise.</p>
    </div>
  </div>
</div>

<style>
.landing { max-width: 1152px; margin: 0 auto; padding: 40px 24px 64px; text-align: center; }

.landing-logo {
  display: block;
  width: min(800px, 100%);
  height: auto;
  margin: 0 auto 8px;
  border-radius: 24px;
}

/* Hero-equivalent typography (mirrors VitePress home hero) */
.landing h1,
.landing-text {
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.5px;
  font-size: 32px;
}
@media (min-width: 768px) {
  .landing h1, .landing-text { font-size: 44px; }
}
@media (min-width: 960px) {
  .landing h1, .landing-text { font-size: 52px; }
}

.landing h1 {
  margin: 10px 0 6px;
  padding: 0;
  border: none;
  background: none;
  color: var(--vp-c-brand-1);
}

.landing-text {
  margin: 0;
  color: var(--vp-c-text-1);
}

.landing-tagline {
  font-size: 18px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
  max-width: 720px;
  margin: 14px auto 0;
}
@media (min-width: 768px) {
  .landing-tagline { font-size: 20px; }
}
@media (min-width: 960px) {
  .landing-tagline { font-size: 22px; }
}

.landing-actions { margin-top: 30px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.landing-btn { display: inline-block; padding: 9px 22px; border-radius: 8px; font-weight: 600; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-1); transition: border-color 0.15s, background-color 0.15s; }
.landing-btn:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.landing-btn.primary { background: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); color: #fff; }
.landing-btn.primary:hover { background: var(--vp-c-brand-2); color: #fff; }

.landing-features { margin-top: 64px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; text-align: left; }
.feature { padding: 18px 20px; border: 1px solid var(--vp-c-divider); border-radius: 10px; }
.feature h3 { margin: 0 0 8px; font-size: 17px; border: none; padding: 0; }
.feature p { color: var(--vp-c-text-2); margin: 0; font-size: 14.5px; }
</style>
