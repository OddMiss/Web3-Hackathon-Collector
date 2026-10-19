param(
    [ValidateRange(1, 1000000)] [int]$MaxPages = 100,
    [ValidateRange(0, 60000)] [int]$DelayMs = 900,
    [ValidateRange(0, 1000000)] [int]$TargetRepos = 0,
    [ValidateRange(0, 3600)] [int]$PauseSeconds = 5
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

# Runs serially so state.json remains an atomic, single-writer de-duplication
# registry across every platform.
foreach ($platform in @('ethglobal', 'blitz', 'devfolio', 'hackquest', 'dorahacks', 'hackathonprojects')) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\run-platform-continuously.ps1 -Platform $platform -MaxPages $MaxPages -DelayMs $DelayMs -TargetRepos $TargetRepos -PauseSeconds $PauseSeconds
}
