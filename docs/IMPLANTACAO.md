# Implantação na rede interna

Este guia coloca o sistema à disposição dos colegas **dentro da rede da empresa**, com HTTPS,
iniciando sozinho com o Windows e com backup diário. Conclua antes o
[INSTALACAO.md](INSTALACAO.md) (banco criado, administrador criado e sistema testado com
`npm run dev`).

> Nada aqui expõe o sistema na internet. Não abra portas no roteador nem publique o endereço
> fora da rede interna sem avaliar a segurança com a TI (veja o fim deste guia).

## Três formas de rodar: qual a diferença?

|                    | 1. No seu computador               | 2. Disponível na rede interna                   | 3. Num servidor                    |
| ------------------ | ---------------------------------- | ----------------------------------------------- | ---------------------------------- |
| **Para quê**       | Desenvolver, testar, demonstrar    | Equipe usando de verdade                        | Uso permanente, gerido pela TI     |
| **Quem acessa**    | Só você (`localhost`)              | Quem está na rede/VPN da empresa                | Quem está na rede/VPN da empresa   |
| **Como roda**      | `npm run dev` num terminal aberto  | Versão de produção + Caddy (HTTPS), como tarefa | Igual à 2, numa máquina dedicada   |
| **Fica no ar**     | Enquanto o terminal estiver aberto | Enquanto aquele computador estiver ligado       | Sempre (máquina feita para isso)   |
| **Endereço**       | `http://localhost:5173`            | `https://salas.suaempresa.interno`              | `https://salas.suaempresa.interno` |
| **Banco de dados** | Supabase (o mesmo nos três casos)  | Supabase                                        | Supabase                           |

- **1 → 2:** o que muda é a forma de rodar (versão compilada, HTTPS, início automático) e o
  acesso pela rede. O código é o mesmo.
- **2 → 3:** tecnicamente é igual; a diferença é a máquina. Um computador de mesa desliga,
  reinicia para atualizar e fica sem rede; um servidor (físico ou virtual da TI) fica ligado,
  tem energia e rede estáveis e entra na rotina de manutenção da TI. **Para uso diário pela
  equipe, prefira a opção 3.** A opção 2 serve para um piloto.
- Os dados ficam no Supabase em todos os casos. Trocar de máquina não perde nada: basta instalar
  na nova e usar o mesmo `.env`.

## Arquitetura

```
 Navegadores na rede ── HTTPS (443) ──► Caddy ── HTTP 127.0.0.1:3333 ──► API (Node)
                                        (certificado)                      │  └ entrega o site
                                                                           └── TLS ──► Supabase
```

- A **API** escuta só na própria máquina (`HOST=127.0.0.1`); ninguém da rede fala com ela direto.
- O **Caddy** recebe os acessos, cuida do HTTPS e repassa para a API.
- A API entrega também as telas do sistema (a pasta `apps/web/dist`), no mesmo endereço.
- HTTPS é obrigatório em produção: o login usa cookie `Secure`, que o navegador só envia por HTTPS.

## Requisitos do servidor

- Windows 10/11 ou Windows Server, ligado o tempo todo, com IP fixo (ou reserva no DHCP).
- **Node.js 22 LTS** instalado para todos os usuários (o instalador padrão já faz isso).
- Saída para a internet na porta **5432** até `*.pooler.supabase.com` (o banco). Em redes com
  firewall restritivo, peça a liberação à TI.
- Um **nome no DNS interno** apontando para o IP do servidor (ex.: `salas.suaempresa.interno`).
  Peça à TI. Evite nomes terminados em `.local` (conflitam com descoberta de rede).
- 2 GB de RAM livres e 2 GB de disco são suficientes.

## Passo 1 — Copiar e compilar o sistema

1. Copie a pasta do projeto para **`C:\reserva-salas`** (fora de pastas de usuário; sem
   `node_modules`, `.env` e `backups` de outra máquina).
