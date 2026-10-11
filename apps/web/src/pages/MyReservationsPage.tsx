import { CalendarClock, History, Plus } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { Spinner } from '../components/ui/Spinner';
import { useSessao } from '../features/auth/session';
import { useMinhasReservas } from '../features/reservas/api';
import { ListaReservas } from '../features/reservas/ListaReservas';
import { cn } from '../lib/cn';
import { errorMessage } from '../lib/forms';

type Aba = 'proximas' | 'anteriores';

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: 'proximas', rotulo: 'Próximas' },
  { valor: 'anteriores', rotulo: 'Anteriores e canceladas' },
];

const PASSO = 20;
const MAXIMO = 100;

export function MyReservationsPage() {
  const [params, setParams] = useSearchParams();
  const aba: Aba = params.get('aba') === 'anteriores' ? 'anteriores' : 'proximas';
  const [limite, setLimite] = useState(PASSO);
  const [aviso, setAviso] = useState<string | null>(null);
  const { data: usuario } = useSessao();
  const reservas = useMinhasReservas(aba, limite);

  function trocarAba(nova: Aba) {
    setAviso(null);
    setLimite(PASSO);
    setParams(nova === 'proximas' ? {} : { aba: nova });
  }

  const lista = reservas.data ?? [];

  return (
    <>
      <PageHeader
        title="Minhas reservas"
        description="Suas próximas reuniões e o histórico das anteriores."
        actions={
          <ButtonLink to="/reservas/nova">
            <Plus aria-hidden className="size-4" strokeWidth={2.5} />
            Nova reserva
          </ButtonLink>
        }
      />

      <div role="tablist" aria-label="Período" className="mb-4 flex gap-1 border-b border-line">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            role="tab"
            id={`aba-${a.valor}`}
            aria-selected={aba === a.valor}
            aria-controls="painel-reservas"
            onClick={() => trocarAba(a.valor)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-[15px] font-semibold',
              aba === a.valor
                ? 'border-brand text-ink'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="painel-reservas" aria-labelledby={`aba-${aba}`}>
        {aviso && <Alert tone="success" title={aviso} className="mb-4" />}
        {reservas.isPending && <Spinner label="Carregando suas reservas" />}
        {reservas.isError && <Alert tone="error" title={errorMessage(reservas.error)} />}

        {reservas.isSuccess && lista.length === 0 && (
          <Panel>
            {aba === 'proximas' ? (
              <EmptyState
                icon={CalendarClock}
                title="Nenhuma reunião agendada"
                description="Quando você reservar uma sala, a reunião aparece aqui."
                action={
                  <ButtonLink to="/reservas/nova" variant="secondary" size="sm">
                    Reservar uma sala
                  </ButtonLink>
                }
              />
            ) : (
              <EmptyState
                icon={History}
                title="Nenhuma reserva anterior"
                description="Reuniões que já aconteceram e reservas canceladas aparecem aqui."
              />
            )}
          </Panel>
        )}

        {lista.length > 0 && (
          <>
            <ListaReservas
              reservas={lista}
              rotulo={aba === 'proximas' ? 'Próximas reservas' : 'Reservas anteriores'}
              usuarioId={usuario?.id}
              onCancelada={() =>
                setAviso('Reserva cancelada. O horário ficou livre para outras pessoas.')
              }
            />
            {lista.length >= limite && limite < MAXIMO && (
              <Button
                variant="secondary"
                className="mt-4"
                disabled={reservas.isFetching}
                onClick={() => setLimite((l) => Math.min(l + PASSO, MAXIMO))}
              >
                {reservas.isFetching ? 'Carregando…' : 'Mostrar mais'}
              </Button>
            )}
            {lista.length >= MAXIMO && (
              <p className="mt-4 text-sm text-muted">
                Mostrando as {MAXIMO} mais recentes. Para períodos mais antigos, use o calendário.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
