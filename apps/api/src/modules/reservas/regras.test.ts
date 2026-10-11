import type { Configuracoes } from '@reserva/shared';
import { paraInstante } from '@reserva/shared';
import { describe, expect, it } from 'vitest';
import { inicioDoIntervaloAtual, sugerirHorarios, validarPeriodo } from './regras';

const config: Configuracoes = {
  motivoVisivelParaTodos: true,
  horarioInicio: '07:00',
  horarioFim: '20:00',
  granularidadeMinutos: 15,
  duracaoMinimaMinutos: 15,
  duracaoMaximaMinutos: 480,
  antecedenciaMaximaDias: 120,
  intervaloEntreReunioesMinutos: 0,
};

// "Agora" fixo: sexta, 09/10/2026, 10:07 em Brasília (13:07 UTC).
const agora = new Date('2026-10-09T13:07:00Z');

const periodo = (data: string, horaInicio: string, horaFim: string, diaInteiro = false) =>
  validarPeriodo({ data, horaInicio, horaFim, diaInteiro }, config, agora);

function erros(resultado: ReturnType<typeof validarPeriodo>) {
  return resultado.ok ? [] : resultado.erros.map((e) => e.mensagem);
}

describe('validarPeriodo', () => {
  it('aceita um horário válido e converte para UTC (Brasília = UTC-3)', () => {
    const r = periodo('2026-10-12', '10:00', '11:30');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.inicio.toISOString()).toBe('2026-10-12T13:00:00.000Z');
      expect(r.fim.toISOString()).toBe('2026-10-12T14:30:00.000Z');
    }
  });

  it('exige horários de 15 em 15 minutos', () => {
    expect(erros(periodo('2026-10-12', '10:10', '11:00'))[0]).toMatch(/de 15 em 15 minutos/);
  });

  it('respeita o horário de funcionamento (07:00 às 20:00)', () => {
    expect(erros(periodo('2026-10-12', '06:45', '08:00'))[0]).toMatch(/das 07:00 às 20:00/);
    expect(erros(periodo('2026-10-12', '19:00', '20:15'))[0]).toMatch(/das 07:00 às 20:00/);
    expect(periodo('2026-10-12', '19:00', '20:00').ok).toBe(true);
  });

  it('limita a duração a 8 horas e sugere "Dia inteiro"', () => {
    const msgs = erros(periodo('2026-10-12', '08:00', '16:15'));
    expect(msgs[0]).toMatch(/no máximo 8 horas/);
    expect(msgs[0]).toMatch(/Dia inteiro/);
    expect(periodo('2026-10-12', '08:00', '16:00').ok).toBe(true);
  });

  it('recusa término antes ou igual ao início', () => {
    expect(erros(periodo('2026-10-12', '11:00', '10:00'))).toContain(
      'O término deve ser depois do início.',
    );
  });

  it('permite até 120 dias de antecedência', () => {
    // 09/10/2026 + 120 dias = 06/02/2027
    expect(periodo('2027-02-06', '10:00', '11:00').ok).toBe(true);
    expect(erros(periodo('2027-02-07', '10:00', '11:00'))[0]).toMatch(/até 120 dias/);
  });

  it('recusa horário que já passou, mas aceita o intervalo atual', () => {
    expect(erros(periodo('2026-10-08', '10:00', '11:00'))[0]).toMatch(/já passou/);
    expect(erros(periodo('2026-10-09', '09:45', '10:30'))[0]).toMatch(/já passou/);
    // 10:07 → o intervalo das 10:00 ainda é aceito
    expect(periodo('2026-10-09', '10:00', '10:30').ok).toBe(true);
  });

  it('não verifica o passado quando a edição mantém o horário', () => {
    const r = validarPeriodo(
      { data: '2026-10-08', horaInicio: '10:00', horaFim: '11:00', diaInteiro: false },
      config,
      agora,
      { verificarPassado: false },
    );
    expect(r.ok).toBe(true);
  });

  describe('dia inteiro', () => {
    it('ocupa todo o horário de funcionamento, sem o limite de 8 horas', () => {
      const r = validarPeriodo({ data: '2026-10-12', diaInteiro: true }, config, agora);
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect([r.horaInicio, r.horaFim]).toEqual(['07:00', '20:00']);
        expect(r.inicio.toISOString()).toBe('2026-10-12T10:00:00.000Z');
        expect(r.fim.toISOString()).toBe('2026-10-12T23:00:00.000Z');
      }
    });

    it('hoje, com o expediente já começado, reserva o restante do dia', () => {
      const r = validarPeriodo({ data: '2026-10-09', diaInteiro: true }, config, agora);
      expect(r.ok).toBe(true);
      if (r.ok) expect([r.horaInicio, r.horaFim]).toEqual(['10:00', '20:00']);
    });

    it('hoje, depois do expediente, não é possível', () => {
      const noite = new Date('2026-10-09T23:30:00Z'); // 20:30 em Brasília
      const r = validarPeriodo({ data: '2026-10-09', diaInteiro: true }, config, noite);
      expect(r.ok).toBe(false);
      expect(erros(r)[0]).toMatch(/já terminou/);
    });
  });
});

describe('inicioDoIntervaloAtual', () => {
  it('arredonda para baixo no passo configurado', () => {
    expect(inicioDoIntervaloAtual(agora, 15).toISOString()).toBe('2026-10-09T13:00:00.000Z');
    expect(inicioDoIntervaloAtual(new Date('2026-10-09T13:15:00Z'), 15).toISOString()).toBe(
      '2026-10-09T13:15:00.000Z',
    );
  });
});

describe('sugerirHorarios', () => {
  const ocupados = [
    // 10:00–11:00 e 11:30–13:00 ocupados em 12/10
    { inicio: paraInstante('2026-10-12', '10:00'), fim: paraInstante('2026-10-12', '11:00') },
    { inicio: paraInstante('2026-10-12', '11:30'), fim: paraInstante('2026-10-12', '13:00') },
  ];

  it('sugere os horários livres mais próximos, com a mesma duração, em ordem', () => {
    const s = sugerirHorarios({
      data: '2026-10-12',
      horaDesejada: '10:30',
      duracaoMinutos: 60,
      ocupados,
      config,
      agora,
      limite: 3,
    });
    expect(s).toEqual([
      { horaInicio: '08:45', horaFim: '09:45' },
      { horaInicio: '09:00', horaFim: '10:00' },
      { horaInicio: '13:00', horaFim: '14:00' },
    ]);
  });

  it('respeita o intervalo entre reuniões quando configurado', () => {
    const s = sugerirHorarios({
      data: '2026-10-12',
      horaDesejada: '13:00',
      duracaoMinutos: 30,
      ocupados,
      config: { ...config, intervaloEntreReunioesMinutos: 15 },
      agora,
      limite: 1,
    });
    expect(s).toEqual([{ horaInicio: '13:15', horaFim: '13:45' }]);
  });

  it('não sugere horários que já passaram', () => {
    const s = sugerirHorarios({
      data: '2026-10-09',
      horaDesejada: '08:00',
      duracaoMinutos: 30,
      ocupados: [],
      config,
      agora,
      limite: 2,
    });
    expect(s).toEqual([
      { horaInicio: '10:00', horaFim: '10:30' },
      { horaInicio: '10:15', horaFim: '10:45' },
    ]);
  });
});
