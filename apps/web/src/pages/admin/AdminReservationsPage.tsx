import { dataValida, hojeNoFuso, somarDias } from '@reserva/shared';
import { SearchX } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Checkbox, Field, Input, Select } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { useSessao } from '../../features/auth/session';
import { useReservasPeriodo } from '../../features/reservas/api';
import { ListaReservas } from '../../features/reservas/ListaReservas';
import { useSalas } from '../../features/salas/api';
import { useUsuarios } from '../../features/users/api';
import { errorMessage } from '../../lib/forms';
import { avisar } from '../../features/avisos/store';
import { SkeletonLista } from '../../components/ui/Skeleton';

const MAX_DIAS = 62;

/** Todas as reservas, com filtros por período, sala, responsável e situação. */
export function AdminReservationsPage() {
  const hoje = hojeNoFuso();
  const [params, setParams] = useSearchParams();
  const de = params.get('de') ?? hoje;
  const ate = params.get('ate') ?? somarDias(hoje, 30);
  const salaId = params.get('sala') ?? '';
  const usuarioId = params.get('pessoa') ?? '';
  const incluirCanceladas = params.get('canceladas') === '1';

  const { data: usuario } = useSessao();
  const salas = useSalas(true);
  const usuarios = useUsuarios();

  const erroPeriodo = !dataValida(de)
    ? 'Informe a data inicial.'
    : !dataValida(ate)
      ? 'Informe a data final.'
      : ate < de
        ? 'A data final deve ser igual ou posterior à inicial.'
        : ate > somarDias(de, MAX_DIAS)
          ? `Consulte no máximo ${MAX_DIAS} dias por vez.`
          : null;

  const reservas = useReservasPeriodo(
    {
      dataInicio: de,
      dataFim: ate,
      salaId: salaId || undefined,
      usuarioId: usuarioId || undefined,
      incluirCanceladas,
    },
    { enabled: !erroPeriodo, manterAnterior: true },
  );

  function alterar(mudancas: Record<string, string>) {
    const novo = new URLSearchParams(params);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) novo.set(chave, valor);
      else novo.delete(chave);
    }
    setParams(novo, { replace: true });
  }

  const lista = reservas.data ?? [];

  return (
    <>
      <PageHeader
        title="Reservas"
        description="Todas as reservas, de todas as pessoas. Filtre, consulte e cancele quando necessário."
      />

      <Panel className="mb-4">
        <form
          aria-label="Filtros"
          onSubmit={(e) => e.preventDefault()}
          // Datas lado a lado já no celular (a partir de 370px); sala e responsável em linha própria.
          className="grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-4"
        >
          <Field
            label="De"
            className="col-span-2 min-[370px]:col-span-1"
            error={!dataValida(de) ? (erroPeriodo ?? undefined) : undefined}
          >
            <Input type="date" value={de} onChange={(e) => alterar({ de: e.target.value })} />
          </Field>
          <Field
            label="Até"
            className="col-span-2 min-[370px]:col-span-1"
            error={dataValida(de) ? (erroPeriodo ?? undefined) : undefined}
          >
            <Input type="date" value={ate} onChange={(e) => alterar({ ate: e.target.value })} />
          </Field>
          <Field label="Sala" className="col-span-2 sm:col-span-1">
            <Select value={salaId} onChange={(e) => alterar({ sala: e.target.value })}>
              <option value="">Todas as salas</option>
              {(salas.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ativo ? s.nome : `${s.nome} (desativada)`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Responsável" className="col-span-2 sm:col-span-1">
            <Select value={usuarioId} onChange={(e) => alterar({ pessoa: e.target.value })}>
              <option value="">Todas as pessoas</option>
              {(usuarios.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.ativo ? u.nome : `${u.nome} (desativado)`}
                </option>
              ))}
            </Select>
          </Field>
          <div className="col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:col-span-4">
            <div role="group" aria-label="Atalhos de período" className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => alterar({ de: hoje, ate: hoje })}
              >
                Hoje
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => alterar({ de: hoje, ate: somarDias(hoje, 30) })}
              >
                Próximos 30 dias
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => alterar({ de: somarDias(hoje, -30), ate: hoje })}
              >
                Últimos 30 dias
              </Button>
            </div>
            <Checkbox
              label="Incluir canceladas"
              checked={incluirCanceladas}
              onChange={(e) => alterar({ canceladas: e.target.checked ? '1' : '' })}
            />
          </div>
        </form>
      </Panel>

      {(salas.isError || usuarios.isError) && (
        <Alert tone="error" title={errorMessage(salas.error ?? usuarios.error)} className="mb-4" />
      )}
      {!erroPeriodo && reservas.isPending && <SkeletonLista label="Carregando reservas" />}
      {!erroPeriodo && reservas.isError && (
        <Alert tone="error" title={errorMessage(reservas.error)} />
      )}

      {!erroPeriodo && reservas.isSuccess && (
        <>
          <p className="mb-2 text-sm text-muted" role="status">
            {lista.length === 1 ? '1 reserva encontrada.' : `${lista.length} reservas encontradas.`}
          </p>
          {lista.length === 0 ? (
            <Panel>
              <EmptyState
                icon={SearchX}
                title="Nenhuma reserva com esses filtros"
                description="Amplie o período ou remova algum filtro."
              />
            </Panel>
          ) : (
            <ListaReservas
              reservas={lista}
              rotulo="Reservas encontradas"
              mostrarResponsavel
              usuarioId={usuario?.id}
              onCancelada={(r) =>
                avisar(`Reserva de ${r.responsavel.nome} cancelada. O horário ficou livre.`)
              }
            />
          )}
        </>
      )}
    </>
  );
}
