# Publicação na internet (Render)

Este guia publica o sistema num endereço da internet com HTTPS (ex.:
`https://reserva-salas.onrender.com`), para as pessoas da empresa acessarem de qualquer lugar,
inclusive pelo celular. O banco continua no Supabase.

Para usar só dentro da rede da empresa, sem expor na internet, veja
[IMPLANTACAO.md](IMPLANTACAO.md).

## Antes de começar: o que muda na internet

- **Qualquer pessoa consegue abrir a tela de login.** Só entra quem tem usuário cadastrado por um
  administrador (não há cadastro público), e o sistema já tem: HTTPS, bloqueio progressivo
  (1 a 15 minutos) após 5 senhas erradas, limite de tentativas por IP, proteção contra CSRF e senhas com hash.
  Mesmo assim: senhas fortes, poucos administradores e desativar no mesmo dia quem sair da
  empresa.
- **Plano gratuito do Render:** o sistema "dorme" após 15 minutos sem acesso; o primeiro acesso
  depois disso leva cerca de **1 minuto** (aparece uma tela de carregamento). São 750 horas
  gratuitas por mês. O próprio Render **não recomenda o plano gratuito para uso em produção**.
  Para a empresa usar todo dia, troque para um plano pago no painel (o sistema não precisa de
  nenhuma mudança).
- **Região:** o Render não tem servidores na América do Sul. O guia usa Virginia (EUA), a mais
  próxima do Supabase em São Paulo. Cada tela fica um pouco mais lenta do que no seu computador,
  mas continua utilizável.
- **LGPD:** nomes, e-mails e reservas passam a ser processados também pelo Render (EUA). Informe
  o responsável pela proteção de dados da empresa.

## O que você precisa

