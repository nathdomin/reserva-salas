import { cn } from '../../lib/cn';

/** Bloco cinza com brilho passando: o formato do conteúdo enquanto ele carrega. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative block overflow-hidden rounded-md bg-[#ececec]',
        'after:absolute after:inset-0 after:animate-brilho after:bg-linear-to-r after:from-transparent after:via-paper/70 after:to-transparent',
        className,
      )}
    />
  );
}

/** Lista de itens carregando (data à esquerda, duas linhas de texto). */
export function SkeletonLista({
  label,
  linhas = 4,
  cartao = true,
}: {
  label: string;
  linhas?: number;
  /** Sem cartão próprio quando já está dentro de um painel. */
  cartao?: boolean;
}) {
  return (
    <div
      role="status"
      className={cn(cartao && 'rounded-xl border border-line bg-paper p-2 shadow-card')}
    >
      <span className="sr-only">{label}…</span>
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-3">
          <Skeleton className="h-11 w-14 shrink-0 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="mt-2 h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
