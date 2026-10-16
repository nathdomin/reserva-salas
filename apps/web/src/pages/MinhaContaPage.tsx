import { PERFIL_LABEL } from '@reserva/shared';
import { useState } from 'react';
import { Alert } from '../components/ui/Alert';
import { PageHeader } from '../components/ui/PageHeader';
import { Panel } from '../components/ui/Panel';
import { FormTrocarSenha } from '../features/auth/FormTrocarSenha';
import { useSessao } from '../features/auth/session';

export function MinhaContaPage() {
  const { data: usuario } = useSessao();
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
      </div>
    </>
  );
}
