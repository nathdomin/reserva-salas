import { ShieldAlert } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useSessao } from '../../features/auth/session';
import { Alert } from '../ui/Alert';
import { Button, ButtonLink } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Panel } from '../ui/Panel';
import { Spinner } from '../ui/Spinner';

/** Destino seguro após o login: só caminhos internos (evita redirecionar para outro site). */
export function destinoSeguro(voltar: string | null): string {
  if (!voltar || !voltar.startsWith('/') || voltar.startsWith('//') || voltar.startsWith('/\\')) {
    return '/';
  }
  if (voltar === '/login' || voltar.startsWith('/login?')) return '/';
  return voltar;
}

/**
 * Só renderiza as rotas internas com uma sessão válida. Sem sessão, leva ao login e
 * lembra a página pedida. (Isto é só experiência de uso: quem protege os dados é a API.)
 */
export function RequireAuth() {
  const { data: usuario, isPending, isError, refetch, isFetching } = useSessao();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner label="Carregando" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto grid min-h-dvh max-w-md place-items-center px-4">
        <Alert
          tone="error"
          title="Não foi possível falar com o servidor"
          action={
            <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Tentando…' : 'Tentar de novo'}
            </Button>
          }
        >
          Verifique sua conexão. Se o problema continuar, avise o administrador do sistema.
        </Alert>
      </div>
    );
  }

  if (!usuario) {
    const voltar = location.pathname + location.search;
    const destino = voltar === '/' ? '/login' : `/login?voltar=${encodeURIComponent(voltar)}`;
    return <Navigate to={destino} replace />;
  }

  return <Outlet />;
}

/** Área administrativa: colaborador que digitar a URL vê "Acesso restrito". */
export function RequireAdmin() {
  const { data: usuario } = useSessao();
  if (usuario?.perfil !== 'ADMIN') {
    return (
      <Panel>
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          description="Esta área é exclusiva para administradores do sistema."
          action={
            <ButtonLink to="/" variant="secondary" size="sm">
              Voltar para o início
            </ButtonLink>
          }
        />
      </Panel>
    );
  }
  return <Outlet />;
}
