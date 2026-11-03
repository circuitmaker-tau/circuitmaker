/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The site is served from https://circuitmaker-tau.github.io/circuitmaker/
// so every asset path must start with /circuitmaker/.
export default defineConfig({
  base: '/circuitmaker/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
