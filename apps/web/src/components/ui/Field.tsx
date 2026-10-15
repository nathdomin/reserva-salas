import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

/*
 * Fonte de 16px no celular: abaixo disso o Safari do iPhone dá zoom ao focar o campo.
 * O foco usa o contorno global (:focus-visible em index.css) além da borda escura.
 * Borda ink/45: contraste mínimo de 3:1 com o fundo branco para o campo ser percebido.
 */
const controlBase =
  'block h-10 w-full rounded-md border bg-paper px-3 text-base text-ink placeholder:text-muted sm:text-md ' +
  'transition-colors focus:border-ink disabled:bg-canvas disabled:text-muted';

export function Input({
  className,
  invalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(controlBase, invalid ? 'border-brand' : 'border-ink/45', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cn(controlBase, 'pr-8', invalid ? 'border-brand' : 'border-ink/45', className)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        'block min-h-20 w-full rounded-md border bg-paper px-3 py-2 text-base text-ink sm:text-md',
        'placeholder:text-muted focus:border-ink',
        invalid ? 'border-brand' : 'border-ink/45',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

/** Caixa de seleção com o rótulo ao lado (clicável). */
export function Checkbox({
  label,
  hint,
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-[18px] shrink-0 accent-brand"
        aria-describedby={hint ? `${id}-dica` : undefined}
        {...props}
      />
      <div>
        <label htmlFor={id} className="text-md font-medium">
          {label}
        </label>
        {hint && (
          <p id={`${id}-dica`} className="text-xs text-muted">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  /** Mensagem de erro do campo (em vermelho, lida pelo leitor de tela). */
  error?: string | undefined;
  hint?: string;
  className?: string;
  /** Um único Input ou Select: recebe id, aria-describedby e o estado de erro. */
  children: ReactElement<{ id?: string; invalid?: boolean; 'aria-describedby'?: string }>;
}

export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-dica`;
  const errorId = `${id}-erro`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        invalid: Boolean(error),
        'aria-describedby': describedBy || undefined,
      })
    : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-brand-strong">
          {error}
        </p>
      )}
    </div>
  );
}