2. Crie o `.env` a partir do modelo de produção e preencha:

   ```powershell
   cd C:\reserva-salas
   copy deploy\env.producao.example .env
   notepad .env
   ```

   - `APP_ORIGIN`: o endereço exato que as pessoas vão digitar, com `https://`.
   - `DATABASE_URL`: de preferência com o usuário `reserva_app`
     ([BANCO.md](BANCO.md#usuário-da-aplicação-reserva_app)); `DATABASE_MIGRATION_URL` com o
     `postgres`. Se ainda não criou o `reserva_app`, use o `postgres` em `DATABASE_URL` e apague
     a linha `DATABASE_MIGRATION_URL`.
   - Copie o certificado do Supabase para `certs\supabase-ca.crt`
     ([INSTALACAO.md › passo 7](INSTALACAO.md#7-verificação-do-certificado-do-banco-obrigatória-em-produção)).

3. Instale e compile:

   ```powershell
   npm ci
   npm run build
   npm run db:migrate
   ```

   `npm ci` instala exatamente as versões do `package-lock.json`. O `db:migrate` só aplica o que
   faltar (no primeiro uso, normalmente nada).

4. Teste à mão: `npm start` e, em outro PowerShell,
   `Invoke-RestMethod http://127.0.0.1:3333/api/health` → `status: ok`. Pare com `Ctrl+C`.

## Passo 2 — HTTPS com o Caddy

O [Caddy](https://caddyserver.com) é um servidor web gratuito e de código aberto que cuida do
certificado HTTPS automaticamente.

1. Baixe o `caddy.exe` para Windows em <https://caddyserver.com/download> e coloque em
   `C:\caddy\caddy.exe`.
2. Copie `deploy\Caddyfile` para `C:\caddy\Caddyfile` e troque `salas.suaempresa.interno` pelo
   nome do DNS interno (o mesmo do `APP_ORIGIN`).
3. Escolha o certificado:
   - **Certificado da empresa** (melhor, se a TI tiver uma autoridade certificadora interna):
     peça um certificado para o nome do sistema e use a linha `tls C:/caddy/certs/...`
     indicada no Caddyfile. Nada a instalar nos computadores.
   - **Certificado do próprio Caddy** (`tls internal`, o padrão do arquivo): o Caddy cria uma
     autoridade certificadora local. Os computadores precisam confiar nela (passo 5).
4. Registre o Caddy como serviço do Windows (PowerShell **como administrador**):

   ```powershell
   cd C:\caddy
   .\caddy.exe validate --config Caddyfile
   sc.exe create caddy start= auto binPath= "C:\caddy\caddy.exe run --config C:\caddy\Caddyfile"
   sc.exe start caddy
   ```

   (Os espaços depois de `start=` e `binPath=` são obrigatórios.)

5. Somente com `tls internal`: o certificado raiz fica em
   `C:\caddy\dados\pki\authorities\local\root.crt`. Ele precisa ser instalado como
   **Autoridade de Certificação Raiz Confiável** em cada computador que vai acessar o sistema.
   O ideal é a TI distribuir por **Política de Grupo (GPO)**. Num computador avulso
   (PowerShell como administrador):

   ```powershell
   certutil -addstore -f "ROOT" root.crt
   ```

   **Proteja a pasta `C:\caddy\dados`**: quem tiver a chave dessa autoridade consegue emitir
   certificados aceitos pelos computadores onde a raiz foi instalada. Só administradores devem
   ter acesso a ela.

6. Libere a porta no Firewall do Windows do servidor (somente redes de domínio/privadas):

   ```powershell
   New-NetFirewallRule -DisplayName "Reserva de Salas (HTTPS)" -Direction Inbound `
     -Protocol TCP -LocalPort 443 -Action Allow -Profile Domain,Private
   ```

   Não libere a porta 3333: a API só deve ser acessada pelo Caddy.

## Passo 3 — Iniciar a API junto com o Windows

PowerShell **como administrador**, na pasta do projeto:

```powershell
cd C:\reserva-salas
powershell -ExecutionPolicy Bypass -File deploy\registrar-tarefas.ps1
Start-ScheduledTask -TaskName 'Reserva de Salas - API'
```

O script cria duas tarefas agendadas, executadas pela conta **Serviço Local** (poucas
permissões, não é a conta de um administrador):

| Tarefa                      | O que faz                                                 |
| --------------------------- | --------------------------------------------------------- |
| `Reserva de Salas - API`    | Inicia a API com o Windows e a reinicia se ela parar.     |
| `Reserva de Salas - Backup` | Backup diário às 02:00 (mude com `-HorarioBackup 23:30`). |

Ele também restringe o `.env` e a pasta `backups` a administradores e ao próprio serviço.
Os logs ficam em `C:\reserva-salas\logs`.

## Passo 4 — Conferir

1. No servidor: `Invoke-RestMethod http://127.0.0.1:3333/api/health` → `status: ok`.
2. Em outro computador da rede: abra `https://salas.suaempresa.interno`. O navegador deve
   mostrar o cadeado sem avisos e a tela de login.
3. Entre como administrador e confira em **Início** que o banco aparece como conectado.
4. Reinicie o servidor e confira que o sistema volta sozinho.

## Atualizar o sistema

1. Faça um backup: `npm run db:backup` (ou espere o backup diário).
2. Pare a API (PowerShell como administrador):
   `powershell -ExecutionPolicy Bypass -File deploy\parar-servidor.ps1`
3. Substitua os arquivos do projeto pela versão nova, **mantendo** `.env`, `certs\`, `backups\`
   e `logs\`.
4. `npm ci` → `npm run build` → `npm run db:migrate`.
5. Se a versão nova criou tabelas e você usa o `reserva_app`, execute de novo o
   `database\papel-aplicacao.sql` no Supabase.
6. `Start-ScheduledTask -TaskName 'Reserva de Salas - API'` e confira o passo 4.

Se algo der errado, volte os arquivos da versão anterior e repita os passos 4 e 6. Se a versão
nova aplicou migrações e a anterior não funcionar com o banco atualizado, restaure o backup do
passo 1 (veja [MANUTENCAO.md](MANUTENCAO.md#restaurar-um-backup)).

## Problemas comuns

| Sintoma                                         | Causa provável e solução                                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Navegador avisa "conexão não é particular"      | A raiz do Caddy não foi instalada naquele computador (passo 2.5), ou o nome digitado é diferente do Caddyfile.          |
| Página não abre de outro computador             | DNS (teste `nslookup salas.suaempresa.interno`), firewall (porta 443) ou serviço `caddy` parado (`sc.exe query caddy`). |
| `502 Bad Gateway`                               | A API não está rodando. Veja `logs\servico.log` e o último `logs\api-*.erros.log`.                                      |
| Login não "segura" (volta para a tela de login) | `APP_ORIGIN` diferente do endereço digitado (http × https, nome diferente).                                             |
| Todos bloqueados juntos por tentativas de login | `TRUST_PROXY` não está como `loopback`: a API acha que todos vêm do mesmo IP.                                           |
| API não inicia: "Configuração inválida"         | Veja `logs\api-*.log`; a mensagem lista as variáveis do `.env` com problema.                                            |
| `permission denied` no log da API               | Execute de novo `database\papel-aplicacao.sql` (tabela nova sem permissão para o `reserva_app`).                        |

## E se for preciso acessar de fora da empresa?

- **Com VPN da empresa:** quem está fora conecta na VPN e usa o mesmo endereço interno, sem mudar
  nada no sistema. É a opção mais protegida.
- **Sem servidor nem VPN:** publique na internet pelo Render, seguindo [RENDER.md](RENDER.md).
  Leia antes a seção "O que muda na internet" daquele guia.
