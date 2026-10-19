$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

# Runs serially so state.json remains an atomic, single-writer de-duplication
# registry across every platform.
foreach ($platform in @('ethglobal', 'blitz', 'devfolio', 'hackquest', 'dorahacks', 'hackathonprojects')) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\run-platform-continuously.ps1 -Platform $platform
}
