#!/usr/bin/env bash
# Windows용 배포 파일을 만듭니다.
#   dist/LuckyBallRace-bat.zip   : 게임 HTML + 실행/설치 bat (용량 작음, Edge/크롬 사용)
#   dist/LuckyBallRace-win64.zip : 단독 실행 LuckyBallRace.exe (Electron, 브라우저 불필요)
# 사용법: bash tools/build-windows.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_VERSION="${ELECTRON_VERSION:-31.7.7}"
DIST="$ROOT/dist"
WORK="$DIST/work"
rm -rf "$WORK"; mkdir -p "$WORK" "$DIST"

node "$ROOT/tools/build.cjs"

# 1) bat 버전
BAT="$WORK/LuckyBallRace"
mkdir -p "$BAT"
cp "$ROOT/lucky-ball-race.html" "$ROOT/desktop/icon.ico" "$ROOT"/desktop/bat/* "$BAT/"
rm -f "$DIST/LuckyBallRace-bat.zip"
(cd "$WORK" && zip -qr "$DIST/LuckyBallRace-bat.zip" LuckyBallRace)

# 2) exe 버전 (Electron 실행 파일에 게임을 넣음)
ZIP="$DIST/electron-v$ELECTRON_VERSION-win32-x64.zip"
if [ ! -f "$ZIP" ]; then
  curl -fsSL -o "$ZIP" "https://github.com/electron/electron/releases/download/v$ELECTRON_VERSION/electron-v$ELECTRON_VERSION-win32-x64.zip"
fi
APP="$WORK/LuckyBallRace-win64"
mkdir -p "$APP"
unzip -q "$ZIP" -d "$APP"
mv "$APP/electron.exe" "$APP/LuckyBallRace.exe"
# 한국어 · 영어 외 언어 파일은 빼서 용량 줄이기
find "$APP/locales" -name '*.pak' ! -name 'ko.pak' ! -name 'en-US.pak' -delete
rm -f "$APP/LICENSES.chromium.html" "$APP/resources/default_app.asar"
mkdir -p "$APP/resources/app"
cp "$ROOT/desktop/electron/package.json" "$ROOT/desktop/electron/main.js" "$ROOT/desktop/icon.ico" "$APP/resources/app/"
cp "$ROOT/lucky-ball-race.html" "$APP/resources/app/index.html"
cp "$ROOT/desktop/README-exe.txt" "$APP/README.txt"
rm -f "$DIST/LuckyBallRace-win64.zip"
(cd "$WORK" && zip -qr -9 "$DIST/LuckyBallRace-win64.zip" LuckyBallRace-win64)

ls -lh "$DIST"/*.zip
