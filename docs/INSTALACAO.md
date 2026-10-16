# Instalação e primeira execução

Guia para instalar o sistema do zero, criar o banco no Supabase, o primeiro administrador e as
salas, e rodar no seu computador. Para colocar na rede da empresa, veja
[IMPLANTACAO.md](IMPLANTACAO.md) depois de concluir este guia.

## Pré-requisitos

- **Node.js 22.12 ou mais recente** (versão LTS) — <https://nodejs.org>. Confira com `node -v`.
- **Conta no Supabase** (o plano gratuito serve para começar) — <https://supabase.com>.

O Supabase é usado **apenas como banco PostgreSQL**. Login, regras e permissões ficam na API deste
projeto; Auth, Storage e Data API do Supabase não são usados.

## 1. Criar os projetos no Supabase

Crie **dois projetos**: um principal e outro só para os testes automáticos (os testes apagam e
recriam dados, por isso nunca rodam no principal). Se não for rodar os testes, o segundo é
opcional.

Em cada projeto:

1. **New project** → nome (ex.: `reserva-salas` e `reserva-salas-test`), região **South America
   (São Paulo)** e uma senha de banco forte, **só com letras e números** (evita problemas na URL).
   Guarde a senha num gerenciador de senhas.
2. **Desligue a Data API** (o sistema não usa; desligada, as tabelas não ficam acessíveis pela
   internet): **Integrations → Data API** → desative **Enable Data API**.
3. Copie a URL de conexão: botão **Connect** → **Session pooler** → copie a URI, no formato
   `postgresql://postgres.<id-do-projeto>:[YOUR-PASSWORD]@<host-do-pooler>:5432/postgres`.

Use o **Session pooler** (porta 5432): funciona em redes só com IPv4 (a maioria das redes
corporativas) e é o indicado para um servidor ligado o tempo todo.

## 2. Instalar as dependências e configurar o `.env`

Na pasta do projeto (Windows, PowerShell):

```powershell
npm install
copy .env.example .env
```

Abra o `.env` e preencha, **trocando `[YOUR-PASSWORD]` pela senha** de cada projeto:

- `DATABASE_URL` → projeto principal
- `DATABASE_URL_TEST` → projeto de testes (opcional)

Cada variável está explicada no próprio `.env.example`.

## 3. Criar as tabelas (escolha UMA das opções)

### Opção A — pelo terminal (recomendada)

```powershell
npm run db:setup     # extensões necessárias (pode repetir)
npm run db:migrate   # tabelas, regras e índices (pode repetir: só aplica o que falta)
```

### Opção B — pelo SQL Editor do Supabase (sem usar o terminal)

1. No projeto: **SQL Editor → New query**.
2. Abra o arquivo [`database/supabase.sql`](../database/supabase.sql), copie **todo** o conteúdo,
   cole e clique em **Run**.
3. O resultado deve listar as migrações aplicadas (`0001_modelo_inicial.sql`, ...).

As duas opções criam exatamente a mesma estrutura e registram as mesmas migrações: depois da
opção B, `npm run db:migrate` reconhece tudo como aplicado e não duplica nada. O script pode ser
executado de novo sem problema. A estrutura está documentada em [BANCO.md](BANCO.md).

## 4. Criar o primeiro administrador

```powershell
npm run admin:create
```

O comando pede nome, e-mail e senha (a senha não aparece na tela; mínimo de 10 caracteres).

- Não existe tela pública de cadastro nem senha padrão. O primeiro administrador só pode ser
  criado por este comando, no computador onde o sistema está instalado.
- Se já houver um administrador ativo, o comando recusa. Para **recuperar o acesso** (ex.: senha
  do único administrador esquecida): `npm run admin:create -- --force` — com um e-mail já
  cadastrado, ele promove essa pessoa a administrador, reativa e define a nova senha.
- O sistema nunca fica sem administrador: ninguém desativa a si mesmo nem rebaixa o último
  administrador ativo.

## 5. Conferir e iniciar

```powershell
npm run check   # tipos, padrão de código e testes (usa o projeto de testes)
npm run dev     # inicia a API (porta 3333) e o site (porta 5173)
```

