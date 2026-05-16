# ============================================================
# 동행빌리지 차량관리 앱 설치 도우미 v1.0
# ============================================================

$Host.UI.RawUI.WindowTitle = "동행빌리지 차량관리 - 설치 도우미"

function Write-Header {
    Clear-Host
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "   동행빌리지 차량관리 앱  -  설치 도우미" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([int]$Step, [int]$Total, [string]$Title)
    Write-Host ""
    Write-Host "[ 단계 $Step / $Total ]  $Title" -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray
}

function Write-Success { param([string]$msg) Write-Host "  ✅ $msg" -ForegroundColor Green }
function Write-Warn    { param([string]$msg) Write-Host "  ⚠️  $msg" -ForegroundColor Yellow }
function Write-Fail    { param([string]$msg) Write-Host "  ❌ $msg" -ForegroundColor Red }
function Write-Info    { param([string]$msg) Write-Host "  ℹ️  $msg" -ForegroundColor Cyan }

function Pause-And-Exit {
    Write-Host ""
    Write-Host "설치가 중단됐습니다. 아무 키나 누르면 창이 닫힙니다." -ForegroundColor Red
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# ============================================================
# STEP 0: 안내
# ============================================================
Write-Header
Write-Host "  이 프로그램은 차량관리 앱을 Firebase에 설치하고 배포합니다." -ForegroundColor White
Write-Host ""
Write-Host "  ⏱️  소요 시간: 약 5~10분" -ForegroundColor White
Write-Host ""
Write-Host "  사전 준비 (브라우저에서 미리 해주세요):" -ForegroundColor White
Write-Host "    1. Firebase 프로젝트 생성  →  https://console.firebase.google.com" -ForegroundColor White
Write-Host "    2. Firestore Database 활성화 (테스트 모드로 시작)" -ForegroundColor White
Write-Host "    3. Authentication 활성화  →  Google 로그인 사용 설정" -ForegroundColor White
Write-Host "    4. Storage 활성화" -ForegroundColor White
Write-Host "    5. Hosting 활성화" -ForegroundColor White
Write-Host "    6. Firebase Blaze 요금제 전환 (무료 범위 내 사용)" -ForegroundColor White
Write-Host ""
Write-Host "  준비가 됐으면 Enter를 누르세요." -ForegroundColor Green
Read-Host | Out-Null

# ============================================================
# STEP 1: Node.js 확인
# ============================================================
Write-Header
Write-Step 1 6 "Node.js 설치 확인"

$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Node.js가 설치되어 있지 않습니다."
    Write-Info "https://nodejs.org 에서 LTS 버전을 설치하고 다시 실행해주세요."
    Pause-And-Exit
}
Write-Success "Node.js $nodeVersion 확인됨"

# npm 확인
$npmVersion = npm --version 2>$null
Write-Success "npm v$npmVersion 확인됨"

# Firebase CLI 확인 및 설치
$firebaseVersion = firebase --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Warn "Firebase CLI가 없습니다. 설치를 시작합니다..."
    npm install -g firebase-tools
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Firebase CLI 설치 실패"
        Pause-And-Exit
    }
    Write-Success "Firebase CLI 설치 완료"
} else {
    Write-Success "Firebase CLI v$firebaseVersion 확인됨"
}

# ============================================================
# STEP 2: Firebase 설정값 입력
# ============================================================
Write-Header
Write-Step 2 6 "Firebase 프로젝트 설정값 입력"
Write-Host ""
Write-Host "  아래 경로에서 설정값을 확인하세요:" -ForegroundColor White
Write-Host "  Firebase 콘솔 → 프로젝트 설정 → 내 앱 → 웹 앱 → SDK 구성" -ForegroundColor Cyan
Write-Host "  (웹 앱이 없으면 '</>' 버튼으로 웹 앱을 먼저 추가하세요)" -ForegroundColor Yellow
Write-Host ""

function Read-Required {
    param([string]$Prompt)
    do {
        $val = Read-Host "  $Prompt"
        if (-not $val) { Write-Warn "값을 입력해주세요." }
    } while (-not $val)
    return $val
}

$FIREBASE_API_KEY         = Read-Required "apiKey"
$FIREBASE_AUTH_DOMAIN     = Read-Required "authDomain         (예: your-project.firebaseapp.com)"
$FIREBASE_PROJECT_ID      = Read-Required "projectId          (예: your-project-id)"
$FIREBASE_STORAGE_BUCKET  = Read-Required "storageBucket      (예: your-project.appspot.com)"
$FIREBASE_MESSAGING_ID    = Read-Required "messagingSenderId  (예: 123456789)"
$FIREBASE_APP_ID          = Read-Required "appId              (예: 1:123:web:abc)"

Write-Host ""
$FIREBASE_MEASUREMENT_ID = Read-Host "  measurementId      (예: G-XXXXXX, 없으면 Enter 건너뜀)"

Write-Host ""
Write-Info "관리자 이메일을 입력하세요."
Write-Info "이 이메일로 처음 로그인하면 자동으로 관리자 권한이 부여됩니다."
$ADMIN_EMAIL = Read-Required "관리자 이메일 (예: admin@your-org.kr)"

# .env.local 생성
Write-Host ""
Write-Info ".env.local 파일 생성 중..."

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

# firebase.json의 projectId 기록 (나중에 use 명령에 사용)
$global:ProjectId = $FIREBASE_PROJECT_ID
$global:AdminEmail = $ADMIN_EMAIL

# ============================================================
# STEP 3: 패키지 설치 및 빌드
# ============================================================
Write-Header
Write-Step 3 6 "패키지 설치 및 앱 빌드"

