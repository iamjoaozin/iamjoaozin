@echo off
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" mac_proxy_ui_panel.py
) else (
  py mac_proxy_ui_panel.py
)
