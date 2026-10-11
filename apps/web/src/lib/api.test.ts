import { describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../test/render';
import { ApiError, apiFetch } from './api';

describe('apiFetch', () => {
  it('devolve o JSON em caso de sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ok: true })));
    await expect(apiFetch('/qualquer')).resolves.toEqual({ ok: true });
  });

  it('chama a API com o prefixo /api e envia cookies da mesma origem', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/salas');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/salas',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('converte o erro padrão da API em ApiError com a mensagem do servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: 'CONFLITO', message: 'Sala ocupada nesse horário.' } },
            409,
          ),
        ),
    );
    const error = await apiFetch('/reservas').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'CONFLITO',
      message: 'Sala ocupada nesse horário.',
    });
  });

  it('gera mensagem em português quando não há conexão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const error = await apiFetch('/salas').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect((error as Error).message).toMatch(/Não foi possível falar com o servidor/);
  });
});
