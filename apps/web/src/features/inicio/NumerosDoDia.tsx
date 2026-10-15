import { cn } from '../../lib/cn';
import type { usePanoramaDoDia } from './usePanoramaDoDia';

/** Faixa com os números de hoje. */
export function NumerosDoDia({ panorama }: { panorama: ReturnType<typeof usePanoramaDoDia> }) {
  const p = panorama.pronto ? panorama : null;
  const itens = [
    { valor: p?.suasHoje, rotulo: 'reuniões suas hoje' },
    { valor: p?.livres.length, rotulo: 'salas livres agora', destaque: true },
    { valor: p?.reservasHoje, rotulo: 'reservas hoje no total' },
    { valor: p?.totalSalas, rotulo: 'salas disponíveis' },
  ];
  return (
    <dl className="grid grid-cols-2 gap-y-4 rounded-xl border border-line bg-paper px-5 py-4 shadow-card sm:grid-cols-4">
      {itens.map((item, i) => (
        <div
          key={item.rotulo}
          className={cn(
            'flex flex-col-reverse justify-end px-4 first:pl-0',
            i % 2 === 1 && 'border-l border-line',
            i >= 2 && 'sm:border-l sm:border-line',
            i === 2 && 'pl-0 sm:pl-4',
          )}
        >
          <dt className="text-sm text-muted">{item.rotulo}</dt>
          <dd
            className={cn(
              'text-3xl font-bold tracking-tight',
              item.destaque && item.valor ? 'text-ok' : undefined,
            )}
          >
            {item.valor ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}
