import { Hammer } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { Panel } from './Panel';

interface PlannedFeatureProps {
  etapa: number;
  description: string;
}

/**
 * Indica de forma explícita que a tela ainda será construída (sem botões falsos).
 * Removido conforme cada etapa for concluída.
 */
export function PlannedFeature({ etapa, description }: PlannedFeatureProps) {
  return (
    <Panel>
      <EmptyState
        icon={Hammer}
        title={`Esta tela será construída na Etapa ${etapa}`}
        description={description}
      />
    </Panel>
  );
}
