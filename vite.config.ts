import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          globals: true,
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
          exclude: ['src/**/*.audio.test.ts', 'node_modules/**'],
          setupFiles: ['src/test/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'audio',
          include: ['src/**/*.audio.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
