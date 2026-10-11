import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    // Testes de integração compartilham o mesmo banco de teste: rodar arquivos em série
    // evita interferência entre eles.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
