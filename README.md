# MeetKof

Sistema interno de reserva de salas de reunião do setor administrativo: calendário das salas,
reservas sem conflito de horário, administração de salas e usuários e histórico de alterações.

**Situação: Etapa 7 (entrega).** Todas as funções previstas estão prontas, testadas e documentadas.

| Tela                             | Quem usa      | O que faz                                                                                |
| -------------------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| Início                           | Todos         | Próximas reuniões e situação do sistema                                                  |
| Calendário                       | Todos         | Visões mensal, semanal e diária; filtro por sala; clique num horário livre para reservar |
| Minhas reservas                  | Todos         | Próximas e anteriores/canceladas, com editar e cancelar                                  |
| Nova reserva / Detalhes / Editar | Todos         | Formulário com ocupação da sala, sugestões em conflito e cancelamento com confirmação    |
| Administração › Reservas         | Administrador | Todas as reservas, filtros por período, sala, responsável e situação; cancelamento       |
| Administração › Salas / Usuários | Administrador | Cadastro, edição e desativação                                                           |
| Administração › Histórico        | Administrador | Quem criou, alterou ou cancelou o quê, com antes/depois                                  |
| Administração › Configurações    | Administrador | Horários, durações, antecedência, intervalo entre reuniões e visibilidade do motivo      |

### Regras de reserva (padrão)

| Regra                    | Valor padrão                                        |
| ------------------------ | --------------------------------------------------- |
| Horário de funcionamento | 07:00 às 20:00 (America/Sao_Paulo)                  |
| Intervalos               | De 15 em 15 minutos                                 |
| Duração                  | 15 minutos a 8 horas, ou **Dia inteiro**            |
| Antecedência máxima      | 120 dias                                            |
| Intervalo entre reuniões | 0 minutos (reuniões podem ser coladas)              |
| Motivo da reunião        | Visível para todos os colaboradores                 |
| Conflito de horário      | Bloqueado no banco (restrição de exclusão) e na API |

Os valores ficam na tabela `reserva.configuracoes` e são alterados em **Administração › Configurações**
(a alteração fica registrada no histórico). Reservas já feitas não mudam quando as regras mudam.

## Tecnologias

| Parte          | Tecnologia                                                               |
| -------------- | ------------------------------------------------------------------------ |
| Frontend       | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query |
| Backend        | Node.js, Fastify 5, TypeScript, SQL parametrizado (driver `pg`)          |
| Banco de dados | PostgreSQL gerenciado pelo Supabase                                      |
| Testes         | Vitest e Testing Library                                                 |

## Documentação

| Guia                                  | Conteúdo                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| [INSTALACAO.md](docs/INSTALACAO.md)   | Instalar do zero, criar o banco, o primeiro administrador e as salas, rodar localmente |
| [BANCO.md](docs/BANCO.md)             | Estrutura do banco (diagrama e tabelas), usuário `reserva_app`, backup e restauração   |
| [IMPLANTACAO.md](docs/IMPLANTACAO.md) | Disponibilizar na rede interna com HTTPS; diferença entre as formas de rodar           |
| [MANUTENCAO.md](docs/MANUTENCAO.md)   | Rotina de backups, atualizações, senhas, logs, monitoramento e retenção de dados       |
| [RENDER.md](docs/RENDER.md)           | Publicar na internet (Render), para acesso de qualquer lugar                           |
| [CONTAS.md](docs/CONTAS.md)           | 2FA e acessos nas contas do Supabase, GitHub e Render; restringir conexões ao banco    |

## Início rápido (no seu computador)

Requer **Node.js 22.12+** e um projeto no **Supabase**. Passo a passo completo em
[INSTALACAO.md](docs/INSTALACAO.md).

```powershell
npm install
copy .env.example .env      # preencha DATABASE_URL (e DATABASE_URL_TEST para os testes)
npm run db:setup
npm run db:migrate          # ou cole database/supabase.sql no SQL Editor do Supabase
npm run admin:create        # primeiro administrador (não existe senha padrão)
npm run dev                 # http://localhost:5173
```

## Estrutura

