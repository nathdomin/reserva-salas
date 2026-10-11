/** Fuso horário oficial do sistema. O banco grava em UTC (timestamptz). */
export const APP_TIMEZONE = 'America/Sao_Paulo';

/** Idioma/locale usado em toda a interface. */
export const APP_LOCALE = 'pt-BR';

export const PERFIS = ['COLABORADOR', 'ADMIN'] as const;
export type Perfil = (typeof PERFIS)[number];

export const PERFIL_LABEL: Record<Perfil, string> = {
  COLABORADOR: 'Colaborador',
  ADMIN: 'Administrador',
};

export const STATUS_RESERVA = ['ATIVA', 'CANCELADA'] as const;
export type StatusReserva = (typeof STATUS_RESERVA)[number];

export const STATUS_RESERVA_LABEL: Record<StatusReserva, string> = {
  ATIVA: 'Ativa',
  CANCELADA: 'Cancelada',
};
