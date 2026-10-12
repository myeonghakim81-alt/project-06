@echo off
chcp 65001 >nul
setlocal
rem 행운볼 레이스 설치: 내 PC에 복사하고 바탕화면 · 시작 메뉴에 바로가기를 만듭니다. (관리자 권한 필요 없음)
set "SRC=%~dp0"
set "DEST=%LocalAppData%\LuckyBallRace"
set "LNKNAME=행운볼 레이스"
if not exist "%SRC%lucky-ball-race.html" (
  echo lucky-ball-race.html 을 찾지 못했습니다. 압축을 모두 푼 폴더에서 실행해 주세요.
  pause
  exit /b 1
)
if not exist "%DEST%" mkdir "%DEST%"
copy /y "%SRC%lucky-ball-race.html" "%DEST%\" >nul
copy /y "%SRC%LuckyBallRace.bat" "%DEST%\" >nul
copy /y "%SRC%Uninstall.bat" "%DEST%\" >nul
copy /y "%SRC%icon.ico" "%DEST%\" >nul
set "TARGET=%DEST%\LuckyBallRace.bat"
set "ICON=%DEST%\icon.ico"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell; foreach($dir in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))){ $s=$w.CreateShortcut((Join-Path $dir ($env:LNKNAME + '.lnk'))); $s.TargetPath=$env:TARGET; $s.WorkingDirectory=$env:DEST; $s.IconLocation=$env:ICON; $s.WindowStyle=7; $s.Description='행운볼 레이스'; $s.Save() }"
if errorlevel 1 (
  echo 바로가기를 만들지 못했습니다. %DEST%\LuckyBallRace.bat 을 직접 실행해 주세요.
) else (
  echo 설치가 끝났습니다. 바탕화면의 "행운볼 레이스" 아이콘으로 실행하세요.
)
pause
