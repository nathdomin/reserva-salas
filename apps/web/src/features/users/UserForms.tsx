import {
  atualizarUsuarioSchema,
  criarUsuarioSchema,
  PERFIL_LABEL,
  PERFIS,
  redefinirSenhaSchema,
  SENHA_MIN,
  type AtualizarUsuarioInput,
  type Perfil,
  type UsuarioAdmin,
} from '@reserva/shared';
import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { Panel } from '../../components/ui/Panel';
import { apiFieldErrors, errorMessage, zodFieldErrors, type FieldErrors } from '../../lib/forms';
import { useAtualizarUsuario, useCriarUsuario, useRedefinirSenha } from './api';

interface UserFormProps {
  /** Ausente = criar novo usuário. */
  usuario?: UsuarioAdmin;
  /** O administrador editando a si mesmo não pode mudar o próprio perfil. */
  ehVoceMesmo?: boolean;
  onCancel: () => void;
  onSaved: (mensagem: string) => void;
}

export function UserForm({ usuario, ehVoceMesmo = false, onCancel, onSaved }: UserFormProps) {
  const editando = Boolean(usuario);
  const criar = useCriarUsuario();
  const atualizar = useAtualizarUsuario();
  const mutation = editando ? atualizar : criar;

  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [perfil, setPerfil] = useState<Perfil>(usuario?.perfil ?? 'COLABORADOR');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState<FieldErrors>({});

  function enviar(event: FormEvent) {
    event.preventDefault();
    criar.reset();
    atualizar.reset();

    if (usuario) {
      const resultado = atualizarUsuarioSchema.safeParse({ nome, email, perfil });
      if (!resultado.success) return setErros(zodFieldErrors(resultado.error));
      setErros({});
      // Envia só o que mudou.
      const dados = Object.fromEntries(
        Object.entries(resultado.data).filter(
          ([campo, valor]) => usuario[campo as keyof UsuarioAdmin] !== valor,
        ),
      ) as AtualizarUsuarioInput;
      if (Object.keys(dados).length === 0) return onCancel();
      atualizar.mutate(
        { id: usuario.id, dados },
        {
          onSuccess: ({ usuario: u }) => onSaved(`Dados de ${u.nome} atualizados.`),
          onError: (error) => setErros(apiFieldErrors(error)),
        },
      );
      return;
    }

    const resultado = criarUsuarioSchema.safeParse({ nome, email, perfil, senha });
    if (!resultado.success) return setErros(zodFieldErrors(resultado.error));
    setErros({});
    criar.mutate(resultado.data, {
      onSuccess: (u) =>
        onSaved(`${u.nome} foi cadastrado(a). Informe a senha inicial a essa pessoa.`),
      onError: (error) => setErros(apiFieldErrors(error)),
    });
  }

  return (
    <Panel title={editando ? `Editar ${usuario?.nome}` : 'Novo usuário'} className="mb-6">
      {mutation.isError && (
        <Alert tone="error" title={errorMessage(mutation.error)} className="mb-4 bg-canvas" />
      )}
      <form onSubmit={enviar} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" error={erros.nome}>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </Field>
        <Field label="E-mail corporativo" error={erros.email}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field
          label="Perfil"
          error={erros.perfil}
          hint={ehVoceMesmo ? 'Você não pode alterar o seu próprio perfil.' : undefined}
        >
          <Select
            value={perfil}
            onChange={(e) => setPerfil(e.target.value as Perfil)}
            disabled={ehVoceMesmo}
          >
            {PERFIS.map((p) => (
              <option key={p} value={p}>
                {PERFIL_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        {!editando && (
          <Field
            label="Senha inicial"
            error={erros.senha}
            hint={`Mínimo de ${SENHA_MIN} caracteres. A pessoa pode trocá-la em Minha conta.`}
          >
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        )}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? 'Salvando…'
              : editando
                ? 'Salvar alterações'
                : 'Cadastrar usuário'}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
            Cancelar
          </Button>
        </div>
      </form>
    </Panel>
  );
}

interface ResetPasswordFormProps {
  usuario: UsuarioAdmin;
  onCancel: () => void;
  onSaved: (mensagem: string) => void;
}

export function ResetPasswordForm({ usuario, onCancel, onSaved }: ResetPasswordFormProps) {
  const redefinir = useRedefinirSenha();
  const [novaSenha, setNovaSenha] = useState('');
  const [erros, setErros] = useState<FieldErrors>({});

  function enviar(event: FormEvent) {
    event.preventDefault();
    redefinir.reset();
    const resultado = redefinirSenhaSchema.safeParse({ novaSenha });
    if (!resultado.success) return setErros(zodFieldErrors(resultado.error));
    setErros({});
    redefinir.mutate(
      { id: usuario.id, novaSenha: resultado.data.novaSenha },
      {
        onSuccess: () =>
          onSaved(
            `Senha de ${usuario.nome} redefinida. As sessões abertas dessa pessoa foram encerradas.`,
          ),
        onError: (error) => setErros(apiFieldErrors(error)),
      },
    );
  }

  return (
    <Panel title={`Redefinir a senha de ${usuario.nome}`} className="mb-6">
      {redefinir.isError && (
        <Alert tone="error" title={errorMessage(redefinir.error)} className="mb-4 bg-canvas" />
      )}
      <form onSubmit={enviar} noValidate className="flex max-w-md flex-col gap-4">
        <Field
          label="Nova senha"
          error={erros.novaSenha}
          hint={`Mínimo de ${SENHA_MIN} caracteres. Também desbloqueia o acesso, se estiver bloqueado.`}
        >
          <Input
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={redefinir.isPending}>
            {redefinir.isPending ? 'Salvando…' : 'Redefinir senha'}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={redefinir.isPending}>
            Cancelar
          </Button>
        </div>
      </form>
    </Panel>
  );
}
