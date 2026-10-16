# Manutenção

Rotinas para manter o sistema seguro e os dados protegidos. Os comandos são executados no
PowerShell, na pasta do projeto.

## Resumo da rotina

| Quando                    | O quê                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Todo dia                  | Backup automático (tarefa `MeetKof - Backup` no servidor, ou o workflow do GitHub no Render).         |
| Toda semana               | Conferir `logs\backup.log` (linhas `OK`) e copiar o backup mais recente para fora do servidor.        |
| Todo mês                  | Testar a restauração de um backup. Rodar `npm audit`. Ver o tamanho do banco.                         |
| A cada 6 meses            | Revisar administradores e usuários ativos. Trocar as senhas do banco. Revisar [CONTAS.md](CONTAS.md). |
| Quando houver versão nova | Seguir [IMPLANTACAO.md › Atualizar o sistema](IMPLANTACAO.md#atualizar-o-sistema).                    |

## Backups

O que o backup contém e como funciona está em [BANCO.md › Backup e restauração](BANCO.md#backup-e-restauração).

### Backup automático

Criado por `deploy\registrar-tarefas.ps1` ([IMPLANTACAO.md](IMPLANTACAO.md)). Todo dia, o
`deploy\backup-diario.ps1`:

1. gera `backups\reserva-AAAA-MM-DD-HHmm.sql`;
2. se deu certo, apaga backups com mais de **30 dias** (mude com `-ManterDias`);
3. apaga logs da API com mais de **90 dias**;
4. registra o resultado em `logs\backup.log`.

Se o backup falhar, nada é apagado e a linha começa com `ERRO`. Para rodar agora:

```powershell
Start-ScheduledTask -TaskName 'MeetKof - Backup'
Get-Content logs\backup.log -Tail 5
```

### Backup manual

```powershell
npm run db:backup
```

### Backup automático (GitHub)

Para a versão no **Render**, onde não há servidor da empresa para a tarefa agendada. Gratuito:
o workflow [`.github/workflows/backup-diario.yml`](../.github/workflows/backup-diario.yml)
roda no GitHub Actions e:

- **todo dia às 06:30**, gera o backup, **criptografa** e guarda por **90 dias** na aba
  **Actions** do repositório;
- **às 06:30 e às 14:00**, abre o site (`/api/health`). Isso também evita que o Supabase
  gratuito **pause o projeto** por falta de uso (por exemplo, num recesso);
- se algo falhar, o GitHub manda um e-mail.

O GitHub nunca vê os dados abertos: o arquivo é criptografado com a **chave pública** antes de
ser guardado, e só quem tem a **chave privada** consegue abri-lo. O workflow usa um usuário do
banco que **só lê** (`reserva_backup`).

#### Configurar (uma vez)

1. **Usuário de leitura no banco.** Supabase → **SQL Editor** → cole
   `database\papel-backup.sql`, troque a senha **no editor** (16+ letras e números) → **Run**.
2. **Chave de criptografia** (no seu computador, uma vez):

   ```powershell
   winget install FiloSottile.age
   age-keygen -o chave-backup-meetkof.txt
   ```

   O comando mostra a chave pública (`Public key: age1...`). O arquivo
   `chave-backup-meetkof.txt` é a **chave privada**: guarde-o no gerenciador de senhas da
   empresa ou num pendrive criptografado, **fora do OneDrive e fora do projeto**. Sem ele os
   backups não podem ser abertos; com ele, qualquer pessoa pode abri-los.

3. **GitHub** → repositório → **Settings → Secrets and variables → Actions**:

   | Onde          | Nome                   | Valor                                                                                |
   | ------------- | ---------------------- | ------------------------------------------------------------------------------------ |
   | **Secrets**   | `BACKUP_DATABASE_URL`  | `postgresql://reserva_backup.<id-do-projeto>:<senha>@<host-do-pooler>:5432/postgres` |
   | **Variables** | `BACKUP_AGE_RECIPIENT` | A chave pública (`age1...`)                                                          |
   | **Variables** | `APP_URL`              | O endereço do sistema no Render (ex.: `https://reserva-salas.onrender.com`)          |

   O `<id-do-projeto>` e o `<host-do-pooler>` são os mesmos do `DATABASE_URL` do `.env`.

4. **Testar:** **Actions → Backup diário e verificação do site → Run workflow**. Em ~2 minutos,
   os dois passos ficam verdes e o backup aparece em **Artifacts**, no fim da página da execução.

> Se ligar as **Network Restrictions** do Supabase ([CONTAS.md](CONTAS.md)), o GitHub deixa de
> conseguir conectar (os endereços dele mudam a cada execução) e o backup passa a falhar. Nesse
> caso, volte ao backup manual ou faça-o de uma máquina com IP liberado.

#### Restaurar um backup do GitHub

1. **Actions** → a execução do dia → **Artifacts** → baixe e extraia o `.zip`.
2. Abra com a chave privada:

   ```powershell
   age --decrypt -i C:\caminho\chave-backup-meetkof.txt -o reserva.sql reserva-AAAA-MM-DD-HHmm.sql.age
   ```

3. Restaure como qualquer backup ([Testar a restauração](#testar-a-restauração-mensal) e
   [BANCO.md](BANCO.md#backup-e-restauração)) e **apague o `reserva.sql` aberto** ao terminar.

### Cópia fora do servidor (importante)

Um backup que fica só no servidor some junto com ele (defeito no disco, ransomware). Copie
regularmente o backup mais recente para outro local protegido: o backup da TI, um disco
criptografado guardado em outro lugar ou um armazenamento corporativo com acesso restrito.
**Os arquivos contêm dados pessoais** (nomes, e-mails e histórico de uso): não use pastas
compartilhadas abertas nem e-mail.

No Supabase pago, os backups automáticos do painel são uma segunda camada; no gratuito, o backup
deste sistema é o único.

### Testar a restauração (mensal)

Use o **projeto de testes** do Supabase (nunca o principal). Os testes automáticos apagam os dados
desse projeto, então não há problema em sobrescrevê-los.

1. Crie o arquivo `.env.restauracao` na pasta do projeto, só com o projeto de testes:

   ```dotenv
   NODE_ENV=development
   APP_ORIGIN=http://localhost:5173
   DATABASE_URL=postgresql://postgres.<id-do-projeto-de-testes>:<senha>@<host-do-pooler>:5432/postgres
   DATABASE_SSL=require
   ```

2. Estrutura e restauração:

   ```powershell
   $env:ENV_FILE = '.env.restauracao'
   npm run db:migrate
   npm run db:restaurar -- backups\reserva-AAAA-MM-DD-HHmm.sql --substituir
   Remove-Item Env:ENV_FILE
   ```

   Confira na linha **`Destino:`** que o usuário é `postgres.<id-do-projeto-de-testes>` antes de
   digitar `SUBSTITUIR`.

3. No SQL Editor do projeto de testes, rode a consulta 1 ou 2 de
   `database\consultas-uteis.sql` e confira que os dados estão lá.
4. Apague o `.env.restauracao` e, se quiser, os dados restaurados (rodar `npm run check` já os
   apaga).

### Restaurar um backup

Para recuperar dados no **projeto principal** (após perda de dados ou erro grave):

1. Pare a API (`deploy\parar-servidor.ps1`), para ninguém gravar durante a restauração.
2. `npm run db:restaurar -- backups\<arquivo>.sql --substituir` e digite `SUBSTITUIR`.
   Os dados atuais são **apagados** e trocados pelos do backup; tudo o que foi feito depois do
   backup é perdido.
3. Inicie a API. Todos precisarão entrar de novo.

Se o projeto principal foi perdido: crie um projeto novo no Supabase, aplique o
`database\supabase.sql` (e o `papel-aplicacao.sql`), atualize o `.env` com as novas URLs e
restaure sem `--substituir`.

## Supabase

- **Pausa por inatividade (plano gratuito):** projetos sem atividade por 7 dias são pausados.
  Com uso diário isso não costuma acontecer; se a tela mostrar o banco **Indisponível**, abra o
  painel do Supabase e clique em **Restore**.
- **Limites do plano gratuito:** 500 MB de banco. Acompanhe com a consulta 8 de
  `database\consultas-uteis.sql` ou em **Reports** no painel. O sistema usa pouco: milhares de
  reservas ocupam poucos MB.
- **Para uso em produção pela empresa**, avalie o plano Pro: sem pausa, backups diários
  automáticos e suporte.
- Mantenha a **Data API desligada** e confira de vez em quando **Advisors → Security Advisor**
  no painel.

## Senhas

### Senhas do banco (a cada 6 meses ou se houver suspeita de vazamento)

- **`postgres`:** Supabase → **Database → Settings → Reset database password**. Atualize a
  `DATABASE_MIGRATION_URL` (ou a `DATABASE_URL`, se a API ainda usa o `postgres`).
- **`reserva_app`:** execute de novo `database\papel-aplicacao.sql` com a nova senha e atualize a
  `DATABASE_URL`.
- Reinicie a API (`deploy\parar-servidor.ps1` e `Start-ScheduledTask -TaskName 'MeetKof - API'`).

### Senhas das pessoas

- Esquecimento: um administrador usa **Redefinir senha** em **Administração → Usuários** (também
  desbloqueia a conta e encerra as sessões da pessoa). No próximo acesso, a pessoa é obrigada a
  trocar a senha provisória por uma própria.
- Administrador único sem acesso: `npm run admin:create -- --force` no servidor
  ([INSTALACAO.md](INSTALACAO.md#4-criar-o-primeiro-administrador)).
- Quem sai da empresa: **desative** o usuário no mesmo dia. As sessões dele são encerradas e o
  histórico é mantido. Se alguém esquecer, o sistema desativa sozinho o colaborador que passar
  do prazo sem login (**Administração → Configurações → Acesso**, padrão 60 dias). Isso não vale
  para administradores: desative-os sempre à mão.

## Revisão de acessos (a cada 6 meses)

- Consulta 5 de `consultas-uteis.sql`: administradores ativos. Mantenha poucos (2 ou 3).
- Em **Administração → Usuários**, desative quem não usa mais o sistema.
- Consulta 6: contas bloqueadas com frequência podem indicar tentativa de adivinhar senhas.

## Atualizações de segurança

Na máquina de desenvolvimento (não no servidor):

```powershell
npm audit            # vulnerabilidades conhecidas nas dependências
npm outdated         # versões novas disponíveis
npm audit fix        # aplica correções compatíveis
npm run check        # confirma que nada quebrou
```

Depois, leve a versão para o servidor seguindo
[IMPLANTACAO.md › Atualizar o sistema](IMPLANTACAO.md#atualizar-o-sistema). Atualizações que
mudam a versão principal de uma dependência (ex.: `npm audit fix --force`) precisam de teste
cuidadoso antes.

Mantenha também o **Windows**, o **Node.js** (versão LTS) e o **Caddy** atualizados.

### Alterar a estrutura do banco

Crie uma migração nova em `apps/api/src/db/migrations` (nunca altere uma já aplicada), rode
`npm run db:sql` para atualizar o `database/supabase.sql` e `npm run check`. Veja
[BANCO.md](BANCO.md#gerar-de-novo-o-supabasesql).

## Logs e monitoramento

| Arquivo                    | Conteúdo                                          |
| -------------------------- | ------------------------------------------------- |
| `logs\servico.log`         | Inícios e paradas da API (com o motivo).          |
| `logs\api-*.log`           | Avisos e erros da API (um arquivo a cada início). |
| `logs\api-*.erros.log`     | Falhas graves do Node (normalmente vazio).        |
| `logs\backup.log`          | Resultado de cada backup.                         |
| `C:\caddy\logs\acesso.log` | Cada acesso ao sistema (com rotação automática).  |

- **Saúde do sistema:** `https://salas.suaempresa.interno/api/health` responde `200` com
  `"status":"ok"` quando a API e o banco estão funcionando, e `503` quando o banco está
  indisponível. A TI pode cadastrar esse endereço na ferramenta de monitoramento que já usa.
- **Quem fez o quê:** o histórico (auditoria) registra reservas, cancelamentos, alterações de
  salas, usuários, senhas e configurações, tentativas de login com falha e bloqueios. Consulte em
  **Administração → Histórico de alterações** ou com a consulta 4 de `consultas-uteis.sql`.
- Senhas, cookies e tokens nunca aparecem nos logs.

## Retenção de dados (LGPD)

O sistema guarda nome e e-mail corporativo, reservas, o histórico de ações (com IP) e, nas
sessões abertas, IP e navegador. Defina com o
responsável pela proteção de dados da empresa por quanto tempo manter o histórico.

O histórico é protegido contra alteração, inclusive pela aplicação. Para apagar registros
antigos conforme a política definida, um administrador do Supabase executa no SQL Editor,
**depois de um backup**:

```sql
-- Exemplo: apagar o histórico com mais de 2 anos.
begin;
alter table reserva.auditoria disable trigger auditoria_imutavel;
delete from reserva.auditoria where criado_em < now() - interval '2 years';
alter table reserva.auditoria enable trigger auditoria_imutavel;
commit;
```

Pessoas que saíram da empresa ficam desativadas (não apagadas), porque as reservas e o histórico
apontam para elas. Para um **pedido de exclusão de dados** (LGPD), use **Excluir** em
**Administração → Usuários**: nome, e-mail e senha são apagados e as reservas ficam como
"Usuário removido". O histórico de ações já gravado (ex.: o registro de quando a conta foi criada)
não é alterado, porque é o registro de segurança do sistema; ele sai pela rotina de retenção acima.
