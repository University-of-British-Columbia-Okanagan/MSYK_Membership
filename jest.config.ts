import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/app/$1',
    '^@/(.*)$': '<rootDir>/app/$1',
    '^tests/(.*)$': '<rootDir>/tests/$1',
  },
  // Treat TS as ESM
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        isolatedModules: true, // transpile-only path for speed/memory
        diagnostics: false, // skip type-checking during tests
      },
    ],
  },
  // Kill and restart workers that retain too much memory between tests
  workerIdleMemoryLimit: '512MB',
  // Reduce noise, improve perf on Windows
  watchman: false,
  testPathIgnorePatterns: ['/node_modules/', '/build/', '/dist/'],
  modulePathIgnorePatterns: ['/build/', '/dist/'],
};

export default config;
