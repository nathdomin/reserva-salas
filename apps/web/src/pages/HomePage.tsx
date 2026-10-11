import { Plus } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { useSessao } from '../features/auth/session';
import { ProximasReunioes } from '../features/reservas/ProximasReunioes';
import { SystemStatus } from '../features/system/SystemStatus';
import { formatLongDate } from '../lib/format';

export function HomePage() {
  const { data: usuario } = useSessao();
  const primeiroNome = usuario?.nome.split(' ')[0];
  const hoje = formatLongDate(new Date());

  return (
    <>
      <PageHeader
        title="Início"
        description={primeiroNome ? `Olá, ${primeiroNome}. ${hoje}.` : hoje}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Panel
          title="Próximas reuniões"
          actions={
            <ButtonLink to="/reservas/nova" size="sm" variant="ghost">
              <Plus aria-hidden className="size-4" />
              Nova
            </ButtonLink>
          }
        >
          <ProximasReunioes />
        </Panel>

        <Panel title="Situação do sistema">
          <SystemStatus />
        </Panel>
      </div>
    </>
  );
}
