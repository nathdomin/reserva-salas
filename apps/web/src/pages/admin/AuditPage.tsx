import {
  ACAO_AUDITORIA_LABEL,
  ACOES_AUDITORIA,
  dataValida,
  ENTIDADE_AUDITORIA_LABEL,
  ENTIDADES_AUDITORIA,
  type AcaoAuditoria,
  type EntidadeAuditoria,
} from '@reserva/shared';
import { ScrollText } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field, Input, Select } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { Panel } from '../../components/ui/Panel';
import { useAuditoria } from '../../features/auditoria/api';
import { HistoricoLista } from '../../features/auditoria/HistoricoLista';
import { useUsuarios } from '../../features/users/api';
import { errorMessage } from '../../lib/forms';
import { SkeletonLista } from '../../components/ui/Skeleton';

/** Ações de cada tipo, para o filtro de ação acompanhar o tipo escolhido. */
const PREFIXO: Record<EntidadeAuditoria, (acao: AcaoAuditoria) => boolean> = {
  usuario: (a) =>
    a.startsWith('USUARIO') ||
    a.startsWith('SENHA') ||
    a.startsWith('ADMIN') ||
    a === 'LOGIN_FALHO' ||
    a === 'CONTA_BLOQUEADA',
  sala: (a) => a.startsWith('SALA'),
  reserva: (a) => a.startsWith('RESERVA'),
  configuracao: (a) => a.startsWith('CONFIGURACOES'),
};

const ehEntidade = (v: string | null): v is EntidadeAuditoria =>
  (ENTIDADES_AUDITORIA as readonly string[]).includes(v ?? '');
const ehAcao = (v: string | null): v is AcaoAuditoria =>
  (ACOES_AUDITORIA as readonly string[]).includes(v ?? '');

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const de = params.get('de') ?? '';
  const ate = params.get('ate') ?? '';
  const tipo = params.get('tipo');
  const acao = params.get('acao');
  const pessoa = params.get('pessoa') ?? '';

  const entidade = ehEntidade(tipo) ? tipo : undefined;
  const acaoValida = ehAcao(acao) ? acao : undefined;
  const periodoInvalido = Boolean(de && ate && dataValida(de) && dataValida(ate) && ate < de);

  const usuarios = useUsuarios();
  const historico = useAuditoria({
    dataInicio: dataValida(de) && !periodoInvalido ? de : undefined,
    dataFim: dataValida(ate) && !periodoInvalido ? ate : undefined,
    entidade,
    acao: acaoValida,
    atorId: pessoa || undefined,
  });

  function alterar(mudancas: Record<string, string>) {
    const novo = new URLSearchParams(params);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) novo.set(chave, valor);
      else novo.delete(chave);
    }
    setParams(novo, { replace: true });
  }

  const acoesDoTipo = ACOES_AUDITORIA.filter((a) => !entidade || PREFIXO[entidade](a));
  const registros = historico.data?.pages.flatMap((p) => p.registros) ?? [];
  const temFiltro = Boolean(de || ate || entidade || acaoValida || pessoa);

  return (
    <>
      <PageHeader
        title="Histórico de alterações"
        description="Quem criou, alterou ou cancelou o quê, e quando. Os registros não podem ser apagados."
      />

      <Panel className="mb-4">
        <form
          aria-label="Filtros"
          onSubmit={(e) => e.preventDefault()}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <Field label="De">
            <Input type="date" value={de} onChange={(e) => alterar({ de: e.target.value })} />
          </Field>
          <Field
            label="Até"
            error={
              periodoInvalido ? 'A data final deve ser igual ou posterior à inicial.' : undefined
            }
          >
            <Input type="date" value={ate} onChange={(e) => alterar({ ate: e.target.value })} />
          </Field>
          <Field label="Tipo">
            <Select
              value={entidade ?? ''}
              onChange={(e) => alterar({ tipo: e.target.value, acao: '' })}
            >
              <option value="">Todos os tipos</option>
              {ENTIDADES_AUDITORIA.map((e) => (
                <option key={e} value={e}>
                  {ENTIDADE_AUDITORIA_LABEL[e]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ação">
            <Select value={acaoValida ?? ''} onChange={(e) => alterar({ acao: e.target.value })}>
              <option value="">Todas as ações</option>
              {acoesDoTipo.map((a) => (
                <option key={a} value={a}>
                  {ACAO_AUDITORIA_LABEL[a]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Feito por">
            <Select value={pessoa} onChange={(e) => alterar({ pessoa: e.target.value })}>
              <option value="">Qualquer pessoa</option>
              {(usuarios.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </Select>
          </Field>
        </form>
        {temFiltro && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => setParams({}, { replace: true })}
          >
            Limpar filtros
          </Button>
        )}
      </Panel>

      {historico.isPending && <SkeletonLista label="Carregando histórico" />}
      {historico.isError && <Alert tone="error" title={errorMessage(historico.error)} />}

      {historico.isSuccess && registros.length === 0 && (
        <Panel>
          <EmptyState
            icon={ScrollText}
            title={temFiltro ? 'Nenhum registro com esses filtros' : 'Nenhum registro ainda'}
            description="Criações, alterações e cancelamentos de reservas, salas, usuários e configurações aparecem aqui."
          />
        </Panel>
      )}

      {registros.length > 0 && (
        <Panel>
          <HistoricoLista registros={registros} />
          {historico.hasNextPage && (
            <Button
              variant="secondary"
              className="mt-4"
              disabled={historico.isFetchingNextPage}
              onClick={() => void historico.fetchNextPage()}
            >
              {historico.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
            </Button>
          )}
        </Panel>
      )}
    </>
  );
}
