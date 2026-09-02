import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/app/$1',
    '^@/(.*)$': '<rootDir>/app/$1',
    '^tests/(.*)$': '<rootDir>/tests/$1',
    // ESM-only package; see the stub for why it is not transformed instead.
    '^lucide-react$': '<rootDir>/tests/setup/lucide-react-stub.js',
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
  // Browser APIs jsdom omits that Radix needs. A no-op under the node environment.
  setupFiles: ['<rootDir>/tests/setup/dom-stubs.ts'],
  // Kill and restart workers that retain too much memory between tests
  workerIdleMemoryLimit: '512MB',
  // Reduce noise, improve perf on Windows
  watchman: false,
  testPathIgnorePatterns: ['/node_modules/', '/build/', '/dist/'],
  modulePathIgnorePatterns: ['/build/', '/dist/'],
};

export default config;
