// Test setup file
// Global test configuration and utilities

import { vi } from 'vitest';

// Mock environment variables
process.env.NODE_ENV = 'test';

// Mock logger
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

// Increase timeout for async operations
vi.setConfig({
  testTimeout: 10000,
});
