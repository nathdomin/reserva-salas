import { Menu, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useSessao } from '../../features/auth/session';
import { ButtonLink } from '../ui/Button';
import { BrandMark } from './BrandMark';
import { SideNav } from './SideNav';
import { UserMenu } from './UserMenu';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { data: usuario } = useSessao();

  // Fecha o menu móvel ao trocar de página.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Fecha o menu móvel com Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Garantido pelo RequireAuth; null só por um instante durante o logout.
  if (!usuario) return null;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-paper focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>

      {/* Barra superior (celular e tablet) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-paper px-4 lg:hidden">
        <Link to="/" aria-label="Início">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-1">
          <ButtonLink to="/reservas/nova" size="sm" aria-label="Nova reserva">
            <Plus aria-hidden className="size-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Nova reserva</span>
          </ButtonLink>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            aria-controls="menu-movel"
            className="grid size-10 place-items-center rounded-md hover:bg-canvas"
          >
            <Menu aria-hidden className="size-5" />
          </button>
        </div>
      </header>

      {/* Menu lateral (computador) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 overflow-y-auto border-r border-line bg-paper px-4 py-5 lg:flex">
        <Link to="/" aria-label="Início" className="px-1">
          <BrandMark />
        </Link>
        <SideNav perfil={usuario.perfil} />
        <div className="mt-auto">
          <UserMenu usuario={usuario} />
        </div>
      </aside>

      {/* Menu em gaveta (celular) */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMenuOpen(false)}
          />
          <div
            id="menu-movel"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 right-0 flex w-[min(320px,85vw)] flex-col gap-6 overflow-y-auto bg-paper px-4 py-4"
          >
            <div className="flex items-center justify-between">
              <BrandMark />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar menu"
                className="grid size-10 place-items-center rounded-md hover:bg-canvas"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <SideNav perfil={usuario.perfil} onNavigate={() => setMenuOpen(false)} />
            <div className="mt-auto">
              <UserMenu usuario={usuario} onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <main id="conteudo" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
