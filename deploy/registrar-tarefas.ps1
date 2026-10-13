<#
.SYNOPSIS
  Cria as tarefas agendadas do MeetKof no servidor Windows.

.DESCRIPTION
  Execute UMA vez, como administrador, na pasta do projeto no servidor:
    powershell -ExecutionPolicy Bypass -File deploy\registrar-tarefas.ps1

  Cria (ou atualiza):
    "MeetKof - API"     inicia a API quando o Windows liga (iniciar-servidor.ps1)
    "MeetKof - Backup"  backup diário dos dados (backup-diario.ps1)

  As duas rodam com a conta "Serviço Local" (LOCAL SERVICE), que tem poucas permissões no
  Windows, e não com a conta de um administrador. O script dá a essa conta:
    - leitura na pasta do projeto;
    - gravação somente em logs\ e backups\.
  Guia: docs\IMPLANTACAO.md
#>
#Requires -RunAsAdministrator
param(
  [ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')][string]$HorarioBackup = '02:00',
  [switch]$SemBackup
)
$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $raiz 'apps\api\dist\server.js'))) {
  throw "Execute 'npm run build' antes (não encontrei apps\api\dist\server.js)."
}
if (-not (Test-Path (Join-Path $raiz '.env'))) {
  throw "Crie o arquivo .env em $raiz antes (modelo: deploy\env.producao.example)."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js não encontrado no PATH do sistema. Instale o Node.js LTS para todos os usuários.'
}

# Serviço Local, pelo identificador (funciona em Windows em qualquer idioma).
$servicoLocal = '*S-1-5-19'
$pastaLogs = Join-Path $raiz 'logs'
$pastaBackups = Join-Path $raiz 'backups'
New-Item -ItemType Directory -Force -Path $pastaLogs, $pastaBackups | Out-Null

function Permitir([string[]]$argumentos) {
  & icacls.exe @argumentos | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível ajustar permissões: icacls $($argumentos -join ' ')" }
}
Permitir @($raiz, '/grant', "${servicoLocal}:(OI)(CI)RX", '/T', '/Q')
Permitir @($pastaLogs, '/grant', "${servicoLocal}:(OI)(CI)M", '/T', '/Q')
Permitir @($pastaBackups, '/grant', "${servicoLocal}:(OI)(CI)M", '/T', '/Q')

# O .env tem as senhas do banco: só administradores, o sistema e o serviço podem lê-lo.
#   *S-1-5-32-544 = Administradores   *S-1-5-18 = Sistema
Permitir @((Join-Path $raiz '.env'), '/inheritance:r', '/grant:r', '*S-1-5-32-544:F', '*S-1-5-18:F', "${servicoLocal}:R", '/Q')
# Os backups têm dados pessoais: sem acesso para usuários comuns.
Permitir @($pastaBackups, '/inheritance:r', '/grant:r', '*S-1-5-32-544:(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', "${servicoLocal}:(OI)(CI)M", '/Q')

$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$principal = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\LOCAL SERVICE' -LogonType ServiceAccount

# --- API ---------------------------------------------------------------
$acaoApi = New-ScheduledTaskAction -Execute $powershell -WorkingDirectory $raiz `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'iniciar-servidor.ps1')`""
$gatilhoApi = New-ScheduledTaskTrigger -AtStartup
$configApi = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'MeetKof - API' -Force `
  -Description 'API e site do sistema MeetKof (deploy\iniciar-servidor.ps1).' `
  -Action $acaoApi -Trigger $gatilhoApi -Principal $principal -Settings $configApi | Out-Null
Write-Host "Tarefa 'MeetKof - API' registrada (inicia junto com o Windows)."

# --- Backup ------------------------------------------------------------
if (-not $SemBackup) {
  $acaoBackup = New-ScheduledTaskAction -Execute $powershell -WorkingDirectory $raiz `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'backup-diario.ps1')`""
  $gatilhoBackup = New-ScheduledTaskTrigger -Daily -At $HorarioBackup
  $configBackup = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName 'MeetKof - Backup' -Force `
    -Description 'Backup diário dos dados do MeetKof (deploy\backup-diario.ps1).' `
    -Action $acaoBackup -Trigger $gatilhoBackup -Principal $principal -Settings $configBackup | Out-Null
  Write-Host "Tarefa 'MeetKof - Backup' registrada (todos os dias às $HorarioBackup)."
}

Write-Host ''
Write-Host "Para iniciar agora:  Start-ScheduledTask -TaskName 'MeetKof - API'"
Write-Host "Para testar o backup: Start-ScheduledTask -TaskName 'MeetKof - Backup'"
Write-Host "Acompanhe em: $pastaLogs"
