import { hojeNoFuso } from '@reserva/shared';
import { Link } from 'react-router';
import { Panel } from '../components/ui/Panel';
import { useSessao } from '../features/auth/session';
import { Atalhos } from '../features/inicio/Atalhos';
import { LivresAgora } from '../features/inicio/LivresAgora';
import { NumerosDoDia } from '../features/inicio/NumerosDoDia';
import { ProximaReuniao } from '../features/inicio/ProximaReuniao';
import { usePanoramaDoDia } from '../features/inicio/usePanoramaDoDia';
import { ProximasReunioes } from '../features/reservas/ProximasReunioes';
import { SystemStatus } from '../features/system/SystemStatus';
import { formatLongDate } from '../lib/format';
import { useAgora } from '../lib/useAgora';

export function HomePage() {
  const { data: usuario } = useSessao();
  const primeiroNome = usuario?.nome.split(' ')[0];
  const agora = useAgora();
  const hoje = hojeNoFuso(agora);
  const panorama = usePanoramaDoDia(hoje, agora, usuario?.id);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">
          {formatLongDate(agora)}
        </p>
        <h1 className="mt-1 text-title font-semibold tracking-tight lg:text-[2.125rem]">
          {primeiroNome ? `Olá, ${primeiroNome}` : 'Início'}
        </h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr] [&>*]:min-w-0">
        <ProximaReuniao agora={agora} hoje={hoje} />
        <LivresAgora panorama={panorama} hoje={hoje} />
      </div>

      <NumerosDoDia panorama={panorama} />
      <Atalhos />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] [&>*]:min-w-0">
        <Panel
          title="Próximas reuniões"
          actions={
            <Link to="/minhas-reservas" className="text-sm font-semibold hover:underline">
              Ver todas →
            </Link>
          }
        >
          <ProximasReunioes hoje={hoje} />
        </Panel>
        <Panel title="Situação do sistema">
          <SystemStatus />
        </Panel>
      </div>
    </div>
  );
}
