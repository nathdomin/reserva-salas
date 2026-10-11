import { APP_TIMEZONE } from './constants';

/**
 * Datas e horários no fuso oficial do sistema (America/Sao_Paulo).
 * - "data" é sempre 'AAAA-MM-DD' e "hora" é 'HH:MM', no horário de Brasília.
 * - Instantes (Date) são absolutos (UTC), como o banco guarda (timestamptz).
 * Sem bibliotecas: usa Intl, que já trata horário de verão se ele voltar a existir.
 */

export const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Data e hora de um instante, no fuso informado. */
export function partesNoFuso(
  instante: Date,
  timeZone = APP_TIMEZONE,
): { data: string; hora: string; segundos: number } {
  const p: Record<string, string> = {};
  for (const part of formatter(timeZone).formatToParts(instante)) p[part.type] = part.value;
  return {
    data: `${p.year}-${p.month}-${p.day}`,
    hora: `${p.hour}:${p.minute}`,
    segundos: Number(p.second),
  };
}

/** Diferença (ms) entre o horário local do fuso e o UTC, naquele instante. */
function deslocamento(instante: Date, timeZone: string): number {
  const { data, hora, segundos } = partesNoFuso(instante, timeZone);
  const [y, m, d] = data.split('-').map(Number) as [number, number, number];
  const [h, mi] = hora.split(':').map(Number) as [number, number];
  const comoUtc = Date.UTC(y, m - 1, d, h, mi, segundos);
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/** Converte data + hora de Brasília para o instante absoluto correspondente. */
export function paraInstante(data: string, hora: string, timeZone = APP_TIMEZONE): Date {
  const [y, m, d] = data.split('-').map(Number) as [number, number, number];
  const [h, mi] = hora.split(':').map(Number) as [number, number];
  const ingenuo = Date.UTC(y, m - 1, d, h, mi);
  // Duas passadas: a segunda corrige o caso de o deslocamento mudar (horário de verão).
  let resultado = ingenuo - deslocamento(new Date(ingenuo), timeZone);
  resultado = ingenuo - deslocamento(new Date(resultado), timeZone);
  return new Date(resultado);
}

/** 'AAAA-MM-DD' é uma data real do calendário? (recusa 2026-02-30) */
export function dataValida(data: string): boolean {
  if (!DATA_REGEX.test(data)) return false;
  const [y, m, d] = data.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function somarDias(data: string, dias: number): string {
  const [y, m, d] = data.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

/** 'HH:MM' (ou 'HH:MM:SS', como o PostgreSQL devolve) → minutos desde 00:00. */
export function emMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/** Minutos desde 00:00 → 'HH:MM'. */
export function paraHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Horários possíveis entre `inicio` e `fim` (inclusive), no passo da granularidade. */
export function gerarHorarios(inicio: string, fim: string, passoMinutos: number): string[] {
  const resultado: string[] = [];
  for (let t = emMinutos(inicio); t <= emMinutos(fim); t += passoMinutos) {
    resultado.push(paraHora(t));
  }
  return resultado;
}

export function hojeNoFuso(agora = new Date(), timeZone = APP_TIMEZONE): string {
  return partesNoFuso(agora, timeZone).data;
}
