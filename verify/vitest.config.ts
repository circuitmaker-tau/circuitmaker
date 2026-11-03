import { defineConfig } from 'vitest/config';

// Separate from the unit tests: these need Icarus Verilog (iverilog, vvp) installed.
export default defineConfig({
  test: {
    include: ['verify/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
