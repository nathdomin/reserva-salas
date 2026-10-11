import { describe, expect, it } from 'vitest';
import {
  dataValida,
  emMinutos,
  gerarHorarios,
  hojeNoFuso,
  paraHora,
  paraInstante,
  partesNoFuso,
  somarDias,
} from './tempo';

describe('datas e horários no fuso de Brasília', () => {
  it('converte horário de Brasília para UTC e volta', () => {
    const instante = paraInstante('2026-10-09', '10:30');
    expect(instante.toISOString()).toBe('2026-10-09T13:30:00.000Z');
    expect(partesNoFuso(instante)).toMatchObject({ data: '2026-10-09', hora: '10:30' });
  });

  it('trata a virada do dia (23:30 em Brasília = 02:30 UTC do dia seguinte)', () => {
    expect(paraInstante('2026-12-31', '23:30').toISOString()).toBe('2027-01-01T02:30:00.000Z');
    expect(hojeNoFuso(new Date('2027-01-01T02:30:00Z'))).toBe('2026-12-31');
  });

  it('funciona em fusos com horário de verão (ex.: Nova York)', () => {
    // Antes e depois da mudança de 2026 (8 de março): -05:00 → -04:00
    expect(paraInstante('2026-03-07', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-03-07T14:00:00.000Z',
    );
    expect(paraInstante('2026-03-09', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-03-09T13:00:00.000Z',
    );
  });

  it('valida datas reais do calendário', () => {
    expect(dataValida('2026-02-28')).toBe(true);
    expect(dataValida('2028-02-29')).toBe(true);
    expect(dataValida('2026-02-29')).toBe(false);
    expect(dataValida('2026-13-01')).toBe(false);
    expect(dataValida('09/10/2026')).toBe(false);
  });

  it('soma dias atravessando meses e anos', () => {
    expect(somarDias('2026-10-09', 120)).toBe('2027-02-06');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('converte horas e minutos', () => {
    expect(emMinutos('07:00')).toBe(420);
    expect(emMinutos('20:00:00')).toBe(1200);
    expect(paraHora(615)).toBe('10:15');
    expect(gerarHorarios('07:00', '08:00', 15)).toEqual([
      '07:00',
      '07:15',
      '07:30',
      '07:45',
      '08:00',
    ]);
  });
});
