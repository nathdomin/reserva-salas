import { loginSchema } from '@reserva/shared';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { destinoSeguro } from '../components/auth/guards';
import { BrandMark } from '../components/layout/BrandMark';
import logo from '../assets/logo-Empresa-Empresa.webp';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Spinner } from '../components/ui/Spinner';
import { useLogin, useSessao } from '../features/auth/session';
import { cn } from '../lib/cn';
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
    <main className="min-h-dvh bg-paper lg:grid lg:grid-cols-[46%_1fr]">
      {/* Lado da marca: faixa vermelha no celular, metade da tela no computador. */}
      <section className="relative overflow-hidden bg-[radial-gradient(110%_80%_at_0%_0%,var(--color-brand)_0%,var(--color-brand-strong)_60%)] px-6 pt-7 pb-16 text-paper lg:flex lg:flex-col lg:p-12">
        <BrandMark invertida tamanho="lg" />
        <p className="mt-7 max-w-[14ch] text-3xl leading-tight font-semibold tracking-tight lg:mt-auto lg:text-5xl">
          Sua sala de reunião, em poucos toques.
        </p>
        <p className="mt-2 max-w-[34ch] text-md">
          Veja o que está livre agora, reserve e organize as reuniões do setor administrativo.
        </p>
        <p className="mt-auto hidden pt-10 text-sm text-paper/85 lg:block">
          Setor administrativo · uso interno
        </p>
        {/* "Blocos de reserva" decorativos, como no calendário. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -bottom-8 hidden h-64 w-90 lg:block"
        >
          {[
            'left-8 top-5 h-14 w-38',
            'left-50 top-0 h-24 w-32 bg-paper/20 [animation-delay:-2s]',
            'left-15 top-24 h-20 w-30 [animation-delay:-4s]',
            'left-50 top-29 h-14 w-38 border-ink/35 bg-ink/10 [animation-delay:-1s]',
          ].map((c) => (
            <div
              key={c}
              className={cn(
                'absolute animate-flutuar rounded-lg border-l-4 border-paper/70 bg-paper/15',
                c,
              )}
            />
          ))}
        </div>
      </section>

      {/* Formulário: cartão sobre a faixa no celular; coluna limpa no computador. */}
      <div className="relative -mt-8 px-4 pb-10 lg:mt-0 lg:flex lg:flex-col lg:justify-center lg:px-18">
        {/* Logo oficial no lado branco, com respiro (onde ele aparece do jeito certo). */}
        <img
          src={logo}
          alt="Empresa"
          width={84}
          height={44}
          className="absolute top-12 left-18 hidden h-11 w-auto lg:block"
        />
        <div className="mx-auto w-full max-w-sm animate-subir rounded-xl border border-line bg-paper p-6 shadow-card lg:mx-0 lg:border-0 lg:p-0 lg:shadow-none">
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-1 text-md text-muted">Use seu e-mail corporativo e sua senha.</p>

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

        <p className="mx-auto mt-6 max-w-sm text-sm text-muted lg:mx-0">
          Não tem acesso ou esqueceu a senha? Fale com o administrador do sistema.
        </p>
        <p className="mt-8 flex items-center justify-center gap-2.5 text-xs text-muted lg:hidden">
          <img
            src={logo}
            alt="Empresa"
            width={50}
            height={26}
            className="h-[26px] w-auto"
          />
          Setor administrativo
        </p>
      </div>
    </main>
  );
}
