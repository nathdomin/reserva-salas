import { cn } from '../../lib/cn';
import { ESTILO_LIVRE, ESTILO_MINHA, ESTILO_OCUPADO, ESTILO_PASSADO } from './estilos';

const ITENS = [
  { rotulo: 'Livre (clique para reservar)', estilo: ESTILO_LIVRE },
  { rotulo: 'Ocupado', estilo: ESTILO_OCUPADO },
  { rotulo: 'Sua reserva', estilo: ESTILO_MINHA },
  { rotulo: 'Horário que já passou', estilo: ESTILO_PASSADO },
];

export function Legenda() {
  return (
    <ul aria-label="Legenda" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
      {ITENS.map((item) => (
        <li key={item.rotulo} className="flex items-center gap-2">
          <span aria-hidden className={cn('inline-block h-4 w-6 rounded-sm', item.estilo)} />
          {item.rotulo}
        </li>
      ))}
    </ul>
  );
}
