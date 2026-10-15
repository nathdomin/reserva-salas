import { describe, expect, it } from 'vitest';
import {
  diaDaSemana,
  diasDaSemana,
  distribuirEmColunas,
  gradeDoMes,
  inicioDaSemana,
  minutosDoInstante,
  montarAgenda,
  navegar,
  periodoDaVisao,
  somarMeses,
  tituloDoPeriodo,
} from './calendario';

describe('calendário: datas', () => {
  it('a semana começa na segunda-feira', () => {
    expect(diaDaSemana('2026-10-09')).toBe(5); // sexta
    expect(inicioDaSemana('2026-10-09')).toBe('2026-10-05');
    expect(inicioDaSemana('2026-10-11')).toBe('2026-10-05'); // domingo fica na mesma semana
    expect(inicioDaSemana('2026-10-05')).toBe('2026-10-05');
    expect(diasDaSemana('2026-10-09')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
  });

  it('a grade do mês cobre o mês inteiro em semanas completas', () => {
    const outubro = gradeDoMes('2026-10-20');
    expect(outubro[0]![0]).toBe('2026-09-28');
    expect(outubro.at(-1)![6]).toBe('2026-11-01');
    expect(outubro).toHaveLength(5);
    expect(outubro.every((s) => s.length === 7)).toBe(true);
    // Fevereiro de 2027 começa numa segunda e tem 28 dias: exatamente 4 semanas.
    expect(gradeDoMes('2027-02-10')).toHaveLength(4);
  });

  it('meses: soma e virada de ano', () => {
    expect(somarMeses('2026-12-15', 1)).toBe('2027-01-01');
    expect(somarMeses('2026-01-31', -1)).toBe('2025-12-01');
  });

  it('período consultado e navegação de cada visão', () => {
    expect(periodoDaVisao('dia', '2026-10-09')).toEqual({
      inicio: '2026-10-09',
      fim: '2026-10-09',
    });
    expect(periodoDaVisao('semana', '2026-10-09')).toEqual({
      inicio: '2026-10-05',
      fim: '2026-10-11',
    });
    expect(periodoDaVisao('mes', '2026-10-09')).toEqual({
      inicio: '2026-09-28',
      fim: '2026-11-01',
    });
    expect(navegar('dia', '2026-10-31', 1)).toBe('2026-11-01');
    expect(navegar('semana', '2026-10-09', -1)).toBe('2026-10-02');
    expect(navegar('mes', '2026-10-09', 1)).toBe('2026-11-01');
  });

  it('títulos em português', () => {
    expect(tituloDoPeriodo('mes', '2026-10-09')).toBe('Outubro de 2026');
    expect(tituloDoPeriodo('dia', '2026-10-09')).toBe('Sexta-feira, 9 de outubro de 2026');
    expect(tituloDoPeriodo('semana', '2026-10-09')).toBe('5 a 11 de outubro de 2026');
    expect(tituloDoPeriodo('semana', '2026-10-30')).toBe('26 de outubro a 1 de novembro de 2026');
    expect(tituloDoPeriodo('semana', '2026-12-30')).toBe(
      '28 de dezembro de 2026 a 3 de janeiro de 2027',
    );
  });

  it('minutos do dia no horário de Brasília', () => {
    expect(minutosDoInstante('2026-12-01T13:30:00.000Z')).toBe(10 * 60 + 30);
  });
});

describe('calendário: reuniões sobrepostas', () => {
  const ev = (inicio: number, fim: number) => ({ inicio, fim });
  const posicoes = (itens: { inicio: number; fim: number }[]) =>
    distribuirEmColunas(
      itens,
      (i) => i.inicio,
      (i) => i.fim,
    ).map((p) => [p.item.inicio, p.coluna, p.colunas]);

  it('sem sobreposição: cada uma ocupa a largura toda', () => {
    expect(posicoes([ev(600, 660), ev(660, 720)])).toEqual([
      [600, 0, 1],
      [660, 0, 1],
    ]);
  });

  it('sobrepostas dividem a largura; a coluna livre é reaproveitada', () => {
    expect(posicoes([ev(600, 720), ev(630, 660), ev(660, 690), ev(800, 860)])).toEqual([
      [600, 0, 2],
      [630, 1, 2],
      [660, 1, 2],
      [800, 0, 1],
    ]);
  });
});

describe('calendário: agenda do dia', () => {
  const opcoes = { abertura: 420, fechamento: 1200, livreDesde: 420, duracaoMinima: 15 };
  const agenda = (itens: [number, number][], extra: Partial<typeof opcoes> = {}) =>
    montarAgenda(
      itens,
      (i) => i[0],
      (i) => i[1],
      { ...opcoes, ...extra },
    ).map((t) =>
      t.tipo === 'livre' ? `livre ${t.inicio}-${t.fim}` : `ocupado ${t.inicio}-${t.fim}`,
    );

  it('dia sem reservas: tudo livre', () => {
    expect(agenda([])).toEqual(['livre 420-1200']);
  });

  it('intercala reservas e intervalos livres, em ordem', () => {
    expect(
      agenda([
        [660, 720],
        [480, 540],
      ]),
    ).toEqual([
      'livre 420-480',
      'ocupado 480-540',
      'livre 540-660',
      'ocupado 660-720',
      'livre 720-1200',
    ]);
  });

  it('reservas encostadas ou sobrepostas não deixam livre entre elas', () => {
    expect(
      agenda([
        [480, 600],
        [540, 570],
        [600, 660],
      ]),
    ).toEqual([
      'livre 420-480',
      'ocupado 480-600',
      'ocupado 540-570',
      'ocupado 600-660',
      'livre 660-1200',
    ]);
  });

  it('livre só a partir de agora e com a duração mínima', () => {
    expect(agenda([[600, 660]], { livreDesde: 555, duracaoMinima: 60 })).toEqual([
      'ocupado 600-660',
      'livre 660-1200',
    ]);
    // Dia que já passou: só as reservas.
    expect(agenda([[600, 660]], { livreDesde: 1200 })).toEqual(['ocupado 600-660']);
  });
});
