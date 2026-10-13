<#
.SYNOPSIS
  Para a API do MeetKof (tarefa agendada e processo do Node).

.DESCRIPTION
  Use antes de atualizar o sistema. Execute como administrador:
    powershell -ExecutionPolicy Bypass -File deploy\parar-servidor.ps1
  Para iniciar de novo: Start-ScheduledTask -TaskName 'MeetKof - API'
#>
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$raiz = Split-Path -Parent $PSScriptRoot
$servidor = Join-Path $raiz 'apps\api\dist\server.js'
$nomeTarefa = 'MeetKof - API'

if (Get-ScheduledTask -TaskName $nomeTarefa -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $nomeTarefa
  Write-Host "Tarefa '$nomeTarefa' parada."
}

# Encerrar a tarefa nem sempre encerra o processo do Node iniciado por ela.
$processos = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine.Contains($servidor) }
foreach ($p in $processos) {
  Stop-Process -Id $p.ProcessId -Force
  Write-Host "Processo da API encerrado (PID $($p.ProcessId))."
}
if (-not $processos) { Write-Host 'Nenhum processo da API estava rodando.' }
