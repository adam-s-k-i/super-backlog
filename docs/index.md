---
layout: home

hero:
  name: super-backlog
  text: Backlog.md + Superpowers, one command
  tagline: Install, maintain, and visualize a structured agent workflow in any project.
  image:
    src: /super-backlog-logo.jpg
    alt: super-backlog logo
  actions:
    - theme: brand
      text: Get started
      link: /guide/architecture
    - theme: alt
      text: Project Dashboard
      link: /dashboard.html

features:
  - title: One-command install
    details: npx super-backlog init wires Backlog.md, Superpowers skills, npm scripts, and the dashboard into your project.
  - title: Clean uninstall
    details: Ownership-proven removal keeps your task data unless you ask otherwise.
  - title: Live project dashboard
    details: A single self-contained HTML file generated from your Backlog data — regenerated on every deploy right here.

---

<div class="intro-video">
  <h2>See it in action</h2>
  <video controls preload="metadata" poster="./assets/super-backlog-logo.jpg">
    <source src="./assets/super-backlog-video.mp4" type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

<style>
.intro-video {
  max-width: 1152px;
  margin: 0 auto;
  padding: 24px;
  text-align: center;
}
.intro-video video {
  width: 100%;
  max-width: 896px;
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
}
</style>
