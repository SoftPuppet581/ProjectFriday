# MariaDB -> 백엔드 -> 프론트엔드 순서로 켠다. 이미 켜져 있는 것은 건너뛴다.
# 옵션: -NoBrowser (브라우저 안 엽니다), -Hidden (서버 창을 숨깁니다. 테스트용)
param([switch]$NoBrowser, [switch]$Hidden)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$nodeDir = 'C:\Program Files\nodejs'
$mariaBin = 'C:\Program Files\MariaDB 11.8\bin'
$style = if ($Hidden) { 'Hidden' } else { 'Normal' }

function Info($text) { Write-Host "  $text" }
function Fail($text) {
  Write-Host ''
  Write-Host "[실패] $text" -ForegroundColor Red
  exit 1
}
function Test-Port($port) { [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) }
function Test-Http($url) {
  try { return (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3).StatusCode -lt 500 } catch { return $false }
}
function Wait-Until([scriptblock]$check, $seconds) {
  for ($i = 0; $i -lt $seconds; $i++) {
    if (& $check) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}
function Start-DevWindow($title, $folder, $command) {
  $line = "title $title && cd /d `"$folder`" && $command"
  Start-Process -FilePath cmd.exe -ArgumentList '/k', $line -WindowStyle $style | Out-Null
}

Write-Host ''
Write-Host '게임 정보 홈페이지를 켭니다.' -ForegroundColor Cyan

# 준비물 확인
if (-not (Test-Path "$nodeDir\node.exe")) { Fail "Node.js를 찾을 수 없습니다. ($nodeDir)" }
if (-not (Test-Path "$mariaBin\mariadbd.exe")) { Fail "MariaDB를 찾을 수 없습니다. ($mariaBin)" }
if (-not (Test-Path "$root\backend\.env")) { Fail 'backend\.env 파일이 없습니다. backend\.env.example을 복사해서 채워 주세요.' }
if (-not (Test-Path "$root\backend\node_modules")) { Fail 'backend 폴더에서 npm install을 먼저 해야 합니다.' }
$env:Path = "$nodeDir;$env:Path"

# 1) MariaDB
Write-Host '[1/3] MariaDB'
if (Test-Port 3306) {
  Info '이미 켜져 있습니다.'
} else {
  Start-Process -FilePath "$mariaBin\mariadbd.exe" -ArgumentList '--console', '--bind-address=127.0.0.1', '--port=3306' -WindowStyle $style | Out-Null
  if (-not (Wait-Until { Test-Port 3306 } 40)) { Fail 'MariaDB가 40초 안에 켜지지 않았습니다. 열린 MariaDB 창의 에러를 확인해 주세요.' }
  Info '켰습니다. (127.0.0.1:3306)'
}

# 2) 백엔드
Write-Host '[2/3] 백엔드 (http://localhost:3000)'
if (Test-Port 3000) {
  Info '이미 켜져 있습니다.'
} else {
  Start-DevWindow 'Game-Backend' "$root\backend" 'npm run dev'
}
if (-not (Wait-Until { Test-Http 'http://localhost:3000/api/games?limit=1' } 40)) {
  Fail '백엔드가 켜지지 않았거나 DB에 연결하지 못했습니다. 백엔드 창의 에러를 확인해 주세요. (포트 3000을 다른 프로그램이 쓰고 있을 수도 있습니다.)'
}
Info '정상 응답을 확인했습니다.'

# 3) 프론트엔드
Write-Host '[3/3] 프론트엔드 (http://127.0.0.1:5173)'
if (-not (Test-Path "$root\frontend\package.json")) { Fail 'frontend 폴더가 아직 없습니다.' }
if (Test-Port 5173) {
  Info '이미 켜져 있습니다.'
} else {
  Start-DevWindow 'Game-Frontend' "$root\frontend" '(if not exist node_modules npm install) && npm run dev'
}
if (-not (Wait-Until { Test-Http 'http://127.0.0.1:5173/' } 120)) {
  Fail '프론트엔드가 켜지지 않았습니다. 프론트엔드 창의 에러를 확인해 주세요. (포트 5173을 다른 프로그램이 쓰고 있을 수도 있습니다.)'
}
Info '정상 응답을 확인했습니다.'

Write-Host ''
Write-Host '모두 켜졌습니다.' -ForegroundColor Green
Write-Host '  사이트  : http://127.0.0.1:5173'
Write-Host '  API     : http://localhost:3000/api/games'
Write-Host '  끄려면  : stop.bat'
Write-Host '  이 PC에서만 접속됩니다. 인터넷에는 공개되지 않습니다.'

if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173' }
