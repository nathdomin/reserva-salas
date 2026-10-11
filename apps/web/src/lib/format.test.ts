import { describe, expect, it } from 'vitest';
import { formatDateTime, formatHorario, formatLongDate } from './format';

describe('formatação de datas (horário de Brasília)', () => {
  it('converte UTC para America/Sao_Paulo', () => {
    // 17:30 UTC = 14:30 em Brasília (UTC-3)
    expect(formatDateTime('2026-10-09T17:30:00Z')).toBe('09/10/2026, 14:30');
  });

  it('respeita a virada de dia no fuso local', () => {
    // 02:00 UTC do dia 10 ainda é dia 09 em Brasília
    expect(formatDateTime('2026-10-10T02:00:00Z')).toBe('09/10/2026, 23:00');
  });

  it('formata a data por extenso em português com inicial maiúscula', () => {
    expect(formatLongDate('2026-10-09T15:00:00Z')).toBe('Sexta-feira, 9 de outubro');
  });

  it('formata o horário de uma reserva', () => {
    expect(formatHorario('2026-10-12T13:00:00Z', '2026-10-12T14:30:00Z', false)).toBe(
      '10:00 às 11:30',
    );
    expect(formatHorario('2026-10-12T10:00:00Z', '2026-10-12T23:00:00Z', true)).toBe(
      'Dia inteiro (07:00 às 20:00)',
    );
  });
});