- Conta no **GitHub** (<https://github.com>) e o **Git** instalado (<https://git-scm.com>), ou o
  **GitHub Desktop** (<https://desktop.github.com>).
- Conta no **Render** (<https://render.com>); entre com a conta do GitHub.
- O banco no Supabase já criado (`npm run db:migrate`) e o administrador criado
  (`npm run admin:create`), como no [INSTALACAO.md](INSTALACAO.md).

## Passo 1 — Certificado do Supabase

Em produção, a API só conecta ao banco conferindo o certificado do Supabase.

1. Supabase → **Database → Settings → SSL Configuration → Download certificate**.
2. Salve como `certs/supabase-ca.crt` na pasta do projeto.

Esse arquivo é **público** (não é senha) e vai junto para o GitHub.

## Passo 2 — Enviar o código para o GitHub (repositório privado)

1. No GitHub: **New repository** → nome `reserva-salas` → marque **Private** → **Create
   repository** (sem README, sem .gitignore).
2. No PowerShell, na pasta do projeto (troque `SEU-USUARIO`):

   ```powershell
   git init
   git add .
   git status
   ```

   **Confira na lista que NÃO aparecem** o `.env`, a pasta `backups` nem `node_modules` (o
   `.gitignore` já os exclui). Se aparecerem, pare e me avise.

   ```powershell
   git commit -m "MeetKof"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/reserva-salas.git
   git push -u origin main
   ```

Senhas nunca vão para o GitHub: elas ficam só no `.env` do seu computador e nos segredos do
Render.

## Passo 3 — Criar o serviço no Render

1. Render → **New → Blueprint** → conecte o GitHub e escolha o repositório `reserva-salas`.
   O Render lê o arquivo `render.yaml` do projeto, que já tem todas as configurações.
2. Ele pede dois valores:
   - **`APP_ORIGIN`**: `https://reserva-salas.onrender.com`
   - **`DATABASE_URL`**: a mesma URL do Session pooler que está no seu `.env` (com a senha).
3. **Apply / Deploy Blueprint**. A primeira publicação leva alguns minutos; acompanhe em
   **Logs**. No fim aparece `Your service is live`.

## Passo 4 — Conferir o endereço

No topo da página do serviço aparece o endereço real. Se o Render tiver acrescentado algo ao nome
(ex.: `https://reserva-salas-x1y2.onrender.com`), atualize o `APP_ORIGIN`:

**Environment** → editar `APP_ORIGIN` → **Save, rebuild, and deploy**.

Com o `APP_ORIGIN` diferente do endereço, o login não funciona (proteção contra CSRF).

## Passo 5 — Testar

1. Abra o endereço, entre com o administrador e confira em **Início** que o banco aparece como
   **Conectado**.
2. Cadastre as salas e as pessoas em **Administração** (se ainda não fez).
3. Abra pelo celular, fora do Wi-Fi da empresa, para confirmar o acesso externo.

## Passo 6 — Conferir o IP registrado (importante)

O limite de tentativas de login e o histórico usam o IP de quem acessa. O Render passa por dois
intermediários (Cloudflare e o proxy dele), configurados em `TRUST_PROXY=2`. Para confirmar:

1. Saia do sistema e tente entrar com a **senha errada uma vez**; depois entre normalmente.
2. Em **Administração → Histórico de alterações**, abra o registro "Login sem sucesso" e veja o IP.
3. Compare com o seu IP público (pesquise "qual é meu ip" no navegador).

- **Iguais:** está tudo certo.
- **Diferentes:** me envie os dois IPs (o do histórico e o seu) antes de liberar para a equipe.
  Com o valor errado, uma pessoa pode bloquear o login de outras.

## Passo 7 — Ajustes no Supabase

- **Enforce SSL**: Database → Settings → SSL Configuration → ative.
- **Usuário `reserva_app`** (recomendado): siga [BANCO.md](BANCO.md#usuário-da-aplicação-reserva_app)
  e troque o `DATABASE_URL` no **Environment** do Render pela URL do `reserva_app`. Mantenha a
  URL do `postgres` só no `.env` do seu computador (para `db:migrate` e backups).
- **Data API**: se o projeto do Supabase for só deste sistema, desligue-a. Se outro sistema
  usar o mesmo projeto, **não desligue sem confirmar** que ele não depende dela (as tabelas
  deste sistema continuam protegidas de qualquer forma).

## Liberar para a equipe

Cadastre cada pessoa em **Administração → Usuários** e envie o endereço e a senha inicial por um
canal seguro (pessoalmente ou mensagem direta, nunca num grupo). Cada pessoa troca a senha em
**Minha conta**.

## Atualizar o sistema

1. No seu computador: se a versão nova tiver migração, rode `npm run db:migrate` (com o `.env`
   apontando para o mesmo banco).
2. Envie o código: `git add .` → `git commit -m "descrição"` → `git push`.
3. Render → serviço → **Manual Deploy → Deploy latest commit**.

A publicação automática a cada `git push` está desligada de propósito (`autoDeployTrigger: off`
no `render.yaml`): só vai ao ar o que você mandar. Se algo der errado, use **Rollback** no
Render para voltar à publicação anterior.

## Backups

O Render não guarda dados (tudo fica no Supabase), e o plano gratuito do Supabase não faz backup
automático. Configure o **backup automático no GitHub** (gratuito, diário, criptografado; também
evita que o Supabase pause o projeto por falta de uso):
[MANUTENCAO.md › Backup automático (GitHub)](MANUTENCAO.md#backup-automático-github).

Sem ele, rode no seu computador, **pelo menos uma vez por semana**, `npm run db:backup` e guarde
os arquivos de `backups\` em local protegido: eles contêm dados pessoais.

## Problemas comuns

| Sintoma                                 | O que fazer                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Demora ~1 minuto para abrir             | Normal no plano gratuito depois de 15 min sem uso. Num plano pago isso não acontece.             |
| Build falha em `npm ci`                 | O `package-lock.json` precisa estar no GitHub. Me envie o trecho do log com o erro.              |
| "Configuração inválida" nos Logs        | A mensagem lista a variável. Confira `APP_ORIGIN` (com `https://`) e `DATABASE_URL`.             |
| `arquivo do certificado não encontrado` | O `certs/supabase-ca.crt` não foi para o GitHub (passo 1).                                       |
| Login volta para a tela de login        | `APP_ORIGIN` diferente do endereço do navegador (passo 4).                                       |
| `tenant/user ... not found` nos Logs    | A URL do banco aponta para um projeto que não existe; copie de novo em Connect → Session pooler. |
| Muita gente bloqueada ao mesmo tempo    | IP registrado errado (passo 6).                                                                  |
