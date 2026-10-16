import { PERFIL_LABEL, type UsuarioSessao } from '@reserva/shared';
import { LogOut, UserRound } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router';
import { useLogout } from '../../features/auth/session';
import { cn } from '../../lib/cn';

const CONECTORES = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

/** "Ana Beatriz da Silva" → "AS": iniciais da primeira e da última palavra do nome. */
export function iniciais(nome: string): string {
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((p) => !CONECTORES.has(p.toLowerCase()));
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : '';
  return (primeira + ultima).toUpperCase();
}

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
      <div className="flex items-center gap-3 px-2">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-strong"
        >
          {iniciais(usuario.nome)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-md font-semibold" title={usuario.nome}>
            {usuario.nome}
          </p>
          <p className="truncate text-xs text-muted" title={usuario.email}>
            {PERFIL_LABEL[usuario.perfil]} · {usuario.email}
          </p>
        </div>
      </div>
      {/* Lado a lado para a barra caber em telas mais baixas. */}
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-1">
        <NavLink
          to="/minha-conta"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex h-10 items-center gap-2 rounded-md px-2 text-sm transition-colors',
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
          className="flex h-10 items-center gap-2 rounded-md px-2 text-left text-sm text-ink/75 transition-colors hover:bg-canvas hover:text-ink disabled:opacity-50"
        >
          <LogOut aria-hidden className="size-4 text-ink/50" />
          {logout.isPending ? 'Saindo…' : 'Sair'}
        </button>
      </div>
    </div>
  );
}
