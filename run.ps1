# =====================================================================
#  Thanaweya Amma 2026 Analytics — one-command runner (Windows/PowerShell)
#  Usage:
#     ./run.ps1            # build data if missing, then serve
#     ./run.ps1 -Build     # force a full pipeline rebuild, then serve
#     ./run.ps1 -Port 8080 # serve on a custom port
# =====================================================================
param(
    [switch]$Build,
    [int]$Port = 8000
)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$db = Join-Path $PSScriptRoot "data\students.db"

if ($Build -or -not (Test-Path $db)) {
    Write-Host "==> Building analytics pipeline (first run reads the workbook, ~2-3 min)..." -ForegroundColor Cyan
    if ($Build) { python -m pipeline.build --force } else { python -m pipeline.build }
} else {
    Write-Host "==> Data artefacts found; skipping build (use -Build to rebuild)." -ForegroundColor DarkGray
}

Write-Host "==> Starting API + web app at http://127.0.0.1:$Port" -ForegroundColor Green
python -m uvicorn backend.main:app --host 127.0.0.1 --port $Port
