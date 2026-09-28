import nextConfig from 'eslint-config-next';

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'out/**'],
    // Existing dashboard screens intentionally hydrate state from browser APIs
    // and event subscriptions inside effects.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default eslintConfig;
