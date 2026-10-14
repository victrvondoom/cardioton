import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  // Bound heavy renderer/JSDOM workers for ordinary two-core CI/container hosts.
  test: { environment: 'jsdom', clearMocks: true, restoreMocks: true, maxWorkers: 2 },
});
