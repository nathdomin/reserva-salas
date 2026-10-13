import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Fluxos com várias etapas (enviar → navegar → carregar a próxima tela) podem passar de 1 s
// em computadores mais lentos; 5 s evita falhas por tempo sem esconder erros reais.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});