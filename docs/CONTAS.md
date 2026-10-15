# Segurança das contas de serviço

O sistema protege os dados dentro da aplicação, mas quem entra nos **painéis** do Supabase,
do GitHub ou do Render passa por fora de todas essas proteções:

| Conta        | O que alguém consegue com ela                                                                 |
| ------------ | --------------------------------------------------------------------------------------------- |
| **Supabase** | Ler, alterar e apagar **todos** os dados (usuários, reservas, histórico) e as senhas do banco |
| **GitHub**   | Alterar o código: a próxima atualização instalada no servidor leva a alteração junto          |
| **Render**   | Ler o `DATABASE_URL` (com a senha) e publicar outra versão do sistema                         |

Por isso, essas três contas precisam de verificação em duas etapas (2FA). Faça isto uma vez e
repita a revisão a cada 6 meses ([MANUTENCAO.md](MANUTENCAO.md#resumo-da-rotina)).

## 1. Verificação em duas etapas (obrigatório)

Use um aplicativo autenticador (Microsoft Authenticator, Google Authenticator, 1Password etc.)
ou uma chave de acesso (passkey). Evite SMS. **Guarde os códigos de recuperação** em local
seguro (gerenciador de senhas da empresa): sem eles, perder o celular significa perder a conta.

| Conta    | Onde ativar                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Supabase | Avatar (canto superior direito) → **Account preferences** → **Security** → **Multi-factor authentication** |
| GitHub   | Avatar → **Settings** → **Password and authentication** → **Two-factor authentication**                    |
| Render   | Avatar → **Account Settings** → **Security** → **Two-Factor Authentication**                               |

Se a conta do GitHub ou do Supabase foi criada com "Entrar com GitHub/Google", ative o 2FA
também na conta usada para entrar.

### Exigir 2FA de toda a equipe

Se mais pessoas tiverem acesso:

- **Supabase:** organização → **Security** → **Enforce MFA** (quem não tiver 2FA perde o acesso
  à organização). Conforme o plano, a organização pode exigir o login corporativo (SSO).
- **GitHub:** se o repositório estiver numa organização: **Settings** → **Authentication
  security** → **Require two-factor authentication**.

## 2. Quem tem acesso (revisar)

- **Supabase:** organização → **Team**. Só quem administra o sistema. Quem só precisa consultar
  dados usa o próprio sistema, não o painel.
- **GitHub:** repositório → **Settings** → **Collaborators**. Confira também se o repositório
  continua **Private**.
- **Render:** **Workspace Settings** → **Members**.
- Quem sair da equipe: remova dos três **no mesmo dia** e troque as senhas do banco
  ([MANUTENCAO.md](MANUTENCAO.md)) se a pessoa as conhecia.

## 3. Restringir quem conecta no banco (recomendado)

Mesmo com a senha do banco, só os endereços liberados conseguem conectar.

Supabase → projeto → **Database** → **Settings** → **Network Restrictions** → libere só:

- **Rede interna:** o IP público de saída da empresa (a TI informa) ou do servidor.
- **Render:** os IPs de saída da região, em **Render → serviço → Connect → Outbound** (são
  compartilhados com outros clientes do Render: a proteção é menor, mas ainda reduz o risco).
- O IP de quem roda `db:migrate`, `db:backup` e `db:restaurar`, se for outra máquina.

> **Atenção:** com a restrição ligada, o backup automático pelo GitHub para de funcionar (os
> endereços do GitHub mudam a cada execução). Veja [MANUTENCAO.md](MANUTENCAO.md#backup-automático-github).
>
> Se a lista ficar errada, o sistema mostra o banco **Indisponível**. Para desfazer, volte à mesma
> tela e libere de novo `0.0.0.0/0`. Se a conexão usar IPv6, inclua também as faixas IPv6.

Na mesma página, em **SSL Configuration**, ligue **Enforce SSL on incoming connections**. A API
já conecta com SSL; isto impede que outra ferramenta conecte sem criptografia.

## Conferência

- [ ] 2FA ativo no Supabase, no GitHub e no Render, com os códigos de recuperação guardados
- [ ] Equipe revisada nos três serviços; repositório privado
- [ ] Network Restrictions ativas no Supabase, com o sistema ainda mostrando o banco **Conectado**
- [ ] Enforce SSL ligado no Supabase
