import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Avisos } from './Avisos';
import { avisar } from './store';

describe('avisos flutuantes', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra o aviso na região anunciada e some sozinho depois de alguns segundos', () => {
    vi.useFakeTimers();
    render(<Avisos />);
    act(() => avisar('Reserva confirmada.', 'Sala Azul · Ter., 01/12, 10:00 às 11:00'));

    const regiao = screen.getByRole('status');
    expect(regiao.textContent).toContain('Reserva confirmada.');
    expect(regiao.textContent).toContain('Sala Azul');

    act(() => vi.advanceTimersByTime(6000));
    expect(regiao.textContent).toBe('');
  });

  it('pode ser fechado antes e mantém no máximo três na tela', () => {
    render(<Avisos />);
    act(() => {
      for (const n of [1, 2, 3, 4]) avisar(`Aviso ${n}`);
    });
    const regiao = screen.getByRole('status');
    expect(regiao.textContent).not.toContain('Aviso 1');
    expect(regiao.textContent).toContain('Aviso 4');

    fireEvent.click(screen.getAllByRole('button', { name: 'Fechar aviso' })[0]!);
    expect(regiao.textContent).not.toContain('Aviso 2');
    expect(regiao.textContent).toContain('Aviso 3');
  });
});
