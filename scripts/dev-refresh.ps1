# 시연 직전에 한 번: 게임 뉴스와 Steam 가격을 새로 가져온다. (MariaDB가 켜져 있어야 한다. 먼저 start.bat)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$env:Path = "C:\Program Files\nodejs;$env:Path"

Write-Host ''
Write-Host '뉴스와 가격을 새로 가져옵니다.' -ForegroundColor Cyan

if (-not (Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue)) {
  Write-Host '[실패] MariaDB가 꺼져 있습니다. start.bat을 먼저 실행해 주세요.' -ForegroundColor Red
  exit 1
}
Set-Location "$root\backend"

$failed = $false
function Step($title, $script) {
  Write-Host ''
  Write-Host "[$title]"
  $lines = & npm.cmd run $script 2>&1 | ForEach-Object { "$_" } | Where-Object { $_ -and $_ -notmatch '^\s*$|^>|npm notice|NativeCommandError|CategoryInfo|FullyQualifiedErrorId|^At line|^\+' }
  $lines | ForEach-Object { Write-Host "  $_" }
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  [실패] $title 단계가 실패했습니다. 이전에 저장된 데이터가 그대로 쓰입니다." -ForegroundColor Yellow
    $script:failed = $true
  }
}

Step '뉴스' 'news:refresh'
Step 'Steam 가격' 'prices:refresh'

Write-Host ''
if ($failed) { Write-Host '일부 단계가 실패했습니다. 인터넷 연결을 확인하고 다시 실행해 보세요.' -ForegroundColor Yellow; exit 1 }
Write-Host '새로 가져오기를 마쳤습니다.' -ForegroundColor Green
