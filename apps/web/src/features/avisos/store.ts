import { useSyncExternalStore } from 'react';

export interface Aviso {
  id: number;
  titulo: string;
  detalhe?: string | undefined;
}

/** Tempo na tela de cada aviso (a pessoa também pode fechar antes). */
const DURACAO_MS = 6000;

let avisos: Aviso[] = [];
let proximoId = 1;
const ouvintes = new Set<() => void>();

function publicar(lista: Aviso[]) {
  avisos = lista;
  for (const ouvinte of ouvintes) ouvinte();
}

/** Mostra um aviso de sucesso flutuante (canto inferior), que some sozinho. */
export function avisar(titulo: string, detalhe?: string) {
  const aviso: Aviso = { id: proximoId++, titulo, detalhe };
  // No máximo 3 na tela: o mais antigo sai.
  publicar([...avisos.slice(-2), aviso]);
  setTimeout(() => fecharAviso(aviso.id), DURACAO_MS);
}

export function fecharAviso(id: number) {
  if (avisos.some((a) => a.id === id)) publicar(avisos.filter((a) => a.id !== id));
}

export function useAvisos(): Aviso[] {
  return useSyncExternalStore(
    (ouvinte) => {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    () => avisos,
    () => avisos,
  );
}

/** Só para testes: começa cada teste sem avisos de um teste anterior. */
export function limparAvisos() {
  publicar([]);
}
