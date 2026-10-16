import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { useAvisoTentativas } from './session';

/**
 * Logo depois do login: avisa se alguém errou a senha desta conta desde o acesso anterior
 * (pode ter sido a própria pessoa, ou alguém tentando entrar no lugar dela).
 */
export function AvisoTentativas() {
  const { total, dispensar } = useAvisoTentativas();
  if (total === 0) return null;
  const vezes = total === 1 ? '1 tentativa' : `${total} tentativas`;
  return (
    <Alert
      tone="error"
      title={`Houve ${vezes} de entrar na sua conta com a senha errada desde o seu último acesso.`}
      className="mb-6"
      action={
        <Button size="sm" variant="secondary" onClick={dispensar}>
          Entendi
        </Button>
      }
    >
      Se não foi você, troque a senha em Minha conta e avise o administrador do sistema.
    </Alert>
  );
}
