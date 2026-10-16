import { describe, expect, it } from 'vitest';
import { comSessao, createTestApp } from '../../../test/helpers';
import { generateSessionToken } from './tokens';

/**
 * Chaves dos limites de requisições. Nenhum destes testes depende do banco: o limite é
 * aplicado antes de qualquer consulta, então só o código 429 importa.
 */
describe('limites de requisições', () => {
  it('o limite geral é por sessão: colegas atrás do mesmo IP não dividem a cota', async () => {
    const { app } = await createTestApp({ RATE_LIMIT_MAX: '10' });
    try {
      const ana = generateSessionToken().token;
      const bruno = generateSessionToken().token;
      const consultar = (token: string) =>
        app.inject({ method: 'GET', url: '/api/health', ...comSessao(token) });

      for (let i = 0; i < 10; i++) expect((await consultar(ana)).statusCode).not.toBe(429);
      expect((await consultar(ana)).statusCode).toBe(429);
      expect((await consultar(bruno)).statusCode).not.toBe(429);
    } finally {
      await app.close();
    }
  });

  it('o limite de login é por IP: trocar o cookie a cada tentativa não escapa dele', async () => {
    const { app } = await createTestApp({ LOGIN_RATE_LIMIT_MAX: '3' });
    try {
      const tentar = () =>
        app.inject({
          method: 'POST',
          url: '/api/auth/login',
          payload: { email: 'ninguem@empresa.com', senha: 'qualquer-coisa' },
          ...comSessao(generateSessionToken().token),
        });

      for (let i = 0; i < 3; i++) expect((await tentar()).statusCode).not.toBe(429);
      const res = await tentar();
      expect(res.statusCode).toBe(429);
      expect(res.json().error.code).toBe('RATE_LIMIT');
    } finally {
      await app.close();
    }
  });
});