Write-Info "npm 패키지 설치 중... (최초 1회, 1~2분 소요)"
npm install --silent
if ($LASTEXITCODE -ne 0) {
    Write-Fail "패키지 설치 실패"
    Pause-And-Exit
}
Write-Success "패키지 설치 완료"

Write-Host ""
Write-Info "앱 빌드 중... (2~3분 소요)"
node --stack-size=65536 node_modules/vite/bin/vite.js build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    # 한 번 더 시도
    Write-Warn "빌드 재시도 중..."
    node --stack-size=65536 node_modules/vite/bin/vite.js build
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "앱 빌드 실패. 위 오류를 확인해주세요."
        Pause-And-Exit
    }
}
Write-Success "앱 빌드 완료"

# ============================================================
# STEP 4: Firebase 로그인 및 프로젝트 설정
# ============================================================
Write-Header
Write-Step 4 6 "Firebase 로그인"

Write-Info "브라우저에서 Firebase 계정으로 로그인해주세요..."
Write-Host ""
firebase login --no-localhost
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Firebase 로그인 실패"
    Pause-And-Exit
}
Write-Success "Firebase 로그인 완료"

Write-Host ""
Write-Info "Firebase 프로젝트를 설정합니다: $global:ProjectId"
firebase use $global:ProjectId 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Warn "프로젝트 자동 설정 실패. 수동으로 설정합니다..."
    firebase use --add
}
Write-Success "Firebase 프로젝트 설정 완료"

# ============================================================
# STEP 5: Firestore 규칙 및 앱 배포
# ============================================================
Write-Header
Write-Step 5 6 "Firebase 배포"

Write-Info "Firestore 규칙 배포 중..."
firebase deploy --only firestore:rules 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Success "Firestore 규칙 배포 완료"
} else {
    Write-Warn "Firestore 규칙 배포 실패 (수동으로 배포 필요)"
}

Write-Host ""
Write-Info "Storage 규칙 배포 중..."
firebase deploy --only storage 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Success "Storage 규칙 배포 완료"
} else {
    Write-Warn "Storage 규칙 배포 실패 (수동으로 배포 필요)"
}

Write-Host ""
Write-Info "앱 Hosting 배포 중..."
firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Hosting 배포 실패"
    Pause-And-Exit
}
Write-Success "Hosting 배포 완료"

# ============================================================
# STEP 6: 초기 설정 데이터 등록
# ============================================================
Write-Header
Write-Step 6 6 "초기 관리자 설정"

Write-Info "Firestore에 관리자 정보 및 기본 설정을 등록합니다..."

# Node.js로 Firestore 초기 데이터 작성
$initScript = @"
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { credential } = require('firebase-admin');

process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: '$global:ProjectId' });

const app = initializeApp({ credential: credential.applicationDefault(), projectId: '$global:ProjectId' });
const db = getFirestore(app);

async function init() {
    try {
        await db.collection('settings').doc('global').set({
            drivingPurposes: ['출퇴근', '업무용', '기타'],
            drivingDestinations: [],
            maintenanceShops: [],
            gasStations: [],
            paymentMethods: ['법인전입금', '자부담'],
            consumableSettings: [
                { label: '엔진오일', distance: 10000, months: 12 },
                { label: '타이어', distance: 50000, months: 60 },
                { label: '배터리', distance: 0, months: 36 }
            ]
        }, { merge: true });
        console.log('SUCCESS: 기본 설정 등록 완료');
    } catch(e) {
        console.log('SKIP: ' + e.message);
    }
    process.exit(0);
}
init();
"@

# firebase-admin이 있으면 초기 데이터 등록
$adminCheck = npm list firebase-admin 2>$null
if ($adminCheck -match "firebase-admin") {
    $initScript | node --input-type=module 2>&1 | Out-Null
    Write-Success "기본 설정 데이터 등록 완료"
} else {
    Write-Info "기본 설정은 앱 접속 후 관리자 페이지에서 직접 입력해주세요."
}

# ============================================================
# 완료 메시지
# ============================================================
Write-Header
Write-Host ""
Write-Host "  🎉  설치가 완료됐습니다!" -ForegroundColor Green
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  앱 주소:  https://$global:ProjectId.web.app" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  첫 접속 후 할 일:" -ForegroundColor Yellow
Write-Host "  1. Firebase Authentication에서 Google 로그인 허용 도메인 확인" -ForegroundColor White
Write-Host "  2. $global:AdminEmail 로 로그인" -ForegroundColor White
Write-Host "  3. 관리자 페이지 → 시스템 설정에서 아래 항목 입력:" -ForegroundColor White
Write-Host "     - 슬랙 웹훅 URL (선택)" -ForegroundColor White
Write-Host "     - 구글 시트 URL (선택)" -ForegroundColor White
Write-Host "  4. 차량 정보 등록" -ForegroundColor White
Write-Host ""
Write-Host "  ⚠️  Firebase 콘솔에서 Authentication → 설정 → 승인된 도메인에" -ForegroundColor Yellow
Write-Host "     '$global:ProjectId.web.app' 이 있는지 확인하세요." -ForegroundColor Yellow
Write-Host ""

# 브라우저로 앱 열기
$openBrowser = Read-Host "  지금 앱을 브라우저에서 열까요? (Y/N)"
if ($openBrowser -eq "Y" -or $openBrowser -eq "y") {
    Start-Process "https://$global:ProjectId.web.app"
}

Write-Host ""
Write-Host "  아무 키나 누르면 창이 닫힙니다."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
