import { describe, expect, it } from 'vitest';
import { createBloqueioSimulado, minutosDeBloqueio } from './bloqueio-simulado';

const MIN = 60_000;

describe('duração do bloqueio progressivo', () => {
  it('dobra a cada bloqueio seguido, até o teto', () => {
    expect([1, 2, 3, 4, 5, 6, 20].map((n) => minutosDeBloqueio(n, 15))).toEqual([
      1, 2, 4, 8, 15, 15, 15,
    ]);
  });
});

describe('bloqueio simulado (e-mails inexistentes)', () => {
  it('bloqueia na N-ésima falha e libera depois do prazo', () => {
    let t = 0;
    const b = createBloqueioSimulado({ maxTentativas: 3, maxMinutos: 15, agora: () => t });
    expect(b.registrarFalha('a@x.com')).toBe(false);
    expect(b.registrarFalha('a@x.com')).toBe(false);
    expect(b.minutosRestantes('a@x.com')).toBe(0);
    expect(b.registrarFalha('a@x.com')).toBe(true);
    expect(b.minutosRestantes('a@x.com')).toBe(1);
    expect(b.minutosRestantes('b@x.com')).toBe(0);
    t += MIN;
    expect(b.minutosRestantes('a@x.com')).toBe(0);
  });

  it('cada novo bloqueio da sequência dura o dobro, e a sequência recomeça após um dia', () => {
    let t = 0;
    const b = createBloqueioSimulado({ maxTentativas: 2, maxMinutos: 15, agora: () => t });
    const errarAteBloquear = () => {
      b.registrarFalha('a@x.com');
      b.registrarFalha('a@x.com');
    };
    errarAteBloquear();
    expect(b.minutosRestantes('a@x.com')).toBe(1);
    t += MIN;
    errarAteBloquear();
    expect(b.minutosRestantes('a@x.com')).toBe(2);
    t += 2 * MIN;
    errarAteBloquear();
    expect(b.minutosRestantes('a@x.com')).toBe(4);

    t += 4 * MIN + 24 * 60 * MIN + 1;
    errarAteBloquear();
    expect(b.minutosRestantes('a@x.com')).toBe(1);
  });

  it('não cresce sem limite', () => {
    const b = createBloqueioSimulado({ maxTentativas: 5, maxMinutos: 15, maxEntradas: 100 });
    for (let i = 0; i < 1000; i++) b.registrarFalha(`p${i}@x.com`);
    // As entradas mais antigas foram descartadas; as recentes continuam contando.
    expect(b.registrarFalha('p999@x.com')).toBe(false);
  });
});
