import type { Reserva } from '@reserva/shared';
import { useState, type FormEvent } from 'react';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field, Textarea } from '../../components/ui/Field';
import { cn } from '../../lib/cn';
import { apiFieldErrors, errorMessage } from '../../lib/forms';
import { useCancelarReserva } from './api';

interface CancelarReservaProps {
  reserva: Reserva;
  /** A reserva é de outra pessoa (administrador): o motivo passa a ser obrigatório. */
  deOutraPessoa: boolean;
  onCancelada: (reserva: Reserva) => void;
  onVoltar: () => void;
  className?: string;
}

/** Confirmação de cancelamento (nada é enviado antes de "Confirmar cancelamento"). */
export function CancelarReserva({
  reserva,
  deOutraPessoa,
  onCancelada,
  onVoltar,
  className,
}: CancelarReservaProps) {
  const cancelar = useCancelarReserva(reserva.id);
  const [motivo, setMotivo] = useState('');
  const errosCampo = apiFieldErrors(cancelar.error);

  function confirmar(event: FormEvent) {
    event.preventDefault();
    cancelar.mutate(motivo.trim() || undefined, { onSuccess: onCancelada });
  }

  return (
    <form
      onSubmit={confirmar}
      className={cn('flex flex-col gap-4', className)}
      aria-label="Confirmar cancelamento"
    >
      <p className="font-semibold">
        Cancelar esta reserva? O horário fica livre para outras pessoas.
      </p>
      {cancelar.isError && Object.keys(errosCampo).length === 0 && (
        <Alert tone="error" title={errorMessage(cancelar.error)} className="bg-canvas" />
      )}
      <Field
        label={
          deOutraPessoa
            ? 'Motivo do cancelamento (obrigatório)'
            : 'Motivo do cancelamento (opcional)'
        }
        error={errosCampo.motivo}
        hint={deOutraPessoa ? `${reserva.responsavel.nome} verá este motivo.` : undefined}
        className="max-w-xl"
      >
        <Textarea value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={cancelar.isPending}>
          {cancelar.isPending ? 'Cancelando…' : 'Confirmar cancelamento'}
        </Button>
        <Button variant="secondary" onClick={onVoltar} disabled={cancelar.isPending}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
