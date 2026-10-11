import { DoorClosed } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Alert } from '../components/ui/Alert';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { Spinner } from '../components/ui/Spinner';
import { useSessao } from '../features/auth/session';
import { useConfiguracoes, useCriarReserva } from '../features/reservas/api';
import { ReservaForm, valoresIniciais } from '../features/reservas/ReservaForm';
import { useSalas } from '../features/salas/api';

export function NewReservationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: usuario } = useSessao();
  const config = useConfiguracoes();
  const salas = useSalas();
  const criar = useCriarReserva();

  const inicial = useMemo(
    () =>
      config.data
        ? valoresIniciais(config.data, {
            salaId: params.get('salaId'),
            data: params.get('data'),
            inicio: params.get('inicio'),
          })
        : null,
    [config.data, params],
  );

  return (
    <>
      <PageHeader
        title="Nova reserva"
        description="Escolha a sala, a data e o horário da reunião."
      />

      {(config.isPending || salas.isPending) && <Spinner label="Carregando salas" />}

      {(config.isError || salas.isError) && (
        <Alert
          tone="error"
          title="Não foi possível carregar as salas"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void config.refetch();
                void salas.refetch();
              }}
            >
              Tentar de novo
            </Button>
          }
        />
      )}

      {salas.isSuccess && salas.data.length === 0 && (
        <Panel>
          <EmptyState
            icon={DoorClosed}
            title="Nenhuma sala disponível"
            description={
              usuario?.perfil === 'ADMIN'
                ? 'Cadastre as salas de reunião para que possam ser reservadas.'
                : 'Ainda não há salas cadastradas. Fale com o administrador do sistema.'
            }
            action={
              usuario?.perfil === 'ADMIN' ? (
                <ButtonLink to="/admin/salas" variant="secondary" size="sm">
                  Cadastrar salas
                </ButtonLink>
              ) : undefined
            }
          />
        </Panel>
      )}

      {config.data && inicial && salas.isSuccess && salas.data.length > 0 && usuario && (
        <ReservaForm
          config={config.data}
          salas={salas.data}
          inicial={inicial}
          responsavel={usuario.nome}
          textoBotao="Confirmar reserva"
          enviando={criar.isPending}
          erro={criar.error}
          onSubmit={(dados) =>
            criar.mutate(dados, {
              onSuccess: (reserva) =>
                navigate(`/reservas/${reserva.id}`, {
                  state: { aviso: 'Reserva confirmada.' },
                }),
            })
          }
          onCancel={() => navigate(-1)}
        />
      )}
    </>
  );
}
