import { alterarSenhaSchema, SENHA_MIN } from '@reserva/shared';
import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { apiFieldErrors, errorMessage, zodFieldErrors, type FieldErrors } from '../../lib/forms';
import { useAlterarSenha } from './session';

interface FormTrocarSenhaProps {
  /** Rótulo do campo da senha atual (na troca obrigatória, é a senha recebida do admin). */
  rotuloSenhaAtual?: string;
  textoBotao?: string;
  onSucesso: () => void;
}

/** Senha atual + nova senha com confirmação. Usado em Minha conta e na troca obrigatória. */
export function FormTrocarSenha({
  rotuloSenhaAtual = 'Senha atual',
  textoBotao = 'Trocar senha',
  onSucesso,
}: FormTrocarSenhaProps) {
  const alterar = useAlterarSenha();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState<FieldErrors>({});

  function enviar(event: FormEvent) {
    event.preventDefault();
    alterar.reset();

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
        onSucesso();
      },
      onError: (error) => setErros(apiFieldErrors(error)),
    });
  }

  return (
    <>
      {alterar.isError && Object.keys(erros).length === 0 && (
        <Alert tone="error" title={errorMessage(alterar.error)} className="mb-4 bg-canvas" />
      )}
      <form onSubmit={enviar} noValidate className="flex max-w-md flex-col gap-4">
        <Field label={rotuloSenhaAtual} error={erros.senhaAtual}>
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
            {alterar.isPending ? 'Salvando…' : textoBotao}
          </Button>
        </div>
      </form>
    </>
  );
}
