param(
    [ValidateRange(1, 1000000)] [int]$MaxPages = 100,
    [ValidateRange(0, 60000)] [int]$DelayMs = 900,
    [ValidateRange(0, 1000000)] [int]$TargetRepos = 0,
    [ValidateRange(0, 3600)] [int]$PauseSeconds = 5
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
foreach ($platform in @('ethglobal', 'blitz', 'devfolio', 'hackquest', 'dorahacks', 'hackathonprojects')) {
    Start-Process -FilePath powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "$root\run-platform-continuously.ps1", '-Platform', $platform, '-MaxPages', $MaxPages, '-DelayMs', $DelayMs, '-TargetRepos', $TargetRepos, '-PauseSeconds', $PauseSeconds) -WorkingDirectory $root -WindowStyle Hidden
}
