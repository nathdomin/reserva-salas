import logo from '../../assets/logo-Empresa-Empresa.webp';

/** Marca do sistema: logotipo da empresa + nome do sistema. */
export function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      {/* Proporção do logotipo: 544 × 287 */}
      <img
        src={logo}
        alt="Empresa"
        width={68}
        height={36}
        className="h-9 w-auto shrink-0"
      />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold">MeetKof</span>
        <span className="block text-xs text-muted">Setor administrativo</span>
      </span>
    </span>
  );
}
