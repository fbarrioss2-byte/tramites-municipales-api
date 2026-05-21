module.exports = {
  env: { node: true, es2021: true, jest: true },
  extends: ['eslint:recommended'],
  plugins: ['jest'],
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console':     'warn',
    'no-undef':       'error',
  },
};
