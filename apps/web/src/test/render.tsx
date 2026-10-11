import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation, useRoutes } from 'react-router';
import { createQueryClient } from '../lib/query-client';
import { routes } from '../routes';

/**
 * Usa o roteador "declarativo" (MemoryRouter + useRoutes) com as rotas reais da aplicação.
 *
 * Por que não createMemoryRouter? O roteador de dados cria um `Request` a cada navegação.
 * No jsdom, o AbortSignal é o do jsdom, mas o `Request` é o do Node (undici), que só
 * aceita o próprio AbortSignal — a navegação falha só no ambiente de teste. No navegador
 * real há uma única implementação e isso não acontece.
 */
function AppRoutes({ location }: { location: { pathname: string } }) {
  location.pathname = useLocation().pathname;
  return useRoutes(routes);
}

/** Renderiza a aplicação completa (rotas reais) em uma URL inicial. */
export function renderApp(initialPath = '/') {
  // Mesma configuração do sistema (inclui "401 em qualquer chamada → volta ao login"),
  // só sem novas tentativas automáticas, para os testes serem rápidos e determinísticos.
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 },
  });
  // Atualizado a cada renderização: permite conferir a URL atual nos testes.
  const location = { pathname: initialPath };
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRoutes location={location} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, location };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
