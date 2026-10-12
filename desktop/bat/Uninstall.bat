@echo off
chcp 65001 >nul
setlocal
rem 행운볼 레이스 삭제: 바로가기와 설치 폴더를 지웁니다.
set "LNKNAME=행운볼 레이스"
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach($dir in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))){ $p=Join-Path $dir ($env:LNKNAME + '.lnk'); if(Test-Path $p){ Remove-Item $p } }"
echo 바로가기를 지웠습니다.
cd /d "%TEMP%"
rmdir /s /q "%LocalAppData%\LuckyBallRace" 2>nul
echo 설치 폴더를 지웠습니다.
pause
