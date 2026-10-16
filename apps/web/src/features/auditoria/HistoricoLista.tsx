import { ACAO_AUDITORIA_LABEL, type RegistroAuditoria } from '@reserva/shared';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { formatDateTime } from '../../lib/format';

/** Nomes legíveis dos campos gravados no histórico. */
const CAMPOS: Record<string, string> = {
  nome: 'Nome',
  email: 'E-mail',
  perfil: 'Perfil',
  ativo: 'Ativo',
  bloqueado: 'Bloqueado',
  minutos: 'Minutos de bloqueio',
  ultimoAcesso: 'Último acesso',
  diasSemLogin: 'Limite sem login (dias)',
  sala: 'Sala',
  localizacao: 'Localização',
  capacidade: 'Capacidade',
  recursos: 'Recursos',
  descricao: 'Descrição',
  reservasCanceladas: 'Reservas canceladas',
  inicio: 'Início',
  fim: 'Término',
  diaInteiro: 'Dia inteiro',
  motivo: 'Motivo',
  participantes: 'Participantes',
  status: 'Situação',
  motivoCancelamento: 'Motivo do cancelamento',
  motivoVisivelParaTodos: 'Motivo visível para todos',
  horarioInicio: 'Início do expediente',
  horarioFim: 'Fim do expediente',
  granularidadeMinutos: 'Intervalo dos horários (min)',
  duracaoMinimaMinutos: 'Duração mínima (min)',
  duracaoMaximaMinutos: 'Duração máxima (min)',
  antecedenciaMaximaDias: 'Antecedência máxima (dias)',
  intervaloEntreReunioesMinutos: 'Intervalo entre reuniões (min)',
  desativarAposDiasSemLogin: 'Desativar sem login há (dias)',
  maxReservasFuturasPorPessoa: 'Reservas futuras por pessoa',
};

/** Campos técnicos que não ajudam quem lê o histórico. */
const OCULTOS = new Set(['id', 'versao']);

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'string') {
    if (ISO.test(valor)) return formatDateTime(valor);
    if (valor === 'ATIVA') return 'Ativa';
    if (valor === 'CANCELADA') return 'Cancelada';
    if (valor === 'ADMIN') return 'Administrador';
    if (valor === 'COLABORADOR') return 'Colaborador';
    return valor;
  }
  if (Array.isArray(valor)) return valor.length ? valor.map(formatarValor).join(', ') : '—';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}

function Mudancas({ registro }: { registro: RegistroAuditoria }) {
  const antes = registro.antes ?? {};
  const depois = registro.depois ?? {};
  const campos = [...new Set([...Object.keys(antes), ...Object.keys(depois)])].filter(
    (c) => !OCULTOS.has(c),
  );
  if (campos.length === 0) return null;
  const temAntes = registro.antes !== null;

  return (
    <table className="mt-2 w-full max-w-2xl table-fixed text-sm">
      <thead className="text-left text-xs font-medium text-muted">
        <tr>
          {/* Tabela de largura fixa: a 1ª linha define as colunas, então esta célula fica no fluxo. */}
          <th className="w-28 sm:w-48">
            <span className="sr-only">Campo</span>
          </th>
          {temAntes && <th className="pr-3 pb-0.5 font-medium">Antes</th>}
          <th className="pb-0.5 font-medium">{temAntes ? 'Depois' : 'Valor'}</th>
        </tr>
      </thead>
      <tbody>
        {campos.map((campo) => (
          <tr key={campo} className="align-top">
            <td className="w-28 py-0.5 pr-3 text-muted sm:w-48">{CAMPOS[campo] ?? campo}</td>
            {temAntes && (
              <td className="py-0.5 pr-3 break-words text-muted line-through decoration-muted/50">
                {formatarValor(antes[campo])}
              </td>
            )}
            <td className="py-0.5 break-words">{formatarValor(depois[campo])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function quemFez(r: RegistroAuditoria): string {
  if (r.ator) return r.ator.nome;
  if (r.acao === 'LOGIN_FALHO' || r.acao === 'CONTA_BLOQUEADA') return 'Tentativa de login';
  return 'Terminal do servidor';
}

/** Lista de registros do histórico (tela de histórico e detalhes da reserva). */
export function HistoricoLista({
  registros,
  mostrarAlvo = true,
}: {
  registros: RegistroAuditoria[];
  mostrarAlvo?: boolean;
}) {
  return (
    <ol className="divide-y divide-line" aria-label="Registros do histórico">
      {registros.map((r) => (
        <li key={r.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge
              tone={r.acao.includes('CANCEL') || r.acao.includes('DESATIV') ? 'alert' : 'neutral'}
            >
              {ACAO_AUDITORIA_LABEL[r.acao]}
            </Badge>
            {mostrarAlvo && r.alvo && (
              <span className="font-medium">
                {r.entidade === 'reserva' && r.entidadeId ? (
                  <Link
                    to={`/reservas/${r.entidadeId}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {r.alvo}
                  </Link>
                ) : (
                  r.alvo
                )}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatDateTime(r.criadoEm)} · {quemFez(r)}
            {r.ip ? ` · IP ${r.ip}` : ''}
          </p>
          <Mudancas registro={r} />
        </li>
      ))}
    </ol>
  );
}
