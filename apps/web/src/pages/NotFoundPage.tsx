import { SearchX } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Panel } from '../components/ui/Panel';

export function NotFoundPage() {
  return (
    <Panel>
      <EmptyState
        icon={SearchX}
        title="Página não encontrada"
        description="O endereço digitado não existe. Use o menu ou volte para o início."
        action={
          <ButtonLink to="/" variant="secondary" size="sm">
            Voltar para o início
          </ButtonLink>
        }
      />
    </Panel>
  );
}
