import { cn } from '../../lib/cn';

export function Spinner({
  className,
  label = 'Carregando',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-muted', className)}>
      <span
        aria-hidden
        className="size-4 animate-spin rounded-full border-2 border-ink/15 border-t-brand"
      />
      <span className="text-sm">{label}…</span>
    </span>
  );
}
