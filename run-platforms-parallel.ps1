$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
foreach ($platform in @('ethglobal', 'blitz', 'devfolio', 'hackquest', 'dorahacks', 'hackathonprojects')) {
    Start-Process -FilePath powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "$root\run-platform-continuously.ps1", '-Platform', $platform) -WorkingDirectory $root -WindowStyle Hidden
}
