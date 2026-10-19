param([Parameter(Mandatory = $true)][string]$Platform)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root
while ($true) {
    & node .\crawl-and-clone.mjs --platform=$Platform --state-file=state-$Platform.json --max-pages=100 --delay-ms=900 --target-repos=1000
    $state = Get-Content -Raw -LiteralPath .\state-$Platform.json | ConvertFrom-Json
    $count = @($state.repositories.PSObject.Properties.Value | Where-Object { $_.status -eq 'cloned' -and $_.platform -eq $Platform }).Count
    if ($count -ge 1000 -or $state.queue.Count -eq 0) { break }
    Start-Sleep -Seconds 5
}
