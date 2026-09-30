module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'security'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:security/recommended-legacy',
  ],
  env: {
    node: true,
    jest: true,
    es2022: true,
  },
  ignorePatterns: ['dist/', 'coverage/', 'node_modules/'],
};
