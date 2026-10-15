import { cn } from '../../lib/cn';
import type { Visao } from '../../lib/calendario';
import { ESTILO_LIVRE, ESTILO_MINHA, ESTILO_OCUPADO, ESTILO_PASSADO } from './estilos';

const ITENS = [
  { rotulo: 'Livre (toque ou clique para reservar)', estilo: ESTILO_LIVRE, grade: true },
  { rotulo: 'Ocupado', estilo: ESTILO_OCUPADO, grade: false },
  { rotulo: 'Sua reserva', estilo: ESTILO_MINHA, grade: false },
  { rotulo: 'Horário que já passou', estilo: ESTILO_PASSADO, grade: true },
];

/** Na visão do mês não há horários livres nem sombreado: só os tipos de reserva. */
export function Legenda({ visao }: { visao: Visao }) {
  const itens = ITENS.filter((item) => visao !== 'mes' || !item.grade);
  return (
    <ul aria-label="Legenda" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
      {itens.map((item) => (
        <li key={item.rotulo} className="flex items-center gap-2">
          <span aria-hidden className={cn('inline-block h-4 w-6 rounded-sm', item.estilo)} />
          {item.rotulo}
        </li>
      ))}
    </ul>
  );
}
