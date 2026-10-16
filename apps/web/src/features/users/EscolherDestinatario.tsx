import { Field, Select } from '../../components/ui/Field';
import { useUsuarios } from './api';

interface EscolherDestinatarioProps {
  /** Quem está saindo (não aparece na lista). */
  excluirId: string;
  valor: string;
  onChange: (id: string) => void;
  erro?: string | undefined;
}

/** Escolha de quem recebe as reservas futuras: só pessoas ativas, em ordem alfabética. */
export function EscolherDestinatario({
  excluirId,
  valor,
  onChange,
  erro,
}: EscolherDestinatarioProps) {
  const usuarios = useUsuarios();
  const opcoes = (usuarios.data ?? [])
    .filter((u) => u.ativo && u.id !== excluirId)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <Field label="Transferir as reservas para" error={erro}>
      <Select value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">Escolha uma pessoa…</option>
        {opcoes.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nome}
          </option>
        ))}
      </Select>
    </Field>
  );
}
