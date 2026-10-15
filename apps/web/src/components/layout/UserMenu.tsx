import { PERFIL_LABEL, type UsuarioSessao } from '@reserva/shared';
import { LogOut, UserRound } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router';
import { useLogout } from '../../features/auth/session';
import { cn } from '../../lib/cn';

/** Quem está logado, acesso a "Minha conta" e botão de sair. */
export function UserMenu({
  usuario,
  onNavigate,
}: {
  usuario: UsuarioSessao;
  onNavigate?: () => void;
}) {
  const logout = useLogout();
  const navigate = useNavigate();

  function sair() {
    logout.mutate(undefined, {
      onSettled: () => {
        onNavigate?.();
        navigate('/login', { replace: true });
      },
    });
  }

  return (
    <div className="border-t border-line pt-4">
      <div className="px-3">
        <p className="truncate text-[15px] font-semibold" title={usuario.nome}>
          {usuario.nome}
        </p>
        <p className="truncate text-xs text-muted" title={usuario.email}>
          {PERFIL_LABEL[usuario.perfil]} · {usuario.email}
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-0.5">
        <NavLink
          to="/minha-conta"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors',
              isActive
                ? 'bg-brand-soft font-semibold'
                : 'text-ink/75 hover:bg-canvas hover:text-ink',
            )
          }
        >
          <UserRound aria-hidden className="size-4 text-ink/50" />
          Minha conta
        </NavLink>
        <button
          type="button"
          onClick={sair}
          disabled={logout.isPending}
          className="flex h-10 items-center gap-3 rounded-md px-3 text-left text-sm text-ink/75 transition-colors hover:bg-canvas hover:text-ink disabled:opacity-50"
        >
          <LogOut aria-hidden className="size-4 text-ink/50" />
          {logout.isPending ? 'Saindo…' : 'Sair'}
        </button>
      </div>
    </div>
  );
}
