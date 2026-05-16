# ============================================================
# 동행빌리지 차량관리 앱 설치 도우미 v1.1
# GitHub에서 최신 소스를 자동으로 받아 빌드/배포합니다.
# ============================================================

$GITHUB_REPO = "DHVadmin/dv-carmanagementapp"
$GITHUB_ZIP  = "https://github.com/$GITHUB_REPO/archive/refs/heads/main.zip"
$INSTALL_DIR = "$env:TEMP\dv-carmanagement-install"

$Host.UI.RawUI.WindowTitle = "동행빌리지 차량관리 - 설치 도우미"

function Write-Header {
    Clear-Host
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "   동행빌리지 차량관리 앱  -  설치 도우미 v1.1" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([int]$Step, [int]$Total, [string]$Title)
    Write-Host ""
    Write-Host "[ 단계 $Step / $Total ]  $Title" -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
}

function Write-Success { param([string]$msg) Write-Host "  V $msg" -ForegroundColor Green }
function Write-Warn    { param([string]$msg) Write-Host "  ! $msg" -ForegroundColor Yellow }
function Write-Fail    { param([string]$msg) Write-Host "  X $msg" -ForegroundColor Red }
function Write-Info    { param([string]$msg) Write-Host "  > $msg" -ForegroundColor Cyan }

function Pause-And-Exit {
    Write-Host ""
    Write-Host "설치가 중단됐습니다. 아무 키나 누르면 창이 닫힙니다." -ForegroundColor Red
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

function Read-Required {
    param([string]$Prompt)
    do {
        $val = Read-Host "  $Prompt"
        if (-not $val) { Write-Warn "값을 입력해주세요." }
    } while (-not $val)
    return $val
}

# ============================================================
# STEP 0: 안내
# ============================================================
Write-Header
Write-Host "  GitHub에서 최신 소스를 받아 Firebase에 자동 배포합니다." -ForegroundColor White
Write-Host ""
Write-Host "  소요 시간: 약 5~10분" -ForegroundColor White
Write-Host ""
Write-Host "  사전 준비 (브라우저에서 미리 해주세요):" -ForegroundColor White
Write-Host "    1. Firebase 프로젝트 생성  ->  https://console.firebase.google.com" -ForegroundColor White
Write-Host "    2. Firestore Database 활성화" -ForegroundColor White
Write-Host "    3. Authentication 활성화  ->  이메일/비밀번호 사용 설정 ON" -ForegroundColor White
Write-Host "    4. Storage 활성화" -ForegroundColor White
Write-Host "    5. Hosting 활성화" -ForegroundColor White
Write-Host "    6. Blaze 요금제 전환" -ForegroundColor White
Write-Host ""
Write-Host "  준비가 됐으면 Enter를 누르세요." -ForegroundColor Green
Read-Host | Out-Null

# ============================================================
# STEP 1: 필수 도구 확인
# ============================================================
Write-Header
Write-Step 1 6 "필수 도구 확인"

# Node.js
$nodeVer = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Node.js가 없습니다. https://nodejs.org 에서 LTS 버전을 설치하세요."
    Pause-And-Exit
}
Write-Success "Node.js $nodeVer"

# Firebase CLI
$fbVer = firebase --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Warn "Firebase CLI 설치 중..."
    npm install -g firebase-tools | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Fail "Firebase CLI 설치 실패"; Pause-And-Exit }
    Write-Success "Firebase CLI 설치 완료"
} else {
    Write-Success "Firebase CLI v$fbVer"
}

# ============================================================
# STEP 2: GitHub에서 소스 다운로드
# ============================================================
Write-Header
Write-Step 2 6 "최신 소스 다운로드 (GitHub)"

# 기존 임시 폴더 정리
if (Test-Path $INSTALL_DIR) {
    Remove-Item -Recurse -Force $INSTALL_DIR
}
New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null

Write-Info "다운로드 중: $GITHUB_ZIP"
try {
    Invoke-WebRequest -Uri $GITHUB_ZIP -OutFile "$INSTALL_DIR\source.zip" -UseBasicParsing
} catch {
    Write-Fail "다운로드 실패: $_"
    Write-Warn "인터넷 연결을 확인하거나, 저장소가 공개(Public) 상태인지 확인하세요."
    Pause-And-Exit
}
Write-Success "다운로드 완료"

Write-Info "압축 해제 중..."
Expand-Archive -Path "$INSTALL_DIR\source.zip" -DestinationPath "$INSTALL_DIR" -Force

# 압축 해제된 폴더 찾기 (dv-carmanagementapp-main 형태)
$sourceFolder = Get-ChildItem -Path $INSTALL_DIR -Directory | Where-Object { $_.Name -like "*carmanagement*" } | Select-Object -First 1
if (-not $sourceFolder) {
    Write-Fail "소스 폴더를 찾을 수 없습니다."
    Pause-And-Exit
}

Set-Location $sourceFolder.FullName
Write-Success "소스 준비 완료: $($sourceFolder.FullName)"

