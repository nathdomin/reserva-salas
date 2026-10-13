<#
.SYNOPSIS
  Inicia a API do MeetKof (versão de produção) e a reinicia se ela parar.

.DESCRIPTION
  Executado pela tarefa agendada "MeetKof - API" (criada por registrar-tarefas.ps1).
  Também pode ser executado à mão para testar:
    powershell -ExecutionPolicy Bypass -File deploy\iniciar-servidor.ps1

  A saída da API vai para <projeto>\logs\api-AAAA-MM-DD-HHmmss.log (um arquivo a cada início).
  Requer "npm run build" executado antes. Guia: docs\IMPLANTACAO.md
#>
$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
$servidor = Join-Path $raiz 'apps\api\dist\server.js'
$pastaLogs = Join-Path $raiz 'logs'

if (-not (Test-Path $servidor)) {
  throw "Não encontrei $servidor. Execute 'npm run build' na pasta do projeto antes."
}
if (-not (Test-Path (Join-Path $raiz '.env'))) {
  throw "Não encontrei o arquivo .env em $raiz."
}
$node = (Get-Command node -ErrorAction Stop).Source
New-Item -ItemType Directory -Force -Path $pastaLogs | Out-Null

function Registrar([string]$mensagem) {
  $linha = '{0} {1}' -f (Get-Date -Format 's'), $mensagem
  Add-Content -Path (Join-Path $pastaLogs 'servico.log') -Value $linha -Encoding UTF8
}

$falhasSeguidas = 0
while ($true) {
  $carimbo = Get-Date -Format 'yyyy-MM-dd-HHmmss'
  $saida = Join-Path $pastaLogs "api-$carimbo.log"
  $erros = Join-Path $pastaLogs "api-$carimbo.erros.log"

  Registrar "Iniciando a API (log: $saida)"
  $inicio = Get-Date
  $processo = Start-Process -FilePath $node -ArgumentList "`"$servidor`"" `
    -WorkingDirectory $raiz -NoNewWindow -PassThru -Wait `
    -RedirectStandardOutput $saida -RedirectStandardError $erros
  $codigo = $processo.ExitCode

  # Se a API cai logo após iniciar (ex.: .env inválido), espera cada vez mais (até 5 min)
  # para não encher a pasta de logs.
  if (((Get-Date) - $inicio).TotalMinutes -lt 2) { $falhasSeguidas++ } else { $falhasSeguidas = 0 }
  $espera = [Math]::Min(300, 10 * [Math]::Pow(2, [Math]::Min($falhasSeguidas, 5)))
  Registrar "A API parou (código $codigo). Reiniciando em $espera s. Motivo em $saida (ou $erros)"
  Start-Sleep -Seconds $espera
}
