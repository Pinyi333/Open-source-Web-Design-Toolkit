@echo off
chcp 65001 >nul
title GitHub Update Commit

echo ==============================
echo     GitHub Update Commit
echo ==============================
echo.

:: 檢查 Git
git --version >nul 2>&1
if errorlevel 1 (
    echo [錯誤] Git 未安裝！
    pause
    exit /b 1
)

:: 檢查是否為 Git Repository
if not exist ".git" (
    echo [錯誤] 目前不是 Git Repository！
    echo        請先執行 github-init.bat 初始化。
    pause
    exit /b 1
)

:: ==========================
:: 先報告「這次會推到哪裡」
:: 推錯 repository 時，這裡就會看出來
:: ==========================
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo [錯誤] 這個專案沒有設定 origin，push 一定會失敗。
    echo        請先執行 github-init.bat，或手動設定：
    echo            git remote add origin ^<你的 repository 網址^>
    pause
    exit /b 1
)

echo [Remote] 這次會推到：
for /f "delims=" %%R in ('git remote get-url origin') do echo     %%R
echo.

set BRANCH=
for /f "delims=" %%B in ('git branch --show-current') do set BRANCH=%%B
if "%BRANCH%"=="" (
    echo [錯誤] 目前不在任何分支上（detached HEAD）。
    echo        請先切回分支再執行，例如：git checkout main
    pause
    exit /b 1
)
echo [Branch] %BRANCH%
echo.

:: 查看修改
echo [Changes]
git status --short
echo.

:: ==========================
:: Commit
:: ==========================
set COMMIT_MSG=
set /p COMMIT_MSG=Commit Message：

if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update project

echo.
echo Adding files...
git add -A

echo.
echo Commit...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo.
    echo [提醒] 這次沒有新的 commit 產生（通常代表沒有任何檔案變更）。
    echo        仍會繼續檢查有沒有先前累積、還沒推上去的 commit。
)

:: ==========================
:: Push
:: ==========================
echo.
echo Push...
git push -u origin %BRANCH%
if errorlevel 1 goto PUSH_FAILED

:: push 回報成功還不夠，實際比對本地與遠端是否真的一致
set AHEAD=
for /f "delims=" %%C in ('git rev-list --count origin/%BRANCH%..%BRANCH% 2^>nul') do set AHEAD=%%C
if not "%AHEAD%"=="0" goto PUSH_FAILED

echo.
echo ==============================
echo        Push Complete!
echo ==============================
echo.
echo GitHub 上最新的 commit：
git log -1 --oneline
echo.
pause
exit /b 0


:PUSH_FAILED
echo.
echo ==============================
echo    !!  PUSH 失敗，尚未上傳  !!
echo ==============================
echo.
echo 你的 commit 目前只存在這台電腦，GitHub 上看不到。
echo 檔案沒有遺失，修好下面的問題後重跑本檔即可補上。
echo.
echo 還沒推上去的 commit：
git log --oneline origin/%BRANCH%..%BRANCH% 2>nul
if errorlevel 1 (
    echo     ^(遠端還沒有 %BRANCH% 這個分支，以下是本地全部的 commit^)
    git log --oneline -10
)
echo.
echo 常見原因：
echo     1. 沒有網路，或 GitHub 登入憑證過期／被撤銷
echo     2. 上面那個 Remote 指向的 repository 不存在
echo        （github-init.bat 不會幫你在 GitHub 上建 repository，要先自己建）
echo     3. 遠端有新的 commit，需要先執行 github-pull.bat
echo.
pause
exit /b 1
