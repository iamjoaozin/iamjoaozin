$ErrorActionPreference = "Stop"

$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseRoot = Join-Path $project "release"
$packageDir = Join-Path $project "dist\NORDLYS_CLIENTE"
$legacyPackageDir = Join-Path $releaseRoot "NORDLYS_Client"
$zipPath = Join-Path $releaseRoot "NORDLYS_Client_v16.23_CONTAINER_FIREFOX_FIX.zip"
$python = Join-Path $project ".venv\Scripts\python.exe"

Push-Location (Join-Path $project "web_dashboard")
try {
    npm run build
}
finally {
    Pop-Location
}

& $python -m PyInstaller --noconfirm --clean (Join-Path $project "NORDLYS.spec")

Copy-Item -LiteralPath (Join-Path $project "mac_ui_templates") -Destination $packageDir -Recurse
Copy-Item -LiteralPath (Join-Path $project "LEIA-ME-CLIENTE.txt") -Destination $packageDir
Copy-Item -LiteralPath (Join-Path $project "network_scenarios.example.json") -Destination $packageDir

Set-Content -LiteralPath (Join-Path $packageDir "successful_registrations.csv") -Encoding UTF8 -Value "timestamp,total_success_count,scenario_success_count,scenario_name,attempt_number,username,email,password,proxy_scheme,proxy_host,proxy_port"
Set-Content -LiteralPath (Join-Path $packageDir "form_error_occurrences.csv") -Encoding UTF8 -Value "timestamp,total_error_count,scenario_error_count,scenario_name,attempt_number,username,email,password"

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
if (Test-Path -LiteralPath $legacyPackageDir) {
    Remove-Item -LiteralPath $legacyPackageDir -Recurse -Force
}
Compress-Archive -LiteralPath $packageDir -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Pacote criado em: $zipPath"
