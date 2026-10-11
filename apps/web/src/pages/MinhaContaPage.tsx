import { alterarSenhaSchema, PERFIL_LABEL, SENHA_MIN } from '@reserva/shared';
import { useState, type FormEvent } from 'react';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { useAlterarSenha, useSessao } from '../features/auth/session';
import { apiFieldErrors, errorMessage, zodFieldErrors, type FieldErrors } from '../lib/forms';

export function MinhaContaPage() {
  const { data: usuario } = useSessao();
  const alterar = useAlterarSenha();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState<FieldErrors>({});
  const [sucesso, setSucesso] = useState(false);

  if (!usuario) return null;

  function enviar(event: FormEvent) {
    event.preventDefault();
    alterar.reset();
    setSucesso(false);

    const resultado = alterarSenhaSchema.safeParse({ senhaAtual, novaSenha });
    const novosErros = resultado.success ? {} : zodFieldErrors(resultado.error);
    if (novaSenha && confirmacao !== novaSenha) {
      novosErros.confirmacao = 'A confirmação não confere com a nova senha.';
    }
    setErros(novosErros);
    if (!resultado.success || Object.keys(novosErros).length > 0) return;

    alterar.mutate(resultado.data, {
      onSuccess: () => {
        setSenhaAtual('');
        setNovaSenha('');
        setConfirmacao('');
        setSucesso(true);
      },
      onError: (error) => setErros(apiFieldErrors(error)),
    });
  }

  return (
    <>
      <PageHeader title="Minha conta" description="Seus dados de acesso ao sistema." />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
        <Panel title="Dados">
          <dl className="flex flex-col gap-3 text-[15px]">
            <div>
              <dt className="text-sm text-muted">Nome</dt>
              <dd className="font-medium">{usuario.nome}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">E-mail</dt>
              <dd className="font-medium break-all">{usuario.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Perfil</dt>
              <dd className="font-medium">{PERFIL_LABEL[usuario.perfil]}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted">
            Para corrigir nome ou e-mail, fale com o administrador do sistema.
          </p>
        </Panel>

        <Panel title="Trocar senha">
          {sucesso && (
            <Alert tone="success" title="Senha alterada." className="mb-4 bg-canvas">
              Se você estava conectado em outros navegadores, essas sessões foram encerradas.
            </Alert>
          )}
          {alterar.isError && Object.keys(erros).length === 0 && (
            <Alert tone="error" title={errorMessage(alterar.error)} className="mb-4 bg-canvas" />
          )}
          <form onSubmit={enviar} noValidate className="flex max-w-md flex-col gap-4">
            <Field label="Senha atual" error={erros.senhaAtual}>
              <Input
                type="password"
                autoComplete="current-password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
              />
            </Field>
            <Field
              label="Nova senha"
              error={erros.novaSenha}
              hint={`Mínimo de ${SENHA_MIN} caracteres. Uma frase longa é mais segura e fácil de lembrar.`}
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
              />
            </Field>
            <Field label="Confirme a nova senha" error={erros.confirmacao}>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
              />
            </Field>
            <div>
              <Button type="submit" disabled={alterar.isPending}>
                {alterar.isPending ? 'Salvando…' : 'Trocar senha'}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
