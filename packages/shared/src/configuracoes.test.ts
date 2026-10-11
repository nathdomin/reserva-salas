import { describe, expect, it } from 'vitest';
import { auditoriaQuerySchema } from './auditoria';
import { atualizarConfiguracoesSchema, type Configuracoes, validarConfiguracoes } from './reservas';

const PADRAO: Configuracoes = {
  motivoVisivelParaTodos: true,
  horarioInicio: '07:00',
  horarioFim: '20:00',
  granularidadeMinutos: 15,
  duracaoMinimaMinutos: 15,
  duracaoMaximaMinutos: 480,
  antecedenciaMaximaDias: 120,
  intervaloEntreReunioesMinutos: 0,
};

const campos = (c: Partial<Configuracoes>) =>
  validarConfiguracoes({ ...PADRAO, ...c }).map((e) => e.campo);

describe('validarConfiguracoes', () => {
  it('aceita a configuração padrão', () => {
    expect(validarConfiguracoes(PADRAO)).toEqual([]);
  });

  it('aponta o campo de cada problema', () => {
    expect(campos({ horarioFim: '06:00' })).toContain('horarioFim');
    expect(campos({ horarioInicio: '07:10' })).toEqual(['horarioInicio']);
    expect(campos({ granularidadeMinutos: 30, duracaoMinimaMinutos: 15 })).toEqual([
      'duracaoMinimaMinutos',
    ]);
    expect(campos({ duracaoMinimaMinutos: 120, duracaoMaximaMinutos: 60 })).toEqual([
      'duracaoMaximaMinutos',
    ]);
    // 07:00–20:00 = 780 minutos de expediente
    expect(campos({ duracaoMaximaMinutos: 780 })).toEqual([]);
    expect(campos({ duracaoMaximaMinutos: 795 })).toEqual(['duracaoMaximaMinutos']);
  });
});

describe('atualizarConfiguracoesSchema', () => {
  it('aceita alteração parcial e recusa corpo vazio', () => {
    expect(atualizarConfiguracoesSchema.parse({ antecedenciaMaximaDias: 60 })).toEqual({
      antecedenciaMaximaDias: 60,
    });
    expect(atualizarConfiguracoesSchema.safeParse({}).success).toBe(false);
  });

  it('recusa valores fora dos limites', () => {
    for (const dados of [
      { granularidadeMinutos: 20 },
      { antecedenciaMaximaDias: 731 },
      { intervaloEntreReunioesMinutos: -5 },
      { horarioInicio: '7:00' },
      { duracaoMinimaMinutos: 2.5 },
    ]) {
      expect(atualizarConfiguracoesSchema.safeParse(dados).success, JSON.stringify(dados)).toBe(
        false,
      );
    }
  });
});

describe('auditoriaQuerySchema', () => {
  it('converte números da URL e aplica o limite padrão', () => {
    expect(auditoriaQuerySchema.parse({ antesDe: '42' })).toEqual({ antesDe: 42, limite: 50 });
  });

  it('recusa período invertido e ação desconhecida', () => {
    expect(
      auditoriaQuerySchema.safeParse({ dataInicio: '2026-10-10', dataFim: '2026-10-01' }).success,
    ).toBe(false);
    expect(auditoriaQuerySchema.safeParse({ acao: 'X' }).success).toBe(false);
  });
});
