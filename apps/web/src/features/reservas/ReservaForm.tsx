import {
  conflitoDetalhesSchema,
  emMinutos,
  ERROR_CODES,
  gerarHorarios,
  hojeNoFuso,
  paraHora,
  partesNoFuso,
  reservaInputSchema,
  somarDias,
  type ConflitoDetalhes,
  type Configuracoes,
  type Sala,
} from '@reserva/shared';
import { CalendarCheck2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, Input, Select } from '../../components/ui/Field';
import { Panel } from '../../components/ui/Panel';
import { Spinner } from '../../components/ui/Spinner';
import { ApiError } from '../../lib/api';
import { formatHorario, formatLongDate } from '../../lib/format';
import { apiFieldErrors, errorMessage, zodFieldErrors, type FieldErrors } from '../../lib/forms';
import { useReservasPeriodo } from './api';

export interface ValoresReserva {
  salaId: string;
  data: string;
  diaInteiro: boolean;
  horaInicio: string;
  horaFim: string;
  motivo: string;
  participantes: string;
}

interface ReservaFormProps {
  config: Configuracoes;
  salas: Sala[];
  inicial: ValoresReserva;
  /** Nome de quem fica responsável (quem está logado, ou o dono na edição). */
  responsavel: string;
  /** Na edição: a própria reserva não aparece como "ocupado". */
  reservaId?: string;
  textoBotao: string;
  enviando: boolean;
  erro: unknown;
  onSubmit: (dados: ReturnType<typeof reservaInputSchema.parse>) => void;
  onCancel: () => void;
}

/** Término padrão: 1 hora depois do início, sem passar do fechamento. */
function terminoPadrao(horaInicio: string, config: Configuracoes) {
  const fim = Math.min(emMinutos(horaInicio) + 60, emMinutos(config.horarioFim));
  return paraHora(fim);
}

/** Valores iniciais de uma reserva nova: próximo horário livre do relógio. */
export function valoresIniciais(
  config: Configuracoes,
  params: { salaId?: string | null; data?: string | null; inicio?: string | null },
  agora = new Date(),
): ValoresReserva {
  const g = config.granularidadeMinutos;
  const hoje = hojeNoFuso(agora);
  const agoraMin = emMinutos(partesNoFuso(agora).hora);
  const proximo = Math.ceil(agoraMin / g) * g;
  const ultimoInicio = emMinutos(config.horarioFim) - g;

  let data = params.data ?? hoje;
  let horaInicio = params.inicio ?? '';
  if (!horaInicio) {
    if (data === hoje && proximo <= ultimoInicio) {
      horaInicio = paraHora(Math.max(proximo, emMinutos(config.horarioInicio)));
    } else {
      if (data === hoje) data = somarDias(hoje, 1);
      horaInicio = paraHora(Math.max(9 * 60, emMinutos(config.horarioInicio)));
    }
  }
  return {
    salaId: params.salaId ?? '',
    data,
    diaInteiro: false,
    horaInicio,
    horaFim: terminoPadrao(horaInicio, config),
    motivo: '',
    participantes: '',
  };
}

