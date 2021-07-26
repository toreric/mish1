// eslint-disable-next-line no-undef
module.exports = function (api) {
  api.cache(true);

  const presets = [];
  const plugins = [
    "@babel/plugin-proposal-private-methods", {
      "loose": true 
    }
  ];

  return {
    presets,
    plugins
  };
} // This was added for upgrades / Tore E. 2021-07-24
