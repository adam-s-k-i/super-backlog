import { defineConfig } from 'vitepress';

export default defineConfig({
  base: '/super-backlog/',
  srcExclude: ['**/superpowers/**'],
  lang: 'en-US',
  title: 'super-backlog',
  description: 'One command to equip any project with Backlog.md + Superpowers',
  themeConfig: {
    siteTitle: 'super-backlog',
    nav: [
      { text: 'Quick start', link: '/guide/quickstart' },
      { text: 'Guide', link: '/guide/architecture' },
      // dashboard.html is a public static file outside the route map - open
      // outside the SPA router or the click lands on the router's 404 page
      { text: 'Dashboard', link: '/dashboard.html', target: '_blank', rel: 'noreferrer' },
      { text: 'GitHub', link: 'https://github.com/adam-s-k-i/super-backlog' }
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Quick start', link: '/guide/quickstart' },
          { text: 'Architecture', link: '/guide/architecture' },
          { text: 'Harness support', link: '/guide/harness-support' },
          { text: 'Guard hook', link: '/guide/guard' },
          { text: 'Operations', link: '/guide/operations' },
          { text: 'Publishing', link: '/guide/publishing' },
          { text: 'Troubleshooting', link: '/guide/troubleshooting' }
        ]
      }
    ]
  }
});
