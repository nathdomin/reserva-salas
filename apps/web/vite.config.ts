import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig(({ mode }) => {
  // Lê o .env da raiz apenas para saber a porta da API (nenhum segredo vai para o navegador).
  const env = loadEnv(mode, repoRoot, '');
  const apiPort = env.PORT || '3333';

  return {
    plugins: [react(), tailwindcss()],
    envDir: repoRoot,
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target: `http://localhost:${apiPort}`, changeOrigin: false },
      },
    },
    build: {
      sourcemap: true,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
       testTimeout: 15_000,
    },
  };
});
