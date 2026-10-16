import { hojeNoFuso } from '@reserva/shared';
import { Link } from 'react-router';
import { usePanoramaDoDia } from '../../features/inicio/usePanoramaDoDia';
import { useMinhasReservas } from '../../features/reservas/api';
import { dataDoInstante } from '../../lib/calendario';
import { formatDiaCurto, formatHora } from '../../lib/format';
import { useAgora } from '../../lib/useAgora';
import { Skeleton } from '../ui/Skeleton';

/**
 * Mini painel da barra lateral: quantas salas estão livres agora e a próxima reunião
 * de quem está logado. Usa as mesmas consultas da tela inicial (ficam em cache).
 */
export function PainelAgora({ usuarioId }: { usuarioId: string }) {
  const agora = useAgora();
  const hoje = hojeNoFuso(agora);
  const panorama = usePanoramaDoDia(hoje, agora, usuarioId);
  const minhas = useMinhasReservas('proximas', 6);
  const proxima = minhas.data?.[0];

  let livresTexto: string | null = null;
  if (panorama.pronto) {
    const n = panorama.livres.length;
    livresTexto = panorama.expedienteAcabou
      ? 'Fora do horário de reservas'
      : n === 0
        ? 'Nenhuma sala livre agora'
        : `${n} ${n === 1 ? 'sala livre' : 'salas livres'} agora`;
  }

  let proximaTexto: string | null = null;
  if (proxima) {
    const jaComecou = new Date(proxima.inicio) <= agora;
    const dia = dataDoInstante(proxima.inicio);
    const quando = proxima.diaInteiro ? 'dia inteiro' : formatHora(proxima.inicio);
    proximaTexto = jaComecou
      ? `Agora: ${proxima.sala.nome}, até ${formatHora(proxima.fim)}`
      : `${dia === hoje ? 'Hoje' : formatDiaCurto(proxima.inicio)}, ${quando} · ${proxima.sala.nome}`;
  }

  if (panorama.erro && !proxima) return null;

  return (
    <section aria-label="Agora" className="rounded-xl bg-canvas p-3 text-sm">
      <p className="px-1 text-[11px] font-semibold tracking-wider text-muted uppercase">Agora</p>
      {livresTexto ? (
        <Link
          to="/calendario?visao=agenda"
          className="mt-1.5 flex items-center gap-2 rounded-lg px-1 py-1.5 font-medium transition-colors hover:bg-paper"
        >
          <span aria-hidden className="relative inline-block size-2 shrink-0 rounded-full bg-ok">
            {panorama.pronto && panorama.livres.length > 0 && (
              <span className="absolute inset-0 animate-pulsar rounded-full bg-ok" />
            )}
          </span>
          {livresTexto}
        </Link>
      ) : (
        !panorama.erro && <Skeleton className="mt-2 h-4 w-36" />
      )}
      {proxima && proximaTexto && (
        <Link
          to={`/reservas/${proxima.id}`}
          className="mt-0.5 block rounded-lg px-1 py-1.5 transition-colors hover:bg-paper"
        >
          <span className="block text-xs text-muted">Sua próxima reunião</span>
          <span className="line-clamp-2 block font-medium">{proximaTexto}</span>
        </Link>
      )}
    </section>
  );
}
