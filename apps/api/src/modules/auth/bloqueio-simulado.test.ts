import { describe, expect, it } from 'vitest';
import { createBloqueioSimulado } from './bloqueio-simulado';

describe('bloqueio simulado (e-mails inexistentes)', () => {
  it('bloqueia na N-ésima falha e libera depois do prazo', () => {
    let t = 0;
    const b = createBloqueioSimulado({ maxTentativas: 3, bloqueioMinutos: 15, agora: () => t });
    expect(b.registrarFalha('a@x.com')).toBe(false);
    expect(b.registrarFalha('a@x.com')).toBe(false);
    expect(b.bloqueado('a@x.com')).toBe(false);
    expect(b.registrarFalha('a@x.com')).toBe(true);
    expect(b.bloqueado('a@x.com')).toBe(true);
    expect(b.bloqueado('b@x.com')).toBe(false);
    t += 15 * 60_000;
    expect(b.bloqueado('a@x.com')).toBe(false);
  });

  it('não cresce sem limite', () => {
    const b = createBloqueioSimulado({ maxTentativas: 5, bloqueioMinutos: 15, maxEntradas: 100 });
    for (let i = 0; i < 1000; i++) b.registrarFalha(`p${i}@x.com`);
    // As entradas mais antigas foram descartadas; as recentes continuam contando.
    expect(b.registrarFalha('p999@x.com')).toBe(false);
  });
});
