import { render, screen, within } from '@testing-library/react';
import { CircleCheck, Projector, Tv } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { iconeDoRecurso, RecursosSala } from './RecursosSala';

describe('recursos da sala', () => {
  it('escolhe o ícone pelo nome, sem ligar para acento e maiúsculas', () => {
    expect(iconeDoRecurso('Televisão')).toBe(Tv);
    expect(iconeDoRecurso(' PROJETOR ')).toBe(Projector);
    expect(iconeDoRecurso('Cafeteira')).toBe(CircleCheck);
  });

  it('no modo compacto mostra só ícones, com o nome para o leitor de tela, e resume o resto', () => {
    render(
      <RecursosSala
        recursos={['Televisão', 'Projetor', 'Quadro branco', 'Cafeteira']}
        compacto
        max={2}
      />,
    );
    const lista = screen.getByRole('list', { name: 'Recursos' });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens.map((i) => i.textContent)).toEqual(['Televisão', 'Projetor', '+2 recursos']);
    expect(itens[0]!.getAttribute('title')).toBe('Televisão');
  });

  it('sem recursos, não mostra nada', () => {
    const { container } = render(<RecursosSala recursos={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
