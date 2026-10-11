/**
 * Bloqueio "de mentira" para e-mails que não existem.
 *
 * Contas reais são bloqueadas após N senhas erradas seguidas (gravado no banco). Se e-mails
 * inexistentes nunca fossem "bloqueados", bastaria errar a senha N+1 vezes para descobrir se
 * um e-mail tem conta no sistema. Aqui o mesmo comportamento é reproduzido em memória.
 */
export function createBloqueioSimulado(opcoes: {
  maxTentativas: number;
  bloqueioMinutos: number;
  maxEntradas?: number;
  agora?: () => number;
}) {
  const agora = opcoes.agora ?? (() => Date.now());
  const maxEntradas = opcoes.maxEntradas ?? 10_000;
  const registros = new Map<string, { falhas: number; bloqueadoAte: number }>();

  function limpar() {
    const t = agora();
    for (const [chave, r] of registros) {
      if (r.bloqueadoAte <= t && r.falhas === 0) registros.delete(chave);
    }
    // Limite de memória: descarta os mais antigos (ordem de inserção do Map).
    while (registros.size > maxEntradas) {
      const primeira = registros.keys().next().value;
      if (primeira === undefined) break;
      registros.delete(primeira);
    }
  }

  return {
    /** O e-mail está "bloqueado" agora? */
    bloqueado(email: string): boolean {
      const r = registros.get(email);
      return Boolean(r && r.bloqueadoAte > agora());
    },
    /** Registra uma tentativa errada; devolve true se ela causou o bloqueio. */
    registrarFalha(email: string): boolean {
      const r = registros.get(email) ?? { falhas: 0, bloqueadoAte: 0 };
      registros.delete(email);
      r.falhas += 1;
      let bloqueou = false;
      if (r.falhas >= opcoes.maxTentativas) {
        r.falhas = 0;
        r.bloqueadoAte = agora() + opcoes.bloqueioMinutos * 60_000;
        bloqueou = true;
      }
      registros.set(email, r);
      if (registros.size > maxEntradas) limpar();
      return bloqueou;
    },
  };
}
