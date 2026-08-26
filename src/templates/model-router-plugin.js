// src/templates/model-router-plugin.js
module.exports = async () => {
  const { loadConfig } = await import('super-backlog/dist/models/config.js');
  const { resolveTier } = await import('super-backlog/dist/models/resolve.js');

  const TIER_BY_AGENT = {
    'sbl-worker': 'workhorse',
    'sbl-worker-cheap': 'budget',
    'explore': 'budget',
  };

  return {
    'chat.params': async (input, output) => {
      const cfg = loadConfig(input.cwd ?? process.cwd());
      if (!cfg.enabled) return;
      const agent = input.agent?.name;
      const tier = TIER_BY_AGENT[agent];
      if (!tier) return;
      const mainModel = input.model;
      if (!mainModel || typeof mainModel !== 'string') return;
      const target = resolveTier(mainModel, tier, cfg);
      if (!target) return;
      output.params = output.params || {};
      output.params.model = target;
    },
  };
};
