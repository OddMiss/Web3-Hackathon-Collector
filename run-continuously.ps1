$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root

while ($true) {
    # Each invocation writes progress before moving on, so a reboot or manual
    # stop can resume from state.json without duplicating repositories.
    & node .\crawl-and-clone.mjs --max-pages=100 --delay-ms=900 --target-repos=1000

    if (-not (Test-Path -LiteralPath .\state.json)) { break }
    $state = Get-Content -Raw -LiteralPath .\state.json | ConvertFrom-Json
    $cloned = @($state.repositories.PSObject.Properties.Value | Where-Object { $_.status -eq 'cloned' }).Count
    if ($cloned -ge 1000) { break }
    if ($state.queue.Count -eq 0) { break }
    Start-Sleep -Seconds 5
}
