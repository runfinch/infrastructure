module.exports = {
  testEnvironment: 'node',
  roots: [
    '<rootDir>/integration_test',
  ],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  }
};