```
reserva-salas/
├── apps/
│   ├── api/                    Backend (Fastify)
│   │   ├── src/
│   │   │   ├── config/         Leitura e validação do .env
│   │   │   ├── db/             Conexão, migrações (migrations/*.sql), SQL consolidado, backup
│   │   │   ├── modules/        auth, users, salas, reservas, configuracoes, audit, health
│   │   │   ├── plugins/        Tratamento de erros, proteção de origem (CSRF)
│   │   │   ├── app.ts          Montagem da aplicação
│   │   │   └── server.ts       Inicialização do servidor
│   │   ├── scripts/            db:setup, db:migrate, db:sql, db:backup, db:restaurar,
│   │   │                       admin:create e build de produção
│   │   └── test/               Configuração dos testes de integração
│   └── web/                    Frontend (React)
│       └── src/
│           ├── components/     Layout e componentes de interface
│           ├── features/       Lógica por assunto (reservas, calendário, salas, usuários...)
│           ├── lib/            Cliente HTTP, datas e fuso horário
│           └── pages/          Telas
├── packages/shared/            Tipos, validações e regras usados pelo front e pelo back
├── database/
│   ├── supabase.sql            Estrutura completa para o SQL Editor do Supabase (gerado)
│   ├── papel-aplicacao.sql     Usuário do banco de permissões mínimas (produção)
│   └── consultas-uteis.sql     Consultas somente leitura para o administrador
├── deploy/                     Rede interna (Windows): Caddyfile, .env de produção,
│                               scripts de início, parada, backup e tarefas agendadas
├── docs/                       Guias de instalação, banco, implantação, manutenção e Render
├── render.yaml                 Configuração da publicação no Render
├── certs/                      Certificado do Supabase (você adiciona)
└── .env.example                Modelo das variáveis de ambiente (sem segredos)
```

Pastas criadas durante o uso e que **não** devem ser copiadas nem versionadas: `node_modules/`,
`dist/`, `backups/` (dados pessoais), `logs/` e o arquivo `.env` (senhas).

## Comandos

| Comando                             | O que faz                                                          |
| ----------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                       | Inicia API (porta 3333) e frontend (porta 5173) juntos             |
| `npm run db:setup`                  | Cria as extensões necessárias no banco                             |
| `npm run db:migrate`                | Cria/atualiza as tabelas (principal e testes)                      |
| `npm run db:sql`                    | Gera de novo o `database/supabase.sql` a partir das migrações      |
| `npm run admin:create`              | Cria o primeiro administrador (`-- --force` para recuperar acesso) |
| `npm run db:backup`                 | Backup dos dados em `backups/`                                     |
| `npm run db:restaurar -- <arquivo>` | Restaura um backup (`--substituir` apaga os dados atuais antes)    |
| `npm test`                          | Executa todos os testes (a API usa o projeto de testes)            |
| `npm run typecheck`                 | Verifica os tipos TypeScript                                       |
| `npm run lint`                      | Verifica o padrão do código (ESLint)                               |
| `npm run check`                     | Tipos + lint + testes                                              |
| `npm run build`                     | Gera a versão de produção (frontend e API)                         |
| `npm start`                         | Executa a versão de produção (requer `NODE_ENV=production`)        |

## Segurança

- Nenhuma senha no código. Configuração validada ao iniciar; o sistema recusa textos de exemplo
  no lugar da senha e nunca imprime valores do `.env` em mensagens de erro.
- Conexão com o banco sempre criptografada (SSL); em produção, com verificação do certificado.
- Cabeçalhos de segurança (Helmet, com Content Security Policy).
- Limite de requisições por IP.
- Bloqueio de requisições que alteram dados vindas de outros sites (proteção contra CSRF).
- Logs nunca registram cookies, cabeçalhos de autenticação ou campos de senha.
- Erros internos não são expostos ao usuário.
- Os testes da API se recusam a rodar se `DATABASE_URL_TEST` apontar para o banco principal.
- Data API do Supabase desligada ([INSTALACAO.md](docs/INSTALACAO.md)), para as tabelas não ficarem
  acessíveis pela internet.
