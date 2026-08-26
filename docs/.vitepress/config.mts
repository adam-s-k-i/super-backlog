import { defineConfig } from 'vitepress';

export default defineConfig({
  srcExclude: ['**/superpowers/**'],
  description: 'One command to equip any project with Backlog.md + Superpowers',
  themeConfig: {
    siteTitle: 'super-backlog',
    nav: [
      { text: 'Guide', link: '/guide/architecture' },
      { text: 'Dashboard', link: '/dashboard.html' },
      { text: 'GitHub', link: 'https://github.com/adam-s-k-i/super-backlog' }
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
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
