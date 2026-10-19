param(
    [ValidateRange(1, 1000000)] [int]$MaxPages = 100,
    [ValidateRange(0, 60000)] [int]$DelayMs = 900,
    [ValidateRange(0, 1000000)] [int]$TargetRepos = 0,
    [ValidateRange(0, 3600)] [int]$PauseSeconds = 5
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

while ($true) {
    # Each invocation writes progress before moving on, so a reboot or manual
    # stop can resume from state.json without duplicating repositories.
    $collectorArgs = @('.\crawl-and-clone.mjs', "--max-pages=$MaxPages", "--delay-ms=$DelayMs")
    if ($TargetRepos -gt 0) { $collectorArgs += "--target-repos=$TargetRepos" }
    & node @collectorArgs

    if (-not (Test-Path -LiteralPath .\state.json)) { break }
    $state = Get-Content -Raw -LiteralPath .\state.json | ConvertFrom-Json
    $cloned = @($state.repositories.PSObject.Properties.Value | Where-Object { $_.status -eq 'cloned' }).Count
    if ($TargetRepos -gt 0 -and $cloned -ge $TargetRepos) { break }
    if ($state.queue.Count -eq 0) { break }
    Start-Sleep -Seconds $PauseSeconds
}