- Tabelas no schema `reserva`, fora do alcance dos papéis públicos do Supabase (`anon`,
  `authenticated`), com RLS ativo em todas.
- Senhas com hash scrypt (OWASP), nunca guardadas nem registradas em texto.
- Sessão em cookie `httpOnly` + `SameSite=Strict` (+ `Secure` em produção). O banco guarda só o
  hash do token. A sessão expira após 8 h sem uso e, em qualquer caso, 12 h após o login.
- Desativar um usuário ou redefinir a senha dele encerra as sessões abertas na hora.
- Login: mensagem genérica para e-mail/senha errados, bloqueio progressivo (1, 2, 4, 8 e no
  máximo 15 min) após 5 erros seguidos, aviso à pessoa das tentativas erradas no login seguinte,
  botão **Desbloquear** para o administrador e limite de tentativas por IP.
- Permissões verificadas na API em todas as rotas; o perfil é relido do banco a cada requisição.
- Histórico de alterações (auditoria) somente de inserção: o banco impede alterar ou apagar.
- Em produção, a API pode usar o usuário de banco `reserva_app`, que não consegue apagar tabelas,
  reservas, usuários nem o histórico ([BANCO.md](docs/BANCO.md#usuário-da-aplicação-reserva_app)).
- Na rede interna: HTTPS pelo Caddy, API ouvindo só na própria máquina e tarefas do Windows
  rodando com a conta Serviço Local ([IMPLANTACAO.md](docs/IMPLANTACAO.md)).
- E-mails que não existem se comportam como contas reais no login (mesmo tempo de resposta e o
  mesmo bloqueio): as respostas não revelam quem tem conta.
- `TRUST_PROXY` só aceita o número de proxies ou o IP do proxy (nunca "confie em qualquer um"),
  para o IP do usuário não poder ser forjado. O limite de requisições vale só para a API.
- Em produção a configuração exige `APP_ORIGIN` com `https://`.
- Erros do banco são registrados no log sem os valores envolvidos (ex.: e-mail repetido).
- Colaboradores não conseguem filtrar as reservas de outra pessoa nem ver as canceladas dela; o
  motivo de um cancelamento só aparece para o responsável e a administração.

### Privacidade (LGPD)

| Dado                                   | Onde fica           | Por quanto tempo                                                                        |
| -------------------------------------- | ------------------- | --------------------------------------------------------------------------------------- |
| Nome, e-mail e perfil dos usuários     | `reserva.usuarios`  | Enquanto a pessoa usar o sistema (é desativada; **Excluir** apaga ou anonimiza a conta) |
| Sessões (IP e navegador de cada login) | `reserva.sessoes`   | Apagadas automaticamente após expirar (a cada hora)                                     |
| Reservas (motivo, participantes)       | `reserva.reservas`  | Indefinido (histórico)                                                                  |
| Histórico de alterações (com IP)       | `reserva.auditoria` | Indefinido: defina um prazo de retenção (ver abaixo)                                    |

O que cada perfil vê: colaboradores veem as reservas de todos (sala, horário, responsável e, se a
configuração permitir, o motivo); dados de usuários, histórico e configurações são só da
administração. Recomenda-se definir com a empresa um prazo de retenção do histórico (ex.: 12 a
24 meses) e registrar a base legal do tratamento (interesse legítimo na gestão das salas). Como
apagar o histórico antigo: [MANUTENCAO.md › Retenção de dados](docs/MANUTENCAO.md#retenção-de-dados-lgpd).
Os backups também contêm esses dados e devem ser guardados com o mesmo cuidado.

## Paleta de cores

| Cor       | Uso                                                                     |
| --------- | ----------------------------------------------------------------------- |
| `#F40009` | Destaque: botão "Nova reserva", item ativo do menu, marca do sistema    |
| `#C80008` | Tom derivado, para hover e texto vermelho pequeno (contraste acessível) |
| `#000000` | Texto principal                                                         |
| `#FFFFFF` | Painéis e menu                                                          |
| `#F5F5F5` | Fundo da aplicação                                                      |
