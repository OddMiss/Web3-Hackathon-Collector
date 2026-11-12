param(
    [ValidateSet('ethglobal', 'blitz', 'devfolio', 'hackquest', 'dorahacks', 'hackathonprojects', 'github-discovery')]
    [string[]]$Platform,

    [switch]$TopLevelOnly
)

$ErrorActionPreference = 'Continue'
$repositoryRoot = Join-Path $PSScriptRoot 'repositories'
if (-not (Test-Path -LiteralPath $repositoryRoot -PathType Container)) {
    throw "Repository directory not found: $repositoryRoot"
}

$platforms = if ($Platform) { $Platform } else {
    @(Get-ChildItem -LiteralPath $repositoryRoot -Directory -Force | Select-Object -ExpandProperty Name)
}
$results = @()

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
        if (-not $TopLevelOnly) { Remove-NodeModulesWithin $child.FullName }
    }
}

foreach ($platformName in $platforms) {
    $platformRoot = Join-Path $repositoryRoot $platformName
    if (-not (Test-Path -LiteralPath $platformRoot -PathType Container)) {
        throw "Platform directory not found: $platformName"
    }
    $removed = 0
    $failed = 0
    $remaining = 0
    if ($TopLevelOnly) {
        foreach ($project in @(Get-ChildItem -LiteralPath $platformRoot -Directory -Force -ErrorAction SilentlyContinue)) {
            Remove-NodeModulesWithin $project.FullName
        }
    } else {
        Remove-NodeModulesWithin $platformRoot
    }
    $results += [PSCustomObject]@{
        platform = $platformName
        removed = $removed
        failed = $failed
        remaining = $remaining
    }
}

$results | ConvertTo-Json -Compress
