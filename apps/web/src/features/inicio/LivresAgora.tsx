import { Users } from 'lucide-react';
import { Link } from 'react-router';
import { buttonClasses } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import type { usePanoramaDoDia } from './usePanoramaDoDia';
import { RecursosSala } from '../salas/RecursosSala';

const MAX_SALAS = 4;

/** Salas livres neste momento, cada uma com atalho para reservar já preenchido. */
export function LivresAgora({
  panorama,
  hoje,
}: {
  panorama: ReturnType<typeof usePanoramaDoDia>;
  hoje: string;
}) {
  return (
    <section
      aria-labelledby="livres-agora"
      className="rounded-xl border border-line bg-paper p-5 shadow-card"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="livres-agora" className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="relative inline-block size-2 rounded-full bg-ok">
            <span className="absolute inset-0 animate-pulsar rounded-full bg-ok" />
          </span>
          Livres agora
        </h2>
        <Link
          to="/calendario?visao=agenda"
          className="text-sm font-semibold text-muted hover:text-ink"
        >
          Ver agenda →
        </Link>
      </div>

      {!panorama.pronto &&
        (panorama.erro ? (
          <p className="mt-3 text-sm text-muted">Não foi possível consultar as salas agora.</p>
        ) : (
          <div role="status" className="mt-4 flex flex-col gap-4">
            <span className="sr-only">Consultando salas livres…</span>
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-1.5 h-3 w-20" />
              </div>
            ))}
          </div>
        ))}

      {panorama.pronto && panorama.expedienteAcabou && (
        <p className="mt-3 text-sm text-muted">
          Fora do horário de reservas de hoje ({panorama.config.horarioInicio} às{' '}
          {panorama.config.horarioFim}).
        </p>
      )}

      {panorama.pronto && !panorama.expedienteAcabou && panorama.livres.length === 0 && (
        <p className="mt-3 text-sm text-muted">Nenhuma sala livre neste momento.</p>
      )}

      {panorama.pronto && panorama.livres.length > 0 && (
        <ul className="mt-3 flex flex-col gap-0.5">
          {panorama.livres.slice(0, MAX_SALAS).map(({ sala, inicio, ate }) => {
            const params = new URLSearchParams({ data: hoje, inicio, salaId: sala.id });
            return (
              <li
                key={sala.id}
                className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-canvas"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{sala.nome}</p>
                  <p className="text-sm text-ok">livre até {ate}</p>
                </div>
                <RecursosSala
                  recursos={sala.recursos}
                  compacto
                  max={3}
                  className="hidden shrink-0 sm:flex"
                />
                <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-canvas px-2 text-xs font-medium text-ink/80">
                  <Users aria-hidden className="size-3.5" />
                  <span className="sr-only">até</span> {sala.capacidade}
                  <span className="sr-only">pessoas</span>
                </span>
                <Link
                  to={`/reservas/nova?${params.toString()}`}
                  aria-label={`Reservar ${sala.nome} às ${inicio}`}
                  className={buttonClasses(
                    'secondary',
                    'sm',
                    'shrink-0 lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100 lg:pointer-coarse:opacity-100',
                  )}
                >
                  Reservar
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {panorama.pronto && panorama.livres.length > MAX_SALAS && (
        <p className="mt-2 text-sm text-muted">
          e mais {panorama.livres.length - MAX_SALAS} sala
          {panorama.livres.length - MAX_SALAS > 1 ? 's' : ''}.
        </p>
      )}
    </section>
  );
}