export function ReservaForm(props: ReservaFormProps) {
  const { config, salas } = props;
  const [v, setV] = useState<ValoresReserva>(props.inicial);
  const [erros, setErros] = useState<FieldErrors>({});
  // Quando a pessoa muda algum campo depois de um erro da API, o aviso antigo some.
  const [erroOculto, setErroOculto] = useState<unknown>(null);
  const erroApi = props.erro && props.erro !== erroOculto ? props.erro : null;

  const hoje = hojeNoFuso();
  const ultimaData = somarDias(hoje, config.antecedenciaMaximaDias);
  const horarios = useMemo(
    () => gerarHorarios(config.horarioInicio, config.horarioFim, config.granularidadeMinutos),
    [config],
  );
  const inicios = horarios.slice(0, -1);
  const terminos = horarios.filter((h) => {
    const duracao = emMinutos(h) - emMinutos(v.horaInicio);
    return duracao >= config.duracaoMinimaMinutos && duracao <= config.duracaoMaximaMinutos;
  });

  const sala = salas.find((s) => s.id === v.salaId);
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(v.data);
  const ocupacao = useReservasPeriodo(
    { dataInicio: v.data, dataFim: v.data, salaId: v.salaId },
    { enabled: Boolean(v.salaId) && dataOk },
  );
  const ocupados = (ocupacao.data ?? []).filter(
    (r) => r.status === 'ATIVA' && r.id !== props.reservaId,
  );

  // Conflito devolvido pela API (com sugestões), enquanto o usuário não muda nada.
  const conflito: ConflitoDetalhes | null = (() => {
    if (!(erroApi instanceof ApiError) || erroApi.code !== ERROR_CODES.RESERVA_CONFLITO) {
      return null;
    }
    const parsed = conflitoDetalhesSchema.safeParse(erroApi.details);
    return parsed.success ? parsed.data : null;
  })();

  function alterar(campos: Partial<ValoresReserva>) {
    setV((atual) => {
      const novo = { ...atual, ...campos };
      if (campos.horaInicio && emMinutos(novo.horaFim) <= emMinutos(campos.horaInicio)) {
        novo.horaFim = terminoPadrao(campos.horaInicio, config);
      }
      return novo;
    });
    setErroOculto(props.erro);
  }

  function enviar(event: FormEvent) {
    event.preventDefault();
    const resultado = reservaInputSchema.safeParse({
      salaId: v.salaId,
      data: v.data,
      diaInteiro: v.diaInteiro,
      horaInicio: v.diaInteiro ? undefined : v.horaInicio,
      horaFim: v.diaInteiro ? undefined : v.horaFim,
      motivo: v.motivo,
      participantes: v.participantes.trim() === '' ? null : Number(v.participantes),
    });
    if (!resultado.success) {
      setErros(zodFieldErrors(resultado.error));
      return;
    }
    if (sala && resultado.data.participantes && resultado.data.participantes > sala.capacidade) {
      setErros({ participantes: `A sala ${sala.nome} comporta até ${sala.capacidade} pessoa(s).` });
      return;
    }
    setErros({});
    props.onSubmit(resultado.data);
  }

  // Erros por campo vindos da API, enquanto o formulário não é reenviado.
  const errosCampo = { ...apiFieldErrors(erroApi), ...erros };
  const erroGeral =
    erroApi && !conflito && Object.keys(apiFieldErrors(erroApi)).length === 0
      ? errorMessage(erroApi)
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <Panel>
        {erroGeral && <Alert tone="error" title={erroGeral} className="mb-5 bg-canvas" />}

        {conflito && (
          <Alert tone="error" title={errorMessage(erroApi)} className="mb-5 bg-canvas">
            {conflito.sugestoes.horarios.length > 0 && (
              <div className="mt-3">
                <p className="font-medium text-ink">Horários livres nesta sala:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {conflito.sugestoes.horarios.map((h) => (
                    <Button
                      key={h.horaInicio}
                      size="sm"
                      variant="secondary"
                      onClick={() => alterar({ horaInicio: h.horaInicio, horaFim: h.horaFim })}
                    >
                      {h.horaInicio} às {h.horaFim}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {conflito.sugestoes.salas.length > 0 && (
              <div className="mt-3">
                <p className="font-medium text-ink">Outras salas livres neste horário:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {conflito.sugestoes.salas.map((s) => (
                    <Button
                      key={s.id}
                      size="sm"
                      variant="secondary"
                      onClick={() => alterar({ salaId: s.id })}
                    >
                      {s.nome} ({s.localizacao}, até {s.capacidade})
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {conflito.sugestoes.horarios.length === 0 && conflito.sugestoes.salas.length === 0 && (
              <p className="mt-2">Não há outro horário nem outra sala livre. Tente outra data.</p>
            )}
          </Alert>
        )}

        <form onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label="Sala" error={errosCampo.salaId} className="sm:col-span-2">
            <Select value={v.salaId} onChange={(e) => alterar({ salaId: e.target.value })}>
              <option value="">Selecione a sala</option>
              {salas.map((s) => (
                <option key={s.id} value={s.id} disabled={!s.ativo}>
                  {`${s.nome}, ${s.localizacao} (até ${s.capacidade} pessoas)${s.ativo ? '' : ' (desativada)'}`}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Data" error={errosCampo.data}>
            <Input
              type="date"
              min={hoje}
              max={ultimaData}
              value={v.data}
              onChange={(e) => alterar({ data: e.target.value })}
            />
          </Field>

          <div className="flex items-end pb-2">
            <Checkbox
              label="Dia inteiro"
              hint={`Ocupa a sala das ${config.horarioInicio} às ${config.horarioFim}.`}
              checked={v.diaInteiro}
              onChange={(e) => alterar({ diaInteiro: e.target.checked })}
            />
          </div>

          {!v.diaInteiro && (
            <>
              <Field label="Início" error={errosCampo.horaInicio}>
                <Select
                  value={v.horaInicio}
                  onChange={(e) => alterar({ horaInicio: e.target.value })}
                >
                  {inicios.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Término" error={errosCampo.horaFim}>
                <Select value={v.horaFim} onChange={(e) => alterar({ horaFim: e.target.value })}>
                  {terminos.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}

          <Field label="Motivo da reunião" error={errosCampo.motivo} className="sm:col-span-2">
            <Input
              value={v.motivo}
              maxLength={200}
              onChange={(e) => alterar({ motivo: e.target.value })}
              placeholder="Ex.: Planejamento mensal"
            />
          </Field>

          <Field
            label="Participantes (opcional)"
            error={errosCampo.participantes}
            hint={sala ? `Capacidade da sala: ${sala.capacidade} pessoas.` : undefined}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={sala?.capacidade}
              value={v.participantes}
              onChange={(e) => alterar({ participantes: e.target.value })}
            />
          </Field>

          <div className="flex flex-col justify-end gap-1.5">
            <span className="text-sm font-medium">Responsável</span>
            <p className="flex h-10 items-center rounded-md bg-canvas px-3 text-md">
              {props.responsavel}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 sm:col-span-2">
            <Button type="submit" disabled={props.enviando}>
              <CalendarCheck2 aria-hidden className="size-4" />
              {props.enviando ? 'Salvando…' : props.textoBotao}
            </Button>
            <Button variant="secondary" onClick={props.onCancel} disabled={props.enviando}>
              Cancelar
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title="Ocupação da sala">
        {!v.salaId || !dataOk ? (
          <p className="text-sm text-muted">
            Escolha a sala e a data para ver os horários ocupados.
          </p>
        ) : ocupacao.isPending ? (
          <Spinner label="Consultando horários" />
        ) : ocupacao.isError ? (
          <p className="text-sm text-muted">Não foi possível consultar a ocupação agora.</p>
        ) : (
          <div>
            <p className="text-sm text-muted">
              {sala?.nome}, {formatLongDate(`${v.data}T12:00:00-03:00`)}
            </p>
            {ocupados.length === 0 ? (
              <p className="mt-3 font-medium">Sala livre o dia todo.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2" aria-label="Horários ocupados">
                {ocupados.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-md border-l-4 border-brand bg-brand-soft px-3 py-2"
                  >
                    <p className="text-sm font-semibold">
                      {formatHorario(r.inicio, r.fim, r.diaInteiro)}
                    </p>
                    <p className="text-sm">{r.motivo}</p>
                    <p className="text-xs text-muted">{r.responsavel.nome}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
