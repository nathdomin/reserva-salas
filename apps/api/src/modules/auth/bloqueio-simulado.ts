const UM_DIA_MS = 24 * 60 * 60_000;

/**
 * Duração do N-ésimo bloqueio seguido (N = 1, 2, 3...): 1, 2, 4, 8... minutos, até `maximo`.
 * Mesma regra do REGISTRAR_FALHA_LOGIN no banco.
 */
export function minutosDeBloqueio(sequencia: number, maximo: number): number {
  return Math.min(maximo, 2 ** Math.max(0, sequencia - 1));
}

/**
 * Bloqueio "de mentira" para e-mails que não existem.
 *
 * Contas reais são bloqueadas após N senhas erradas seguidas (gravado no banco). Se e-mails
 * inexistentes nunca fossem "bloqueados", bastaria errar a senha N+1 vezes para descobrir se
 * um e-mail tem conta no sistema. Aqui o mesmo comportamento do banco é reproduzido em
 * memória: tempo progressivo e sequência que recomeça um dia depois do último bloqueio.
 */
export function createBloqueioSimulado(opcoes: {
  maxTentativas: number;
  /** Teto do bloqueio progressivo, em minutos. */
  maxMinutos: number;
  maxEntradas?: number;
  agora?: () => number;
}) {
  const agora = opcoes.agora ?? (() => Date.now());
  const maxEntradas = opcoes.maxEntradas ?? 10_000;
  const registros = new Map<string, { falhas: number; bloqueios: number; bloqueadoAte: number }>();

  function limpar() {
    // Sem falhas pendentes e com o último bloqueio vencido há mais de um dia: igual a um
    // e-mail nunca visto, pode sair da memória.
    for (const [chave, r] of registros) {
      if (r.falhas === 0 && r.bloqueadoAte < agora() - UM_DIA_MS) registros.delete(chave);
    }
    // Limite de memória: descarta os mais antigos (ordem de inserção do Map).
    while (registros.size > maxEntradas) {
      const primeira = registros.keys().next().value;
      if (primeira === undefined) break;
      registros.delete(primeira);
    }
  }

  return {
    /** Minutos restantes de "bloqueio" deste e-mail (0 = livre). */
    minutosRestantes(email: string): number {
      const r = registros.get(email);
      if (!r || r.bloqueadoAte <= agora()) return 0;
      return Math.ceil((r.bloqueadoAte - agora()) / 60_000);
    },
    /** Registra uma tentativa errada; devolve true se ela causou o bloqueio. */
    registrarFalha(email: string): boolean {
      const r = registros.get(email) ?? { falhas: 0, bloqueios: 0, bloqueadoAte: 0 };
      registros.delete(email);
      r.falhas += 1;
      let bloqueou = false;
      if (r.falhas >= opcoes.maxTentativas) {
        if (r.bloqueadoAte < agora() - UM_DIA_MS) r.bloqueios = 0;
        r.falhas = 0;
        r.bloqueios += 1;
        r.bloqueadoAte = agora() + minutosDeBloqueio(r.bloqueios, opcoes.maxMinutos) * 60_000;
        bloqueou = true;
      }
      registros.set(email, r);
      if (registros.size > maxEntradas) limpar();
      return bloqueou;
    },
  };
}
