import type { UsuarioSessao } from '@reserva/shared';
import { BrandMark } from '../components/layout/BrandMark';
import { Button } from '../components/ui/Button';
import { FormTrocarSenha } from '../features/auth/FormTrocarSenha';
import { useLogout } from '../features/auth/session';
import { avisar } from '../features/avisos/store';

/**
 * Mostrada no lugar de qualquer página enquanto a pessoa usa a senha definida pelo
 * administrador (conta nova ou senha redefinida). A API também recusa as outras rotas.
 */
export function TrocarSenhaObrigatoriaPage({ usuario }: { usuario: UsuarioSessao }) {
  const logout = useLogout();
  const primeiroNome = usuario.nome.split(' ')[0];

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md animate-subir rounded-xl border border-line bg-paper p-6 shadow-card">
        <BrandMark />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Escolha a sua senha</h1>
        <p className="mt-1 mb-6 text-md text-muted">
          Olá, {primeiroNome}. A senha que você usou foi definida pelo administrador. Para
          continuar, crie uma senha que só você conheça.
        </p>
        <FormTrocarSenha
          rotuloSenhaAtual="Senha recebida do administrador"
          textoBotao="Salvar e continuar"
          onSucesso={() => avisar('Senha criada. Bem-vindo(a) ao MeetKof!')}
        />
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          Sair
        </Button>
      </div>
    </main>
  );
}