# ============================================================
# STEP 3: Firebase 설정값 입력
# ============================================================
Write-Header
Write-Step 3 6 "Firebase 프로젝트 설정값 입력"
Write-Host ""
Write-Host "  Firebase 콘솔 -> 프로젝트 설정 -> 내 앱 -> SDK 구성 에서 복사하세요." -ForegroundColor Cyan
Write-Host ""

$FIREBASE_API_KEY        = Read-Required "apiKey"
$FIREBASE_AUTH_DOMAIN    = Read-Required "authDomain         (예: your-project.firebaseapp.com)"
$FIREBASE_PROJECT_ID     = Read-Required "projectId          (예: your-project-id)"
$FIREBASE_STORAGE_BUCKET = Read-Required "storageBucket      (예: your-project.appspot.com)"
$FIREBASE_MESSAGING_ID   = Read-Required "messagingSenderId  (예: 123456789)"
$FIREBASE_APP_ID         = Read-Required "appId              (예: 1:123:web:abc)"
$FIREBASE_MEASUREMENT_ID = Read-Host    "  measurementId    (없으면 Enter 건너뜀)"

Write-Host ""
Write-Info "관리자 이메일을 입력하세요 (이 계정으로 처음 로그인하면 관리자 권한 부여)"
$ADMIN_EMAIL = Read-Required "관리자 이메일 (예: admin@your-org.kr)"

# .env.local 생성
$envContent = @"
VITE_FIREBASE_API_KEY=$FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=$FIREBASE_MESSAGING_ID
VITE_FIREBASE_APP_ID=$FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID=$FIREBASE_MEASUREMENT_ID
"@
Set-Content -Path ".env.local" -Value $envContent -Encoding UTF8
Write-Success ".env.local 생성 완료"

$global:ProjectId  = $FIREBASE_PROJECT_ID
$global:AdminEmail = $ADMIN_EMAIL

# ============================================================
# STEP 4: 패키지 설치 및 빌드
# ============================================================
Write-Header
Write-Step 4 6 "패키지 설치 및 빌드"

Write-Info "npm 패키지 설치 중... (1~2분 소요)"
npm install --silent
if ($LASTEXITCODE -ne 0) { Write-Fail "패키지 설치 실패"; Pause-And-Exit }
Write-Success "패키지 설치 완료"

Write-Host ""
Write-Info "앱 빌드 중... (2~3분 소요)"
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
node --stack-size=65536 node_modules/vite/bin/vite.js build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Warn "빌드 재시도 중..."
    node --stack-size=65536 node_modules/vite/bin/vite.js build
    if ($LASTEXITCODE -ne 0) { Write-Fail "빌드 실패"; Pause-And-Exit }
}
Write-Success "빌드 완료"

# ============================================================
# STEP 5: Firebase 로그인 및 배포
# ============================================================
Write-Header
Write-Step 5 6 "Firebase 로그인"

Write-Info "브라우저에서 Firebase 계정으로 로그인해주세요..."
firebase login --no-localhost
if ($LASTEXITCODE -ne 0) { Write-Fail "로그인 실패"; Pause-And-Exit }
Write-Success "로그인 완료"

Write-Host ""
Write-Info "Firebase 프로젝트 설정: $global:ProjectId"
firebase use $global:ProjectId 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Warn "프로젝트 수동 설정..."
    firebase use --add
}
Write-Success "프로젝트 설정 완료"

# ============================================================
# STEP 6: 배포
# ============================================================
Write-Header
Write-Step 6 6 "Firebase 배포"

Write-Info "Firestore 규칙 배포 중..."
firebase deploy --only firestore:rules 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { Write-Success "Firestore 규칙 배포 완료" }
else { Write-Warn "Firestore 규칙 배포 실패 (나중에 수동 배포 가능)" }

Write-Info "Storage 규칙 배포 중..."
firebase deploy --only storage 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { Write-Success "Storage 규칙 배포 완료" }
else { Write-Warn "Storage 규칙 배포 실패 (나중에 수동 배포 가능)" }

Write-Info "앱 배포 중..."
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) { Write-Fail "Hosting 배포 실패"; Pause-And-Exit }
Write-Success "앱 배포 완료"

# 임시 폴더 정리
Set-Location $env:TEMP
Remove-Item -Recurse -Force $INSTALL_DIR -ErrorAction SilentlyContinue

# ============================================================
# 완료
# ============================================================
Write-Header
Write-Host ""
Write-Host "  설치 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "  앱 주소:  https://$global:ProjectId.web.app" -ForegroundColor White
Write-Host ""
Write-Host "  접속 후 할 일:" -ForegroundColor Yellow
Write-Host "  1. $global:AdminEmail 로 로그인" -ForegroundColor White
Write-Host "  2. 관리자 페이지 -> 시스템 설정 -> GAS URL, 슬랙 웹훅 입력" -ForegroundColor White
Write-Host "  3. 차량 정보 등록" -ForegroundColor White
Write-Host ""

$open = Read-Host "  브라우저에서 앱을 열까요? (Y/N)"
if ($open -match "^[Yy]$") { Start-Process "https://$global:ProjectId.web.app" }

Write-Host ""
Write-Host "  아무 키나 누르면 창이 닫힙니다."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
