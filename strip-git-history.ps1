param(
  [Parameter(Mandatory = $true)]
  [string]$Platform
)

$repositoryRoot = Join-Path $PSScriptRoot 'repositories'
$platformRoot = Join-Path $repositoryRoot $Platform
if (-not (Test-Path -LiteralPath $platformRoot -PathType Container)) {
  throw "Unknown platform directory: $Platform"
}

$removed = 0
$failed = 0
$projects = @(Get-ChildItem -LiteralPath $platformRoot -Directory -Force)
foreach ($project in $projects) {
  $historyDir = Join-Path $project.FullName '.git'
  if (-not [System.IO.Directory]::Exists($historyDir)) { continue }

  try {
    Remove-Item -LiteralPath $historyDir -Recurse -Force -ErrorAction Stop
  } catch {
    # Clear read-only, system and hidden attributes left by some Git packs,
    # then retry exactly the same project-local history directory.
    & attrib.exe -r -s -h "$historyDir\*" /s /d 2>$null
    Remove-Item -LiteralPath $historyDir -Recurse -Force -ErrorAction SilentlyContinue
  }

  if ([System.IO.Directory]::Exists($historyDir)) { $failed++ } else { $removed++ }
}

[PSCustomObject]@{
  platform = $Platform
  removed = $removed
  remaining = $failed
  finishedAt = (Get-Date).ToString('o')
} | ConvertTo-Json -Compress
