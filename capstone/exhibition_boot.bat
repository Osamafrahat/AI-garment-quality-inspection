@echo off
REM ThreadSight exhibition bootstrap (Windows)
cd /d "%~dp0"

echo [1/4] ML venv...
if not exist ml\.venv python -m venv ml\.venv
call ml\.venv\Scripts\activate.bat
pip -q -r ml\requirements.txt
if not exist ml\dataset\train\ok python ml\generate_dataset.py --per-class 500
if not exist ml\artifacts\model.pkl python ml\train.py --backend sklearn --trees 400
python ml\evaluate.py --min-accuracy 0.80

echo [2/4] Gateway venv...
if not exist gateway\.venv python -m venv gateway\.venv
call gateway\.venv\Scripts\activate.bat
pip -q -r gateway\requirements.txt

echo [3/4] Start gateway (new window)...
start "ThreadSight Gateway" cmd /k "cd /d %~dp0gateway && .venv\Scripts\python.exe main.py"

echo [4/4] Dashboard: from repo root run  pnpm dev  then open http://localhost:3000/inspection
echo Demo stream: gateway\.venv\Scripts\python.exe simulate.py --count 30
pause
