import { partesNoFuso, type Sala } from '@reserva/shared';
import { useNavigate, useParams } from 'react-router';
import { Alert } from '../components/ui/Alert';
import { ButtonLink } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Spinner } from '../components/ui/Spinner';
import { useConfiguracoes, useEditarReserva, useReserva } from '../features/reservas/api';
import { ReservaForm } from '../features/reservas/ReservaForm';
import { useSalas } from '../features/salas/api';
import { errorMessage } from '../lib/forms';
import { avisar } from '../features/avisos/store';
import { formatDiaCurto, formatHorario } from '../lib/format';

export function EditReservationPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const reserva = useReserva(id);
  const config = useConfiguracoes();
  const salas = useSalas();
  const editar = useEditarReserva(id);

  const r = reserva.data;
  const carregando = reserva.isPending || config.isPending || salas.isPending;
  const erro = reserva.error ?? config.error ?? salas.error;

  return (
    <>
      <PageHeader title="Editar reserva" />

      {carregando && !erro && <Spinner label="Carregando reserva" />}
      {erro && <Alert tone="error" title={errorMessage(erro)} />}

      {r && !r.podeEditar && (
        <Alert
          tone="error"
          title="Esta reserva não pode mais ser alterada"
          action={
            <ButtonLink to={`/reservas/${id}`} variant="secondary" size="sm">
              Ver detalhes
            </ButtonLink>
          }
        >
          Só é possível alterar reservas ativas que ainda não começaram (ou, para administradores,
          que ainda não terminaram).
        </Alert>
      )}

      {r?.podeEditar && config.data && salas.data && (
        <ReservaForm
          key={`${r.id}-${r.versao}`}
          config={config.data}
          salas={
            // A sala atual aparece mesmo se tiver sido desativada (sem poder ser escolhida de novo).
            salas.data.some((s) => s.id === r.sala.id)
              ? salas.data
              : [
                  ...salas.data,
                  {
                    ...r.sala,
                    capacidade: 0,
                    recursos: [],
                    descricao: null,
                    ativo: false,
                  } satisfies Sala,
                ]
          }
          inicial={{
            salaId: r.sala.id,
            data: partesNoFuso(new Date(r.inicio)).data,
            diaInteiro: r.diaInteiro,
            horaInicio: partesNoFuso(new Date(r.inicio)).hora,
            horaFim: partesNoFuso(new Date(r.fim)).hora,
            motivo: r.motivo,
            participantes: r.participantes?.toString() ?? '',
          }}
          responsavel={r.responsavel.nome}
          reservaId={r.id}
          textoBotao="Salvar alterações"
          enviando={editar.isPending}
          erro={editar.error}
          onSubmit={(dados) =>
            editar.mutate(
              { ...dados, versao: r.versao },
              {
                onSuccess: (reserva) => {
                  avisar(
                    'Reserva atualizada.',
                    `${reserva.sala.nome} · ${formatDiaCurto(reserva.inicio)}, ${formatHorario(reserva.inicio, reserva.fim, reserva.diaInteiro)}`,
                  );
                  navigate(`/reservas/${reserva.id}`);
                },
              },
            )
          }
          onCancel={() => navigate(`/reservas/${id}`)}
        />
      )}
    </>
  );
}
