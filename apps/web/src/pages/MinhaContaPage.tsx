import { PERFIL_LABEL } from '@reserva/shared';
import { useState } from 'react';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { FormTrocarSenha } from '../features/auth/FormTrocarSenha';
import { useEncerrarOutrasSessoes, useSessao } from '../features/auth/session';
import { avisar } from '../features/avisos/store';
import { errorMessage } from '../lib/forms';

export function MinhaContaPage() {
  const { data: usuario } = useSessao();
  const encerrar = useEncerrarOutrasSessoes();
  const [sucesso, setSucesso] = useState(false);

  if (!usuario) return null;

  return (
    <>
      <PageHeader title="Minha conta" description="Seus dados de acesso ao sistema." />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
        <Panel title="Dados">
          <dl className="flex flex-col gap-3 text-md">
            <div>
              <dt className="text-sm text-muted">Nome</dt>
              <dd className="font-medium">{usuario.nome}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">E-mail</dt>
              <dd className="font-medium break-all">{usuario.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Perfil</dt>
              <dd className="font-medium">{PERFIL_LABEL[usuario.perfil]}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-muted">
            Para corrigir nome ou e-mail, fale com o administrador do sistema.
          </p>
        </Panel>

        <Panel title="Trocar senha">
          {sucesso && (
            <Alert tone="success" title="Senha alterada." className="mb-4 bg-canvas">
              Se você estava conectado em outros navegadores, essas sessões foram encerradas.
            </Alert>
          )}
          <FormTrocarSenha onSucesso={() => setSucesso(true)} />
        </Panel>

        <Panel title="Aparelhos conectados" className="lg:col-start-2">
          <p className="text-md text-muted">
            Perdeu o celular ou entrou num computador de outra pessoa? Encerre o acesso em todos os
            outros navegadores e aparelhos. Este continua conectado.
          </p>
          {encerrar.isError && (
            <Alert tone="error" title={errorMessage(encerrar.error)} className="mt-4 bg-canvas" />
          )}
          <Button
            variant="secondary"
            className="mt-4"
            disabled={encerrar.isPending}
            onClick={() =>
              encerrar.mutate(undefined, {
                onSuccess: (total) =>
                  avisar(
                    total === 0
                      ? 'Você não estava conectado em nenhum outro aparelho.'
                      : `Pronto: ${total === 1 ? '1 outro aparelho foi desconectado' : `${total} outros aparelhos foram desconectados`}.`,
                  ),
              })
            }
          >
            {encerrar.isPending ? 'Desconectando…' : 'Sair dos outros aparelhos'}
          </Button>
        </Panel>
      </div>
    </>
  );
}
