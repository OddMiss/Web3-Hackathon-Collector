$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

while (Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match 'rebuild-state\.mjs' }) {
    Start-Sleep -Seconds 10
}

$state = Get-Content -Raw -LiteralPath .\state.json | ConvertFrom-Json
if (-not $state.rebuiltAt) { throw 'State rebuild did not complete; collection was not restarted.' }

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\run-platforms-parallel.ps1
