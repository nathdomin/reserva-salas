import { cn } from '../../lib/cn';
import { formatDateTime } from '../../lib/format';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useHealth } from './health';

function StatusRow({
  label,
  ok,
  okText,
  failText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  failText: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-md">{label}</dt>
      <dd className="flex items-center gap-2 text-md font-medium">
        <span aria-hidden className={cn('size-2 rounded-full', ok ? 'bg-ok' : 'bg-brand')} />
        {ok ? okText : failText}
      </dd>
    </div>
  );
}

/** Mostra, a partir da API real, se o servidor e o banco de dados estão respondendo. */
export function SystemStatus() {
  const { data, isPending, isError, refetch, isFetching } = useHealth();

  if (isPending) return <Spinner label="Verificando o servidor" />;

  if (isError) {
    return (
      <Alert
        tone="error"
        title="O servidor da aplicação não respondeu"
        action={
          <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Verificando…' : 'Verificar de novo'}
          </Button>
        }
      >
        Confira se a API está em execução (npm run dev) e verifique de novo.
      </Alert>
    );
  }

  return (
    <div>
      <dl className="divide-y divide-line">
        <StatusRow label="Servidor da aplicação" ok okText="Respondendo" failText="Sem resposta" />
        <StatusRow
          label="Banco de dados"
          ok={data.database === 'ok'}
          okText="Conectado"
          failText="Indisponível"
        />
      </dl>
      {data.database !== 'ok' && (
        <p className="mt-3 text-sm text-muted">
          Confira o DATABASE_URL no arquivo .env e se o projeto está ativo no painel do Supabase.
          Projetos gratuitos pausam após 7 dias sem uso.
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        Última verificação: {formatDateTime(data.timestamp)}
      </p>
    </div>
  );
}
