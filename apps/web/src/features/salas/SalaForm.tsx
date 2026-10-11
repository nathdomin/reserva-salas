import { RECURSOS_SUGERIDOS, salaInputSchema, type Sala } from '@reserva/shared';
import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, Input, Textarea } from '../../components/ui/Field';
import { Panel } from '../../components/ui/Panel';
import { apiFieldErrors, errorMessage, zodFieldErrors, type FieldErrors } from '../../lib/forms';
import { useAtualizarSala, useCriarSala } from './api';

const sugeridos: readonly string[] = RECURSOS_SUGERIDOS;

interface SalaFormProps {
  sala?: Sala;
  onCancel: () => void;
  onSaved: (mensagem: string) => void;
}

export function SalaForm({ sala, onCancel, onSaved }: SalaFormProps) {
  const criar = useCriarSala();
  const atualizar = useAtualizarSala();
  const mutation = sala ? atualizar : criar;

  const [nome, setNome] = useState(sala?.nome ?? '');
  const [localizacao, setLocalizacao] = useState(sala?.localizacao ?? '');
  const [capacidade, setCapacidade] = useState(sala ? String(sala.capacidade) : '');
  const [marcados, setMarcados] = useState<string[]>(
    sala?.recursos.filter((r) => sugeridos.includes(r)) ?? [],
  );
  const [outros, setOutros] = useState(
    sala?.recursos.filter((r) => !sugeridos.includes(r)).join(', ') ?? '',
  );
  const [descricao, setDescricao] = useState(sala?.descricao ?? '');
  const [erros, setErros] = useState<FieldErrors>({});

  function alternar(recurso: string, marcado: boolean) {
    setMarcados((atual) =>
      marcado ? [...atual, recurso] : atual.filter((item) => item !== recurso),
    );
  }

  function enviar(event: FormEvent) {
    event.preventDefault();
    criar.reset();
    atualizar.reset();
    const recursos = [
      ...sugeridos.filter((r) => marcados.includes(r)),
      ...outros
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean),
    ];
    const resultado = salaInputSchema.safeParse({
      nome,
      localizacao,
      capacidade: capacidade.trim() === '' ? undefined : Number(capacidade),
      recursos,
      descricao: descricao.trim() || null,
    });
    if (!resultado.success) {
      setErros(zodFieldErrors(resultado.error));
      return;
    }
    setErros({});
    const onError = (error: unknown) => setErros(apiFieldErrors(error));
    if (sala) {
      atualizar.mutate(
        { id: sala.id, dados: resultado.data },
        { onSuccess: ({ sala: s }) => onSaved(`Sala ${s.nome} atualizada.`), onError },
      );
    } else {
      criar.mutate(resultado.data, {
        onSuccess: (s) => onSaved(`Sala ${s.nome} cadastrada. Ela já pode ser reservada.`),
        onError,
      });
    }
  }

  return (
    <Panel title={sala ? `Editar ${sala.nome}` : 'Nova sala'} className="mb-6">
      {mutation.isError && Object.keys(apiFieldErrors(mutation.error)).length === 0 && (
        <Alert tone="error" title={errorMessage(mutation.error)} className="mb-4 bg-canvas" />
      )}
      <form onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome da sala" error={erros.nome}>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus maxLength={80} />
        </Field>
        <Field label="Localização ou andar" error={erros.localizacao}>
          <Input
            value={localizacao}
            onChange={(e) => setLocalizacao(e.target.value)}
            placeholder="Ex.: 2º andar, ala B"
            maxLength={120}
          />
        </Field>
        <Field label="Capacidade (pessoas)" error={erros.capacidade}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={capacidade}
            onChange={(e) => setCapacidade(e.target.value)}
          />
        </Field>

        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">Recursos disponíveis</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {sugeridos.map((recurso) => (
              <Checkbox
                key={recurso}
                label={recurso}
                checked={marcados.includes(recurso)}
                onChange={(e) => alternar(recurso, e.target.checked)}
              />
            ))}
          </div>
        </fieldset>
        <Field
          label="Outros recursos"
          hint="Separe por vírgula. Ex.: Flipchart, Cadeiras extras"
          error={erros.recursos}
          className="sm:col-span-2"
        >
          <Input value={outros} onChange={(e) => setOutros(e.target.value)} />
        </Field>

        <Field label="Descrição (opcional)" error={erros.descricao} className="sm:col-span-2">
          <Textarea
            value={descricao}
            maxLength={1000}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </Field>

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando…' : sala ? 'Salvar alterações' : 'Cadastrar sala'}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
            Cancelar
          </Button>
        </div>
      </form>
    </Panel>
  );
}
