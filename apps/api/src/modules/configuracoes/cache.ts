import type { Configuracoes } from '@reserva/shared';

/**
 * Guarda as configurações em memória por `ttlMs`: quase toda requisição de reservas precisa
 * delas, e cada ida ao banco custa caro (o banco fica em outra região). Alterações feitas
 * pela própria API chamam `invalidar()` e valem na hora; alterações feitas direto no banco
 * (SQL Editor) valem em até `ttlMs`. Com `ttlMs` <= 0 não há cache (usado nos testes).
 */
export function createConfiguracoesCache(
  carregar: () => Promise<Configuracoes>,
  opcoes: { ttlMs: number; agora?: () => number },
) {
  const agora = opcoes.agora ?? (() => Date.now());
  let guardado: { config: Configuracoes; validoAte: number } | null = null;
  let carregando: Promise<Configuracoes> | null = null;
  // Muda a cada invalidação: uma leitura iniciada antes dela não é guardada.
  let geracao = 0;

  return {
    async obter(): Promise<Configuracoes> {
      if (opcoes.ttlMs <= 0) return carregar();
      if (guardado && guardado.validoAte > agora()) return guardado.config;
      if (!carregando) {
        const minhaGeracao = geracao;
        const promessa = carregar()
          .then((config) => {
            if (minhaGeracao === geracao) {
              guardado = { config, validoAte: agora() + opcoes.ttlMs };
            }
            return config;
          })
          .finally(() => {
            if (carregando === promessa) carregando = null;
          });
        carregando = promessa;
      }
      return carregando;
    },

    invalidar() {
      geracao += 1;
      guardado = null;
      carregando = null;
    },
  };
}

export type ConfiguracoesCache = ReturnType<typeof createConfiguracoesCache>;