Acesse **<http://localhost:5173>** e entre com o e-mail e a senha do administrador.

## 6. Cadastrar as salas e as pessoas

Tudo pela própria tela, sem mexer no código:

1. **Administração → Salas → Nova sala**: nome, localização/andar, capacidade, recursos
   (televisão, projetor, videoconferência... ou outros, separados por vírgula) e descrição.
2. **Administração → Usuários → Novo usuário**: nome, e-mail corporativo, perfil
   (Colaborador ou Administrador) e uma senha inicial. Informe a senha à pessoa por um canal
   seguro. No primeiro acesso, o sistema obriga a pessoa a criar a própria senha antes de usar
   qualquer tela (o administrador não fica sabendo a senha de ninguém).
3. **Administração → Configurações**: horário de funcionamento, intervalos, durações,
   antecedência máxima, intervalo entre reuniões e se o motivo das reuniões é visível a todos.

Salas e usuários não são apagados, e sim **desativados**: o histórico de reservas é preservado.
Se for preciso **excluir** uma pessoa (cadastro errado ou pedido de exclusão de dados), use
**Excluir** na lista de usuários: sem histórico, a conta é apagada; com histórico, nome, e-mail
e senha são apagados e as reservas passam a mostrar "Usuário removido".
Ao desativar uma sala ou uma pessoa com reservas futuras, o sistema pergunta se elas devem ser
canceladas ou mantidas. No caso de uma pessoa, também dá para **transferir** as reservas para
outra pessoa ativa (mesma sala e horário), na desativação ou na exclusão da conta.

## 7. Verificação do certificado do banco (obrigatória em produção)

Com `DATABASE_SSL=require` a conexão já é criptografada, mas a API não confere se está falando
com o servidor verdadeiro do Supabase. Para conferir (exigido com `NODE_ENV=production`):

1. No projeto: **Database → Settings → SSL Configuration → Download certificate**.
2. Salve como `certs/supabase-ca.crt` na pasta do projeto.
3. No `.env`: `DATABASE_SSL=verify-full` e `DATABASE_SSL_CA=certs/supabase-ca.crt`.
4. Recomendado: na mesma tela, ative **Enforce SSL on incoming connections**.

## 8. (Recomendado em produção) Usuário do banco só para a aplicação

Em vez de conectar como `postgres` (dono de tudo), a aplicação pode usar o usuário
`reserva_app`, com permissões mínimas. O passo a passo está em
[BANCO.md › Usuário da aplicação](BANCO.md#usuário-da-aplicação-reserva_app).

## Problemas comuns

| Sintoma                                        | O que fazer                                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "Configuração inválida" ao iniciar             | A mensagem lista as variáveis com problema. Compare com o `.env.example`.                             |
| Banco "Indisponível"                           | Projetos gratuitos **pausam após 7 dias sem uso**: abra o painel do Supabase e clique em **Restore**. |
| `password authentication failed`               | Senha errada na URL. Para trocar: **Database → Settings → Reset database password**.                  |
| `self-signed certificate in certificate chain` | Com `verify-full`, confira se o `certs/supabase-ca.crt` é o certificado baixado **do mesmo projeto**. |
| Aviso "migração(ões) pendente(s)" ao iniciar   | Rode `npm run db:migrate` (ou o `database/supabase.sql` de novo).                                     |
| "Muitas tentativas sem sucesso" no login       | Aguarde o tempo indicado (1 a 15 minutos) ou peça ao administrador para **Desbloquear** a conta.      |
| `Max client connections reached`               | Muitas conexões abertas. Feche outros `npm run dev` ou reduza `DATABASE_POOL_MAX`.                    |
| Testes da API recusam rodar                    | `DATABASE_URL_TEST` precisa apontar para o projeto de **testes**, diferente do principal.             |
| `TRUST_PROXY: use o número de proxies...`      | `TRUST_PROXY=true` não é aceito. Use `false` (sem proxy) ou veja [IMPLANTACAO.md](IMPLANTACAO.md).    |
