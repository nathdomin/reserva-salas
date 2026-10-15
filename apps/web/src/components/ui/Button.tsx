import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

// Ao pressionar, o botão "afunda" levemente (desligado para quem pede menos movimento).
const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap ' +
  'transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-(--ease-suave) ' +
  'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-strong text-paper shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_0_rgb(0_0_0/0.1)] hover:bg-brand-deep active:bg-brand-deep',
  secondary: 'border border-ink/15 bg-paper text-ink hover:border-ink/40',
  ghost: 'text-ink hover:bg-ink/5',
  /** Primeiro passo de uma ação destrutiva (cancelar, desativar); a confirmação vem depois. */
  danger: 'text-brand-strong hover:bg-brand-soft',
};

const sizes: Record<Size, string> = {
  md: 'h-10 px-4 text-md',
  // Em telas de toque o botão pequeno sobe para 40px de altura (alvo confortável para o dedo).
  sm: 'h-8 px-3 text-sm pointer-coarse:h-10',
};

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className as string | undefined)} {...props} />
  );
}
