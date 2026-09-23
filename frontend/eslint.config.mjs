import nextConfig from 'eslint-config-next';

const eslintConfig = [
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'out/**'],
  },
];

export default eslintConfig;
