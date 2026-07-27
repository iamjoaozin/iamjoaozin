@echo off
cd /d "%~dp0"
if not exist "web_dashboard\dist\index.html" (
  pushd "web_dashboard"
  call npm run build
  popd
)
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" mac_proxy_web_panel.py
) else (
  py mac_proxy_web_panel.py
)
