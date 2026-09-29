module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  clearMocks: true,

  coverageProvider: 'v8',
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'cobertura', 'lcovonly'],
};