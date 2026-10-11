<#
.SYNOPSIS
  Backup diário dos dados do Reserva de Salas, com limpeza de backups e logs antigos.

.DESCRIPTION
  Executado pela tarefa agendada "Reserva de Salas - Backup" (criada por registrar-tarefas.ps1).
  Também pode ser executado à mão:
    powershell -ExecutionPolicy Bypass -File deploy\backup-diario.ps1

  - Gera <Pasta>\reserva-AAAA-MM-DD-HHmm.sql com "node apps\api\dist\backup.js".
  - Só apaga backups com mais de -ManterDias dias se o backup de hoje deu certo.
  - Apaga logs da API com mais de -ManterLogsDias dias.
  - Resultado em <projeto>\logs\backup.log.
  Os backups contêm dados pessoais: a pasta deve ter acesso restrito. Guia: docs\MANUTENCAO.md
#>
param(
  [string]$Pasta = (Join-Path (Split-Path -Parent $PSScriptRoot) 'backups'),
  [ValidateRange(1, 3650)][int]$ManterDias = 30,
  [ValidateRange(1, 3650)][int]$ManterLogsDias = 90
)
$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
$script = Join-Path $raiz 'apps\api\dist\backup.js'
$pastaLogs = Join-Path $raiz 'logs'
New-Item -ItemType Directory -Force -Path $pastaLogs, $Pasta | Out-Null
$logBackup = Join-Path $pastaLogs 'backup.log'

function Registrar([string]$mensagem) {
  $linha = '{0} {1}' -f (Get-Date -Format 's'), $mensagem
  Add-Content -Path $logBackup -Value $linha -Encoding UTF8
  Write-Host $linha
}

if (-not (Test-Path $script)) {
  Registrar "ERRO: não encontrei $script. Execute 'npm run build' antes."
  exit 1
}
$node = (Get-Command node -ErrorAction Stop).Source
# Ler a saída do Node (UTF-8) sem trocar acentos por símbolos estranhos.
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
$destino = Join-Path $Pasta ('reserva-{0}.sql' -f (Get-Date -Format 'yyyy-MM-dd-HHmm'))

Push-Location $raiz
try {
  # O Node escreve mensagens em stderr quando falha; não tratar isso como exceção do PowerShell.
  $ErrorActionPreference = 'Continue'
  $saida = (& $node $script $destino 2>&1 | ForEach-Object { "$_" }) -join ' '
  $codigo = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
} finally {
  Pop-Location
}

if ($codigo -ne 0 -or -not (Test-Path $destino)) {
  Registrar "ERRO no backup (código $codigo): $($saida.Trim())"
  Registrar 'Nenhum backup antigo foi apagado.'
  exit 1
}
$tamanho = [Math]::Round((Get-Item $destino).Length / 1KB, 1)
Registrar "OK: $destino ($tamanho KB). $($saida -replace '\s+', ' ')"

$limite = (Get-Date).AddDays(-$ManterDias)
Get-ChildItem -Path $Pasta -Filter 'reserva-*.sql' -File |
  Where-Object { $_.LastWriteTime -lt $limite } |
  ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force
    Registrar "Backup antigo apagado: $($_.Name)"
  }

$limiteLogs = (Get-Date).AddDays(-$ManterLogsDias)
Get-ChildItem -Path $pastaLogs -Filter 'api-*.log' -File |
  Where-Object { $_.LastWriteTime -lt $limiteLogs } |
  Remove-Item -Force
exit 0
