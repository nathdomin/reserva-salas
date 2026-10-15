import { Menu, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useSessao } from '../../features/auth/session';
import { Avisos } from '../../features/avisos/Avisos';
import { cn } from '../../lib/cn';
import { ButtonLink } from '../ui/Button';
import { BrandMark } from './BrandMark';
import { SideNav } from './SideNav';
import { UserMenu } from './UserMenu';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { data: usuario } = useSessao();
  const abrirMenuRef = useRef<HTMLButtonElement>(null);
  const fecharMenuRef = useRef<HTMLButtonElement>(null);
  const devolverFocoRef = useRef(false);

  /** Fecha o menu pelo botão, pelo fundo ou pelo Esc, devolvendo o foco a quem o abriu. */
  function fecharMenu() {
    devolverFocoRef.current = true;
    setMenuOpen(false);
  }

  // Fecha o menu móvel ao trocar de página (o foco segue com a nova página).
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Menu aberto: foco no botão de fechar, Esc fecha e a página de trás não rola.
  useEffect(() => {
    if (!menuOpen) {
      // Só depois de fechar: enquanto o menu está aberto, a barra superior fica inerte.
      if (devolverFocoRef.current) abrirMenuRef.current?.focus();
      devolverFocoRef.current = false;
      return;
    }
    fecharMenuRef.current?.focus();
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') fecharMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowAnterior;
    };
  }, [menuOpen]);

  // Garantido pelo RequireAuth; null só por um instante durante o logout.
  if (!usuario) return null;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a
        href="#conteudo"
        inert={menuOpen}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-paper focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>

      {/* Barra superior (celular e tablet) */}
      <header
        inert={menuOpen}
        className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur-md lg:hidden"
      >
        <Link to="/" aria-label="Início">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-1">
          <ButtonLink to="/reservas/nova" size="sm" aria-label="Nova reserva">
            <Plus aria-hidden className="size-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Nova reserva</span>
          </ButtonLink>
          <button
            ref={abrirMenuRef}
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

      {/*
        Menu em gaveta (celular): fica sempre montado para poder deslizar ao abrir e ao
        fechar; fechado, é invisível e inerte (fora do Tab e do leitor de tela).
      */}
      <div
        inert={!menuOpen}
        aria-hidden={!menuOpen}
        className={cn(
          'fixed inset-0 z-40 lg:hidden',
          // Abre visível na hora (o foco já pode entrar); ao fechar, some só no fim do deslize.
          menuOpen ? 'visible' : 'invisible transition-[visibility] duration-300',
        )}
      >
        <button
          type="button"
          aria-label="Fechar menu"
          tabIndex={-1}
          className={cn(
            'absolute inset-0 bg-ink/40 transition-opacity duration-200',
            menuOpen ? 'opacity-100' : 'opacity-0',
          )}
          onClick={fecharMenu}
        />
        <div
          id="menu-movel"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={cn(
            'absolute inset-y-0 right-0 flex w-[min(320px,85vw)] flex-col gap-6 overflow-y-auto bg-paper px-4 py-4 shadow-raised',
            'transition-transform duration-300 ease-(--ease-suave)',
            menuOpen ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <div className="flex items-center justify-between">
            <BrandMark />
            <button
              ref={fecharMenuRef}
              type="button"
              onClick={fecharMenu}
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

      <main id="conteudo" inert={menuOpen} className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {/* A cada página nova, o conteúdo entra com um fade curto. */}
        <div key={location.pathname} className="mx-auto max-w-6xl animate-entrar">
          <Outlet />
        </div>
      </main>

      <Avisos />
    </div>
  );
}
