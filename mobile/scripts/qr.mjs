// Render the Expo Go connection QR as a page.
// Metro prints a QR into its own terminal; when it runs detached (start-local.sh,
// or an agent session) that terminal is nobody's window — so write the QR to a
// file the owner can actually look at.
//   node scripts/qr.mjs exp://192.168.1.20:8081
import fs from "node:fs";
import QRCode from "qrcode";

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/qr.mjs exp://<ip>:8081");
  process.exit(1);
}

const dataUrl = await QRCode.toDataURL(url, { width: 720, margin: 2, errorCorrectionLevel: "M" });
const out = "/tmp/mt-phone-qr.html";

fs.writeFileSync(
  out,
  `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>Metatake — 휴대폰에서 열기</title>
<style>
  body{margin:0;font:16px/1.6 -apple-system,'Apple SD Gothic Neo',system-ui,sans-serif;
       background:#111;color:#f7f7f7;display:flex;min-height:100vh;align-items:center;
       justify-content:center;padding:32px}
  .card{max-width:560px;text-align:center}
  h1{font-size:26px;margin:0 0 6px;font-weight:600}
  .sub{color:#b0b0b0;margin:0 0 28px}
  .qr{background:#fff;padding:20px;border-radius:24px;display:inline-block;
      box-shadow:0 18px 50px rgba(0,0,0,.5)}
  .qr img{display:block;width:320px;height:320px}
  ol{text-align:left;margin:28px auto 0;max-width:430px;padding-left:22px;color:#e3e3e3}
  li{margin:10px 0}
  code{background:#1d1d1d;border:1px solid rgba(255,255,255,.14);border-radius:6px;
       padding:2px 7px;font-size:14px;color:#fff}
  .url{margin-top:22px;color:#8a8a8a;font-size:13px}
  .grad{background:linear-gradient(120deg,#FF385C,#E61E4D 55%,#D70466);
        -webkit-background-clip:text;background-clip:text;color:transparent;font-weight:700}
</style></head>
<body><div class="card">
  <h1>휴대폰으로 <span class="grad">Metatake</span> 열기</h1>
  <p class="sub">카메라(iOS) 또는 Expo Go 스캐너(Android)로 비추세요</p>
  <div class="qr"><img src="${dataUrl}" alt="Expo Go QR"></div>
  <ol>
    <li><b>Expo Go</b> 설치 — App Store(iOS) / Play 스토어(Android), 무료</li>
    <li>휴대폰이 맥과 <b>같은 Wi-Fi</b>인지 확인</li>
    <li>QR을 비추고 뜨는 배너를 탭 (Android는 Expo Go 앱 안의 스캐너 사용)</li>
    <li>번들을 받은 뒤 앱이 실행됩니다 (첫 실행은 30초 내외)</li>
  </ol>
  <p class="url">수동 입력: <code>${url}</code></p>
</div></body></html>`,
);
console.log("QR page:", out, "→", url);
