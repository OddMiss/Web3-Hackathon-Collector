$ErrorActionPreference = 'Continue'
$repositoryRoot = Join-Path $PSScriptRoot 'repositories'
if (-not (Test-Path -LiteralPath $repositoryRoot -PathType Container)) {
    throw "Repository directory not found: $repositoryRoot"
}

$removed = 0
$failed = 0
$remaining = 0

function Remove-NodeModulesWithin([string]$Directory) {
    foreach ($child in @(Get-ChildItem -LiteralPath $Directory -Directory -Force -ErrorAction SilentlyContinue)) {
        if ($child.Name -eq 'node_modules') {
            try {
                Remove-Item -LiteralPath $child.FullName -Recurse -Force -ErrorAction Stop
                $script:removed++
            } catch {
                $script:failed++
                $script:remaining++
            }
            continue
        }
        Remove-NodeModulesWithin $child.FullName
    }
}

Remove-NodeModulesWithin $repositoryRoot
[PSCustomObject]@{
    removed = $removed
    failed = $failed
    remaining = $remaining
} | ConvertTo-Json -Compress
