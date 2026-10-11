import { APP_LOCALE, APP_TIMEZONE } from '@reserva/shared';

const dateTimeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const longDateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Ex.: "09/10/2026, 14:30" — sempre no horário de Brasília. */
export function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(new Date(value));
}

/** Ex.: "Sexta-feira, 9 de outubro" */
export function formatLongDate(value: Date | string): string {
  const text = longDateFormatter.format(new Date(value));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const horaFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
});

const diaCurtoFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIMEZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

/** Ex.: "14:30" */
export function formatHora(value: Date | string): string {
  return horaFormatter.format(new Date(value));
}

/** Ex.: "Seg., 12/10" */
export function formatDiaCurto(value: Date | string): string {
  const text = diaCurtoFormatter.format(new Date(value));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Ex.: "10:00 às 11:30" ou "Dia inteiro (07:00 às 20:00)" */
export function formatHorario(inicio: string, fim: string, diaInteiro: boolean): string {
  const faixa = `${formatHora(inicio)} às ${formatHora(fim)}`;
  return diaInteiro ? `Dia inteiro (${faixa})` : faixa;
}
