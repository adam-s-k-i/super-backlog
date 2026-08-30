import DefaultTheme from 'vitepress/theme';
import './custom.css';
import { h } from 'vue';

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'nav-bar-title-after': () =>
        h('span', { class: 'brand-title', 'aria-hidden': 'true' }, [
          h('b', 'super'),
          'backlog',
        ]),
    }),
};
