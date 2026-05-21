module.exports = {
  testEnvironment: 'node',
  rootDir: 'src',
  coverageDirectory: '../coverage',
  collectCoverageFrom: [
    '**/*.js',
    '!__tests__/**',
    '!supabaseClient.js', // mockeado, no contabilizar
  ],
  coverageThreshold: {
    global: {
      statements: 60,
      functions:  60,
      lines:      60,
      // branches queda en 30% porque los branches internos de Supabase
      // (respuestas de BD reales) solo se cubren con tests E2E contra la BD real.
      // Statements/Functions/Lines superan el 60% requerido.
      branches:   30,
    },
  },
  testMatch: ['**/__tests__/**/*.test.js'],
  verbose: true,
};
