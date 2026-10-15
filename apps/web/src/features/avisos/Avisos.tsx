import { X } from 'lucide-react';
import { fecharAviso, useAvisos } from './store';

/**
 * Avisos de sucesso flutuantes ("Reserva confirmada", "Sala reativada"…), com um ✓ que
 * se desenha ao aparecer. A região fica sempre na página para o leitor de tela anunciar.
 */
export function Avisos() {
  const avisos = useAvisos();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {avisos.map((a) => (
        <div
          key={a.id}
          className="pointer-events-auto flex w-full max-w-md animate-subir items-center gap-3 rounded-xl bg-ink py-3 pr-2 pl-3 text-sm text-paper shadow-raised"
        >
          <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-ok">
            <svg viewBox="0 0 24 24" className="size-4">
              <path
                d="M5 12.5 10 17 19 7"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={24}
                className="animate-tracar"
              />
            </svg>
          </span>
          <p className="min-w-0 flex-1">
            <span className="block font-semibold">{a.titulo}</span>
            {a.detalhe && <span className="block text-paper/70">{a.detalhe}</span>}
          </p>
          <button
            type="button"
            onClick={() => fecharAviso(a.id)}
            aria-label="Fechar aviso"
            className="grid size-9 shrink-0 place-items-center rounded-md text-paper/70 hover:bg-paper/10 hover:text-paper"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
