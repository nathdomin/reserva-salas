import { useId } from 'react';
import logo from '../../assets/logo-Empresa-Empresa.webp';
import { cn } from '../../lib/cn';

/**
 * Ícone do MeetKof: os "blocos de reserva" do calendário (uma reserva, um horário
 * ocupado e um livre). Invertido: quadrado branco com blocos vermelhos, para fundo vermelho.
 * É desenho próprio do sistema; o logo da Empresa nunca é alterado.
 */
export function IconeMeetKof({
  className,
  invertido = false,
}: {
  className?: string;
  invertido?: boolean;
}) {
  const gradiente = useId();
  const fundo = invertido ? '#ffffff' : `url(#${gradiente})`;
  const bloco = invertido ? 'var(--color-brand-strong)' : '#ffffff';
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id={gradiente} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-brand)" />
          <stop offset="1" stopColor="var(--color-brand-strong)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={fundo} />
      <rect x="14" y="17" width="36" height="12" rx="3.5" fill={bloco} />
      <rect x="14" y="35" width="24" height="12" rx="3.5" fill={bloco} opacity={0.6} />
      <rect x="42" y="35" width="8" height="12" rx="3.5" fill={bloco} opacity={0.35} />
    </svg>
  );
}

const TAMANHOS = {
  sm: { icone: 'size-8', nome: 'text-lg' },
  md: { icone: 'size-10', nome: 'text-[22px]' },
  lg: { icone: 'size-11', nome: 'text-[26px]' },
};

/** Marca do sistema: ícone + "MeetKof" (com "Kof" em destaque). */
export function BrandMark({
  invertida = false,
  tamanho = 'sm',
}: {
  invertida?: boolean;
  tamanho?: keyof typeof TAMANHOS;
}) {
  const t = TAMANHOS[tamanho];
  return (
    <span className="flex items-center gap-2.5">
      <IconeMeetKof invertido={invertida} className={t.icone} />
      <span
        className={cn(
          'leading-none font-medium tracking-tight',
          t.nome,
          invertida ? 'text-paper' : 'text-ink',
        )}
      >
        Meet<strong className={cn('font-bold', !invertida && 'text-brand-strong')}>Kof</strong>
      </span>
    </span>
  );
}

/** Assinatura da empresa: logo oficial pequeno (sem alteração) + setor. Só sobre fundo claro. */
export function AssinaturaEmpresa({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 text-xs text-muted', className)}>
      {/* Proporção do logotipo: 544 × 287 */}
      <img src={logo} alt="Empresa" width={34} height={18} className="h-[18px] w-auto" />
      Setor administrativo
    </span>
  );
}
