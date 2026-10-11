/** Marca neutra do sistema (sem logotipo da empresa). */
export function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg aria-hidden viewBox="0 0 32 32" className="size-8 shrink-0">
        <rect width="32" height="32" rx="6" fill="#F40009" />
        <rect x="8" y="9" width="16" height="3" rx="1" fill="#fff" />
        <rect x="8" y="15" width="10" height="8" rx="1.5" fill="#fff" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold">Reserva de Salas</span>
        <span className="block text-xs text-muted">Setor administrativo</span>
      </span>
    </span>
  );
}
