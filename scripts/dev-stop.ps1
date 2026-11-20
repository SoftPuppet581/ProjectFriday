# 개발 서버를 끈다. -Only 로 일부만 끌 수 있다. 예: -Only frontend,backend (MariaDB는 그대로 둠)
param([string[]]$Only = @('frontend', 'backend', 'db'))

$ErrorActionPreference = 'Continue'
$mariaBin = 'C:\Program Files\MariaDB 11.8\bin'

function Get-ListenerPid($port) {
  $c = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return $c.OwningProcess }
  return $null
}

# 서버 프로세스에서 위로 올라가며 npm/vite/서버 실행용 cmd, node만 묶어서 끈다.
# (다른 프로그램의 node, 예: AI 도구 자체를 건드리지 않도록 명령줄이 개발 서버 관련일 때만 올라간다)
function Get-DevRootPid($processId) {
  $current = $processId
  while ($true) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$current" -ErrorAction SilentlyContinue
    if (-not $proc) { break }
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.ParentProcessId)" -ErrorAction SilentlyContinue
    if ($parent -and ($parent.Name -in @('cmd.exe', 'node.exe')) -and ($parent.CommandLine -match 'npm|vite|server\.js|--watch')) {
      $current = $parent.ProcessId
    } else { break }
  }
  return $current
}

function Stop-Server($label, $port) {
  $listener = Get-ListenerPid $port
  if (-not $listener) { Write-Host "  $label : 꺼져 있었습니다."; return }
  $target = Get-DevRootPid $listener
  & taskkill /T /F /PID $target 2>&1 | Out-Null
  Start-Sleep -Milliseconds 800
  if (Get-ListenerPid $port) { Write-Host "  $label : 끄지 못했습니다. (포트 $port)" -ForegroundColor Yellow } else { Write-Host "  $label : 껐습니다." }
}

Write-Host ''
Write-Host '개발 서버를 끕니다.' -ForegroundColor Cyan
if ($Only -contains 'frontend') { Stop-Server '프론트엔드' 5173 }
if ($Only -contains 'backend') { Stop-Server '백엔드' 3000 }
if ($Only -contains 'db') {
  if (-not (Get-ListenerPid 3306)) {
    Write-Host '  MariaDB : 꺼져 있었습니다.'
  } else {
    # 데이터가 안전하게 저장되도록 정상 종료를 먼저 시도한다
    & "$mariaBin\mariadb-admin.exe" -u root -h 127.0.0.1 shutdown 2>&1 | Out-Null
    for ($i = 0; $i -lt 20 -and (Get-ListenerPid 3306); $i++) { Start-Sleep -Seconds 1 }
    if (Get-ListenerPid 3306) {
      Write-Host '  MariaDB : 정상 종료가 안 돼서 강제로 끕니다.' -ForegroundColor Yellow
      & taskkill /F /PID (Get-ListenerPid 3306) 2>&1 | Out-Null
    }
    if (Get-ListenerPid 3306) { Write-Host '  MariaDB : 끄지 못했습니다.' -ForegroundColor Yellow } else { Write-Host '  MariaDB : 껐습니다.' }
  }
}
Write-Host ''
