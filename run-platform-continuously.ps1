param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('ethglobal', 'blitz', 'devfolio', 'hackquest', 'dorahacks', 'hackathonprojects')]
    [string]$Platform,

    [ValidateRange(1, 1000000)]
    [int]$MaxPages = 100,

    [ValidateRange(0, 60000)]
    [int]$DelayMs = 900,

    # Set a positive value to stop after that many successful clones.  Zero
    # means no clone-count limit; the run stops when its queue is exhausted.
    [ValidateRange(0, 1000000)]
    [int]$TargetRepos = 0,

    [ValidateRange(0, 3600)]
    [int]$PauseSeconds = 5
)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root
while ($true) {
    $collectorArgs = @(
        '.\crawl-and-clone.mjs',
        "--platform=$Platform",
        "--state-file=state-$Platform.json",
        "--max-pages=$MaxPages",
        "--delay-ms=$DelayMs"
    )
    if ($TargetRepos -gt 0) { $collectorArgs += "--target-repos=$TargetRepos" }
    & node @collectorArgs

    $state = Get-Content -Raw -LiteralPath .\state-$Platform.json | ConvertFrom-Json
    $count = @($state.repositories.PSObject.Properties.Value | Where-Object { $_.status -eq 'cloned' -and $_.platform -eq $Platform }).Count
    if (($TargetRepos -gt 0 -and $count -ge $TargetRepos) -or $state.queue.Count -eq 0) { break }
    Start-Sleep -Seconds $PauseSeconds
}
