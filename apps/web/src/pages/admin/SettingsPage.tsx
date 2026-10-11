import {
  atualizarConfiguracoesSchema,
  GRANULARIDADES,
  validarConfiguracoes,
  type AtualizarConfiguracoesInput,
  type Configuracoes,
} from '@reserva/shared';
import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, Input, Select } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { Spinner } from '../../components/ui/Spinner';
import { useAtualizarConfiguracoes } from '../../features/configuracoes/api';
import { useConfiguracoes } from '../../features/reservas/api';
import { apiFieldErrors, errorMessage, zodFieldErrors, type FieldErrors } from '../../lib/forms';

export function SettingsPage() {
  const config = useConfiguracoes();
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Regras de funcionamento das reservas. Valem para novas reservas e edições; as já feitas não mudam."
      />
      {config.isPending && <Spinner label="Carregando configurações" />}
      {config.isError && <Alert tone="error" title={errorMessage(config.error)} />}
      {config.data && <FormConfiguracoes atual={config.data} />}
    </>
  );
}

type Valores = Record<Exclude<keyof Configuracoes, 'motivoVisivelParaTodos'>, string> & {
  motivoVisivelParaTodos: boolean;
};

function paraValores(c: Configuracoes): Valores {
  return {
    motivoVisivelParaTodos: c.motivoVisivelParaTodos,
    horarioInicio: c.horarioInicio,
    horarioFim: c.horarioFim,
    granularidadeMinutos: String(c.granularidadeMinutos),
    duracaoMinimaMinutos: String(c.duracaoMinimaMinutos),
    duracaoMaximaMinutos: String(c.duracaoMaximaMinutos),
    antecedenciaMaximaDias: String(c.antecedenciaMaximaDias),
    intervaloEntreReunioesMinutos: String(c.intervaloEntreReunioesMinutos),
  };
}

const numero = (v: string) => (v.trim() === '' ? Number.NaN : Number(v));

function FormConfiguracoes({ atual }: { atual: Configuracoes }) {
  const salvar = useAtualizarConfiguracoes();
  const [v, setV] = useState<Valores>(() => paraValores(atual));
  const [erros, setErros] = useState<FieldErrors>({});
  const [aviso, setAviso] = useState<string | null>(null);

  function alterar(campos: Partial<Valores>) {
    setAviso(null);
    setV((anterior) => ({ ...anterior, ...campos }));
  }

  function enviar(event: FormEvent) {
    event.preventDefault();
    salvar.reset();
    const nova: Configuracoes = {
      motivoVisivelParaTodos: v.motivoVisivelParaTodos,
      horarioInicio: v.horarioInicio,
      horarioFim: v.horarioFim,
      granularidadeMinutos: numero(v.granularidadeMinutos),
      duracaoMinimaMinutos: numero(v.duracaoMinimaMinutos),
      duracaoMaximaMinutos: numero(v.duracaoMaximaMinutos),
      antecedenciaMaximaDias: numero(v.antecedenciaMaximaDias),
      intervaloEntreReunioesMinutos: numero(v.intervaloEntreReunioesMinutos),
    };
    // Envia só o que mudou.
    const mudancas: AtualizarConfiguracoesInput = {};
    for (const chave of Object.keys(nova) as (keyof Configuracoes)[]) {
      if (nova[chave] !== atual[chave]) Object.assign(mudancas, { [chave]: nova[chave] });
    }
    if (Object.keys(mudancas).length === 0) {
      setErros({});
      setAviso('Nada foi alterado.');
      return;
    }
    const resultado = atualizarConfiguracoesSchema.safeParse(mudancas);
    if (!resultado.success) {
      setErros(zodFieldErrors(resultado.error));
      return;
    }
    const regras = validarConfiguracoes(nova);
    if (regras.length > 0) {
      const porCampo: FieldErrors = {};
      for (const e of regras) porCampo[e.campo] ??= e.mensagem;
      setErros(porCampo);
      return;
    }
    setErros({});
    salvar.mutate(resultado.data, {
      onSuccess: (salva) => {
        setV(paraValores(salva));
        setAviso('Configurações salvas. As novas regras já valem para todos.');
      },
      onError: (error) => setErros(apiFieldErrors(error)),
    });
  }

  const e = erros;
  return (
    <form onSubmit={enviar} noValidate className="flex max-w-3xl flex-col gap-6">
      {aviso && <Alert tone="success" title={aviso} />}
      {salvar.isError && Object.keys(apiFieldErrors(salvar.error)).length === 0 && (
        <Alert tone="error" title={errorMessage(salvar.error)} />
      )}

      <Panel title="Privacidade">
        <Checkbox
          label="Motivo da reunião visível para todos os colaboradores"
          hint="Desmarcado, os colaboradores veem apenas “Reservado”. O responsável e os administradores sempre veem o motivo."
          checked={v.motivoVisivelParaTodos}
          onChange={(ev) => alterar({ motivoVisivelParaTodos: ev.target.checked })}
        />
      </Panel>

      <Panel title="Horários">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Início do expediente" error={e.horarioInicio}>
            <Input
              type="time"
              value={v.horarioInicio}
              onChange={(ev) => alterar({ horarioInicio: ev.target.value })}
            />
          </Field>
          <Field label="Fim do expediente" error={e.horarioFim}>
            <Input
              type="time"
              value={v.horarioFim}
              onChange={(ev) => alterar({ horarioFim: ev.target.value })}
            />
          </Field>
          <Field label="Intervalo dos horários" error={e.granularidadeMinutos}>
            <Select
              value={v.granularidadeMinutos}
              onChange={(ev) => alterar({ granularidadeMinutos: ev.target.value })}
            >
              {GRANULARIDADES.map((g) => (
                <option key={g} value={String(g)}>
                  {g} minutos
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel title="Duração e antecedência">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Duração mínima (minutos)" error={e.duracaoMinimaMinutos}>
            <Input
              type="number"
              inputMode="numeric"
              min={5}
              value={v.duracaoMinimaMinutos}
              onChange={(ev) => alterar({ duracaoMinimaMinutos: ev.target.value })}
            />
          </Field>
          <Field
            label="Duração máxima (minutos)"
            hint="Para ocupar a sala o dia todo, use a opção “Dia inteiro” da reserva."
            error={e.duracaoMaximaMinutos}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={5}
              value={v.duracaoMaximaMinutos}
              onChange={(ev) => alterar({ duracaoMaximaMinutos: ev.target.value })}
            />
          </Field>
          <Field
            label="Antecedência máxima (dias)"
            hint="Até quantos dias à frente é possível reservar."
            error={e.antecedenciaMaximaDias}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={v.antecedenciaMaximaDias}
              onChange={(ev) => alterar({ antecedenciaMaximaDias: ev.target.value })}
            />
          </Field>
          <Field
            label="Intervalo entre reuniões (minutos)"
            hint="Tempo livre obrigatório entre duas reuniões na mesma sala. 0 = podem ser seguidas."
            error={e.intervaloEntreReunioesMinutos}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={v.intervaloEntreReunioesMinutos}
              onChange={(ev) => alterar({ intervaloEntreReunioesMinutos: ev.target.value })}
            />
          </Field>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando…' : 'Salvar configurações'}
        </Button>
        <Button
          variant="secondary"
          disabled={salvar.isPending}
          onClick={() => {
            setV(paraValores(atual));
            setErros({});
            setAviso(null);
            salvar.reset();
          }}
        >
          Desfazer alterações
        </Button>
      </div>
    </form>
  );
}
