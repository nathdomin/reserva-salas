import { APP_LOCALE, emMinutos, partesNoFuso, somarDias } from '@reserva/shared';

/*
 * Utilitários do calendário. Datas são sempre 'AAAA-MM-DD' no horário de Brasília;
 * a semana começa na segunda-feira (semana de trabalho).
 */

export type Visao = 'mes' | 'semana' | 'dia';

export const VISOES: { valor: Visao; rotulo: string }[] = [
  { valor: 'mes', rotulo: 'Mês' },
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'dia', rotulo: 'Dia' },
];

/** Meio-dia UTC: evita qualquer efeito de fuso ao formatar só a data. */
const meioDia = (data: string) => new Date(`${data}T12:00:00Z`);

const fmt = (opcoes: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(APP_LOCALE, { timeZone: 'UTC', ...opcoes });

const fmtMesAno = fmt({ month: 'long', year: 'numeric' });
const fmtDiaMes = fmt({ day: 'numeric', month: 'long' });
const fmtDiaMesAno = fmt({ day: 'numeric', month: 'long', year: 'numeric' });
const fmtCompleto = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtSemanaCurta = fmt({ weekday: 'short' });
const fmtDiaCurto = fmt({ weekday: 'short', day: '2-digit', month: '2-digit' });

const maiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** 0 = domingo … 6 = sábado */
export function diaDaSemana(data: string): number {
  return meioDia(data).getUTCDay();
}

export function inicioDaSemana(data: string): string {
  return somarDias(data, -((diaDaSemana(data) + 6) % 7));
}

export function diasDaSemana(data: string): string[] {
  const inicio = inicioDaSemana(data);
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
}

export function primeiroDoMes(data: string): string {
  return `${data.slice(0, 7)}-01`;
}

/** Primeiro dia do mês `n` meses depois (ou antes, com n negativo). */
export function somarMeses(data: string, n: number): string {
  const [y, m] = data.split('-').map(Number) as [number, number];
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return dt.toISOString().slice(0, 10);
}

/** Semanas (segunda a domingo) que cobrem o mês inteiro: 4 a 6 linhas de 7 dias. */
export function gradeDoMes(data: string): string[][] {
  const primeiro = primeiroDoMes(data);
  const ultimo = somarDias(somarMeses(data, 1), -1);
  const semanas: string[][] = [];
  for (let inicio = inicioDaSemana(primeiro); inicio <= ultimo; inicio = somarDias(inicio, 7)) {
    semanas.push(Array.from({ length: 7 }, (_, i) => somarDias(inicio, i)));
  }
  return semanas;
}

/** Datas consultadas na API para a visão (inclusive). */
export function periodoDaVisao(visao: Visao, data: string): { inicio: string; fim: string } {
  if (visao === 'dia') return { inicio: data, fim: data };
  if (visao === 'semana') {
    const dias = diasDaSemana(data);
    return { inicio: dias[0]!, fim: dias[6]! };
  }
  const grade = gradeDoMes(data);
  return { inicio: grade[0]![0]!, fim: grade.at(-1)![6]! };
}

/** Data da página anterior/seguinte. */
export function navegar(visao: Visao, data: string, direcao: 1 | -1): string {
  if (visao === 'dia') return somarDias(data, direcao);
  if (visao === 'semana') return somarDias(data, 7 * direcao);
  return somarMeses(data, direcao);
}

/** Ex.: "Outubro de 2026", "12 a 18 de outubro de 2026", "Sexta-feira, 9 de outubro de 2026" */
export function tituloDoPeriodo(visao: Visao, data: string): string {
  if (visao === 'mes') return maiuscula(fmtMesAno.format(meioDia(data)));
  if (visao === 'dia') return maiuscula(fmtCompleto.format(meioDia(data)));
  const dias = diasDaSemana(data);
  const [inicio, fim] = [dias[0]!, dias[6]!];
  if (inicio.slice(0, 7) === fim.slice(0, 7)) {
    return `${Number(inicio.slice(8))} a ${fmtDiaMesAno.format(meioDia(fim))}`;
  }
  if (inicio.slice(0, 4) === fim.slice(0, 4)) {
    return `${fmtDiaMes.format(meioDia(inicio))} a ${fmtDiaMesAno.format(meioDia(fim))}`;
  }
  return `${fmtDiaMesAno.format(meioDia(inicio))} a ${fmtDiaMesAno.format(meioDia(fim))}`;
}

/** Ex.: "Seg." */
export function nomeCurtoDoDia(data: string): string {
  return maiuscula(fmtSemanaCurta.format(meioDia(data)));
}

/** Ex.: "Seg., 12/10" */
export function diaCurto(data: string): string {
  return maiuscula(fmtDiaCurto.format(meioDia(data)));
}

/** Data (Brasília) de um instante ISO. */
export function dataDoInstante(iso: string): string {
  return partesNoFuso(new Date(iso)).data;
}

/** Minutos desde 00:00 (Brasília) de um instante ISO. */
export function minutosDoInstante(iso: string): number {
  return emMinutos(partesNoFuso(new Date(iso)).hora);
}

export interface Posicionado<T> {
  item: T;
  coluna: number;
  colunas: number;
}

/**
 * Distribui itens que se sobrepõem em colunas lado a lado (como em agendas):
 * cada grupo de itens sobrepostos divide a largura entre si.
 */
export function distribuirEmColunas<T>(
  itens: T[],
  inicio: (item: T) => number,
  fim: (item: T) => number,
): Posicionado<T>[] {
  const ordenados = [...itens].sort((a, b) => inicio(a) - inicio(b) || fim(b) - fim(a));
  const resultado: Posicionado<T>[] = [];
  let grupo: Posicionado<T>[] = [];
  let fimDoGrupo = -Infinity;
  let finsDasColunas: number[] = [];

  const fecharGrupo = () => {
    for (const p of grupo) p.colunas = finsDasColunas.length;
    resultado.push(...grupo);
    grupo = [];
    finsDasColunas = [];
  };

  for (const item of ordenados) {
    if (inicio(item) >= fimDoGrupo) fecharGrupo();
    let coluna = finsDasColunas.findIndex((f) => f <= inicio(item));
    if (coluna === -1) {
      coluna = finsDasColunas.length;
      finsDasColunas.push(fim(item));
    } else {
      finsDasColunas[coluna] = fim(item);
    }
    grupo.push({ item, coluna, colunas: 1 });
    fimDoGrupo = Math.max(fimDoGrupo, fim(item));
  }
  fecharGrupo();
  return resultado;
}
