// 행운볼 레이스 — Windows 실행 파일
// Windows에 들어 있는 WebView2(Edge 엔진)로 게임 화면을 띄웁니다.
// WebView2가 없는 PC에서는 기본 브라우저로 엽니다.
package main

import (
	_ "embed"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"

	webview2 "github.com/jchv/go-webview2"
)

//go:embed index.html
var page []byte

func main() {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base = os.TempDir()
	}
	dir := filepath.Join(base, "LuckyBallRace")
	_ = os.MkdirAll(dir, 0o755)
	// 게임 파일을 고정된 위치에 두어야 최근 입력한 이름 · 설정이 계속 남습니다.
	file := filepath.Join(dir, "index.html")
	_ = os.WriteFile(file, page, 0o644)
	u := (&url.URL{Scheme: "file", Path: "/" + filepath.ToSlash(file)}).String()

	w := webview2.NewWithOptions(webview2.WebViewOptions{
		AutoFocus: true,
		DataPath:  filepath.Join(dir, "webview"),
		WindowOptions: webview2.WindowOptions{
			Title:  "행운볼 레이스",
			Width:  1366,
			Height: 860,
			IconId: 2, // rsrc: 1 = manifest, 2 = 아이콘 묶음
			Center: true,
		},
	})
	if w == nil {
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", u).Start()
		return
	}
	defer w.Destroy()
	w.SetSize(800, 600, webview2.HintMin)
	w.Navigate(u)
	w.Run()
}
