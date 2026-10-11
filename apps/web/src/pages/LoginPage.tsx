import { loginSchema } from '@reserva/shared';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { destinoSeguro } from '../components/auth/guards';
import { BrandMark } from '../components/layout/BrandMark';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Spinner } from '../components/ui/Spinner';
import { useLogin, useSessao } from '../features/auth/session';
import { errorMessage, zodFieldErrors, type FieldErrors } from '../lib/forms';

export function LoginPage() {
  const [params] = useSearchParams();
  const destino = destinoSeguro(params.get('voltar'));
  const navigate = useNavigate();
  const sessao = useSessao();
  const login = useLogin();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState<FieldErrors>({});

  if (sessao.data) return <Navigate to={destino} replace />;

  function enviar(event: FormEvent) {
    event.preventDefault();
    login.reset();
    const resultado = loginSchema.safeParse({ email, senha });
    if (!resultado.success) {
      setErros(zodFieldErrors(resultado.error));
      return;
    }
    setErros({});
    login.mutate(resultado.data, {
      onSuccess: () => navigate(destino, { replace: true }),
      onError: () => setSenha(''),
    });
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <BrandMark />
        </div>

        <div className="rounded-lg border border-line bg-paper p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-1 text-[15px] text-muted">Use seu e-mail corporativo e sua senha.</p>

          {sessao.isPending && <Spinner className="mt-6" label="Verificando sessão" />}

          {login.isError && (
            <Alert tone="error" title={errorMessage(login.error)} className="mt-6 bg-canvas" />
          )}

          <form onSubmit={enviar} noValidate className="mt-6 flex flex-col gap-4">
            <Field label="E-mail" error={erros.email}>
              <Input
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Senha" error={erros.senha}>
              <Input
                type="password"
                name="senha"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </Field>
            <Button type="submit" className="mt-2 w-full" disabled={login.isPending}>
              {login.isPending ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-sm text-muted">
          Não tem acesso ou esqueceu a senha? Fale com o administrador do sistema.
        </p>
      </div>
    </main>
  );
}
