module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  clearMocks: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'cobertura', 'lcovonly']
};
