import type { Configuracoes } from '@reserva/shared';
import { describe, expect, it } from 'vitest';
import { createConfiguracoesCache } from './cache';

const base = { antecedenciaMaximaDias: 120 } as Configuracoes;

function montar(ttlMs: number) {
  let relogio = 0;
  let leituras = 0;
  let valor = 120;
  const cache = createConfiguracoesCache(
    async () => {
      leituras += 1;
      return { ...base, antecedenciaMaximaDias: valor };
    },
    { ttlMs, agora: () => relogio },
  );
  return {
    cache,
    leituras: () => leituras,
    avancar: (ms: number) => (relogio += ms),
    mudarNoBanco: (v: number) => (valor = v),
  };
}

describe('cache das configurações', () => {
  it('lê o banco uma vez dentro do prazo e de novo depois dele', async () => {
    const t = montar(60_000);
    await t.cache.obter();
    await t.cache.obter();
    expect(t.leituras()).toBe(1);

    t.mudarNoBanco(30);
    t.avancar(60_001);
    expect((await t.cache.obter()).antecedenciaMaximaDias).toBe(30);
    expect(t.leituras()).toBe(2);
  });

  it('pedidos simultâneos compartilham a mesma leitura', async () => {
    const t = montar(60_000);
    await Promise.all([t.cache.obter(), t.cache.obter(), t.cache.obter()]);
    expect(t.leituras()).toBe(1);
  });

  it('invalidar faz a próxima leitura ir ao banco', async () => {
    const t = montar(60_000);
    await t.cache.obter();
    t.mudarNoBanco(45);
    t.cache.invalidar();
    expect((await t.cache.obter()).antecedenciaMaximaDias).toBe(45);
    expect(t.leituras()).toBe(2);
  });

  it('uma leitura iniciada antes de invalidar não fica guardada', async () => {
    const t = montar(60_000);
    const antiga = t.cache.obter();
    t.cache.invalidar();
    t.mudarNoBanco(10);
    await antiga;
    expect((await t.cache.obter()).antecedenciaMaximaDias).toBe(10);
  });

  it('com prazo 0 sempre lê do banco', async () => {
    const t = montar(0);
    await t.cache.obter();
    await t.cache.obter();
    expect(t.leituras()).toBe(2);
  });
});
