# 동행빌리지 차량관리 앱 - 설치 가이드

## 빠른 설치 (권장)

`setup.bat` 파일을 더블클릭하면 설치 도우미가 실행됩니다.

---

## 사전 준비 (브라우저에서 미리 해주세요)

### 1. Node.js 설치
- https://nodejs.org → LTS 버전 다운로드 및 설치

### 2. Firebase 프로젝트 생성
1. https://console.firebase.google.com 접속
2. **새 프로젝트 추가** 클릭
3. 프로젝트 이름 입력 (예: `my-org-carmanagement`)
4. Google Analytics는 선택사항 (건너뛰어도 됨)

### 3. Firebase 서비스 활성화

#### Firestore Database
- Firebase 콘솔 → **Firestore Database** → **데이터베이스 만들기**
- 리전: `asia-northeast3 (서울)` 권장
- **테스트 모드**로 시작

#### Authentication  
- Firebase 콘솔 → **Authentication** → **시작하기**
- **이메일/비밀번호** 사용 설정 **ON**
- (선택) Google 로그인도 활성화 가능

#### Storage
- Firebase 콘솔 → **Storage** → **시작하기**
- 테스트 모드로 시작

#### Hosting
- Firebase 콘솔 → **Hosting** → **시작하기**
- 그냥 다음 → 완료 (setup.bat이 나머지 처리)

### 4. Blaze 요금제 전환
- Firebase 콘솔 → 왼쪽 하단 **업그레이드** → Blaze 선택
- 신용카드 등록 필요 (실제 청구는 무료 한도 초과 시에만 발생)
- 소규모 시설은 사실상 무료

### 5. Firebase 설정값 확인
- Firebase 콘솔 → **프로젝트 설정** (톱니바퀴)
- 하단 **내 앱** → 웹 앱 선택 (없으면 `</>` 아이콘으로 추가)
- **SDK 구성**의 7개 값을 setup.bat 실행 시 입력

---

## setup.bat 실행

1. `setup.bat` 더블클릭
2. 화면 안내에 따라 Firebase 설정값 입력
3. Firebase 로그인 (브라우저 팝업)
4. 자동으로 빌드 및 배포 완료

---

## 설치 후 설정 (앱 관리자 페이지에서)

앱 접속 → 관리자 페이지 → **시스템 설정** 탭

| 항목 | 필수 | 설명 |
|------|------|------|
| 차량 등록 | ✅ | 관리자 → 차량 관리 탭 |
| 슬랙 알림 | 선택 | 웹훅 URL 입력 (앱 내 매뉴얼 참고) |
| 구글 시트 연동 | 선택 | GAS URL 입력 (아래 참고) |

---

## 구글 Apps Script (GAS) 설정

운행일지를 구글 시트에 자동 기록하려면 GAS 설정이 필요합니다.

1. **구글 드라이브**에서 새 스프레드시트 생성
2. **확장 프로그램** → **Apps Script** 클릭
3. 앱 관리자 페이지 → **매뉴얼** → **Apps Script 매뉴얼**의 코드를 붙여넣기
4. **배포** → **새 배포** → **웹 앱** 선택
5. 실행 권한: **모든 사용자**
6. 배포 URL을 복사
7. 앱 관리자 → 시스템 설정 → **구글 시트 URL**에 붙여넣기

---

## 슬랙 알림 설정

1. Slack 워크스페이스 → **앱 추가** → **Incoming Webhooks** 검색
2. 알림 받을 채널 선택
3. 웹훅 URL 복사 (`https://hooks.slack.com/services/...`)
4. 앱 관리자 → 시스템 설정 → **슬랙 웹훅 URL**에 붙여넣기

---

## 문제 해결

| 증상 | 해결 방법 |
|------|----------|
| 로그인이 안 됨 | Firebase Auth에서 이메일/비밀번호 설정 확인 |
| 데이터가 안 불러와짐 | Firestore 규칙 배포 확인 (`firebase deploy --only firestore:rules`) |
| 이미지 업로드 안 됨 | Storage 규칙 배포 확인 |
| 슬랙 알림 안 옴 | 웹훅 URL 재확인, 채널 권한 확인 |

---

## 재배포 (업데이트)

새 버전이 나왔을 때:
```
npm run build
firebase deploy --only hosting
```
또는 `setup.bat`을 다시 실행하면 기존 설정값으로 업데이트됩니다.
