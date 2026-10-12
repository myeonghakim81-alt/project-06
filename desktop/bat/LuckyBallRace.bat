@echo off
chcp 65001 >nul
setlocal
rem 행운볼 레이스 실행: Edge(또는 크롬)의 앱 창으로 엽니다. 브라우저가 없으면 기본 브라우저로 엽니다.
set "GAME=%~dp0lucky-ball-race.html"
if not exist "%GAME%" (
  echo 게임 파일 lucky-ball-race.html 을 찾지 못했습니다.
  echo 이 bat 파일과 같은 폴더에 lucky-ball-race.html 이 있어야 합니다.
  pause
  exit /b 1
)
set "URL=file:///%GAME:\=/%"
set "BROWSER="
for %%P in ("%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" "%LocalAppData%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe") do (
  if not defined BROWSER if exist "%%~P" set "BROWSER=%%~P"
)
if defined BROWSER (
  start "" "%BROWSER%" --app="%URL%" --window-size=1366,860
) else (
  start "" "%GAME%"
)
exit /b 0
