import { describe, expect, it } from 'vitest';
import { apiErrorSchema, healthResponseSchema } from './api';
import { PERFIL_LABEL, PERFIS, STATUS_RESERVA, STATUS_RESERVA_LABEL } from './constants';

describe('schemas compartilhados', () => {
  it('aceita uma resposta de health válida', () => {
    const parsed = healthResponseSchema.parse({
      status: 'ok',
      database: 'ok',
      timestamp: new Date().toISOString(),
    });
    expect(parsed.status).toBe('ok');
  });

  it('rejeita status de health desconhecido', () => {
    const result = healthResponseSchema.safeParse({
      status: 'talvez',
      database: 'ok',
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('valida o formato padrão de erro', () => {
    expect(
      apiErrorSchema.safeParse({ error: { code: 'NOT_FOUND', message: 'Não encontrado' } }).success,
    ).toBe(true);
    expect(apiErrorSchema.safeParse({ message: 'sem envelope' }).success).toBe(false);
  });
});

describe('constantes', () => {
  it('tem rótulo em português para todo perfil e status', () => {
    for (const perfil of PERFIS) expect(PERFIL_LABEL[perfil].length).toBeGreaterThan(0);
    for (const status of STATUS_RESERVA)
      expect(STATUS_RESERVA_LABEL[status].length).toBeGreaterThan(0);
  });
});
