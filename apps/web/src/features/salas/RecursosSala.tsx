import {
  AirVent,
  CircleCheck,
  Phone,
  Presentation,
  Projector,
  Tv,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/cn';

/** Ícone de cada recurso sugerido; recursos digitados à mão usam um ícone genérico. */
const ICONES: Record<string, LucideIcon> = {
  televisao: Tv,
  projetor: Projector,
  videoconferencia: Video,
  'quadro branco': Presentation,
  'ar-condicionado': AirVent,
  'telefone de conferencia': Phone,
};

const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export function iconeDoRecurso(recurso: string): LucideIcon {
  return ICONES[normalizar(recurso)] ?? CircleCheck;
}

/**
 * Recursos da sala com ícone. "compacto" mostra só os ícones (o nome fica no title e
 * para o leitor de tela), para listas apertadas.
 */
export function RecursosSala({
  recursos,
  compacto = false,
  max,
  className,
}: {
  recursos: string[];
  compacto?: boolean;
  /** Quantos mostrar; o resto vira "+N". */
  max?: number;
  className?: string;
}) {
  if (recursos.length === 0) return null;
  const visiveis = max ? recursos.slice(0, max) : recursos;
  const resto = recursos.length - visiveis.length;
  return (
    <ul aria-label="Recursos" className={cn('flex flex-wrap gap-1.5', className)}>
      {visiveis.map((r) => {
        const Icone = iconeDoRecurso(r);
        return (
          <li
            key={r}
            title={r}
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-full bg-canvas text-xs font-medium text-ink/80',
              compacto ? 'w-6 justify-center' : 'px-2',
            )}
          >
            <Icone aria-hidden className="size-3.5 shrink-0" />
            <span className={cn(compacto && 'sr-only')}>{r}</span>
          </li>
        );
      })}
      {resto > 0 && (
        <li className="inline-flex h-6 items-center rounded-full bg-canvas px-2 text-xs font-medium text-muted">
          +{resto}
          <span className="sr-only"> recursos</span>
        </li>
      )}
    </ul>
  );
}
