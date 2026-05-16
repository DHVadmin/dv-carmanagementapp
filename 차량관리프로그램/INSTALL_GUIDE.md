# 동행빌리지 차량관리 앱 - 설치 가이드

---

## 전체 시스템 구성

```
┌─────────────────────────────────────────────────┐
│              차량관리 앱 (Firebase)               │
│  운행/주유/정비 기록          관내출장 기록         │
└──────────┬──────────────────────┬───────────────┘
           │ GAS 웹앱 전송          │ GAS 웹앱 전송
           ▼                      ▼
┌─────────────────┐    ┌──────────────────────┐
│  차량일지 시트   │    │   관내출장 시트        │
│ (구글 스프레드시트)│    │ (구글 스프레드시트)   │
└────────┬────────┘    └──────────┬───────────┘
         │ 이미지 자동 저장          │ 서명 파일 확인
         ▼                        ▼
┌─────────────────┐    ┌──────────────────────┐
│  이미지 폴더     │    │    서명이미지 폴더     │
│ (구글 드라이브)  │    │   (구글 드라이브)      │
└─────────────────┘    └──────────────────────┘
```

**설치 순서:** Firebase → 드라이브 폴더 2개 → 스프레드시트+GAS 2개 → setup.bat → 앱 설정

---

## PART 1: Firebase 설정

### 1-1. 서비스 활성화 (Firebase 콘솔)

https://console.firebase.google.com 접속 → **새 프로젝트 추가**

| 서비스 | 경로 | 설정 |
|--------|------|------|
| Firestore | Firestore Database → 데이터베이스 만들기 | 리전: asia-northeast3, 테스트 모드 |
| Authentication | Authentication → 시작하기 | 이메일/비밀번호 ON |
| Storage | Storage → 시작하기 | 테스트 모드 |
| Hosting | Hosting → 시작하기 | 기본 설정 완료 |

좌측 하단 **업그레이드 → Blaze 요금제** 전환 (카드 등록 필요, 실사용 무료 수준)

### 1-2. 설정값 7개 메모

프로젝트 설정(톱니바퀴) → 내 앱 → 웹 앱 → SDK 구성:
```
apiKey, authDomain, projectId, storageBucket,
messagingSenderId, appId, measurementId
```

---

## PART 2: 구글 드라이브 폴더 2개 생성

### 폴더 ①: 주유·정비 이미지 폴더

1. drive.google.com → **새로 만들기 → 폴더** → 이름: `차량이미지_시설명`
2. 폴더 우클릭 → **공유** → "링크 있는 모든 사용자" → **편집자**
3. URL에서 폴더 ID 복사:
   ```
   https://drive.google.com/drive/folders/[이 부분이 FOLDER_ID]
   ```
   → **메모 필수** (차량일지 GAS 코드에 입력)

### 폴더 ②: 서명이미지 폴더

1. 폴더 생성: `서명이미지_시설명`
2. 공유 → 링크 있는 모든 사용자 → **편집자**
3. 폴더 ID 메모 (관내출장 GAS 속성에 입력)
4. 직원 서명 이미지를 **`홍길동.png`** 형식으로 이 폴더에 업로드

---

## PART 3: 구글 스프레드시트 + GAS 설정

### 시트 ①: 차량일지 시트

#### 스프레드시트 생성
1. sheets.google.com → 새 스프레드시트 생성
2. 시트(탭) 이름을 **`DB`** 로 변경 (대소문자 정확히!)

#### GAS 설정
1. **확장 프로그램 → Apps Script** 클릭
2. 기존 `Code.gs` 내용 전체 삭제 후 아래 코드 붙여넣기
3. 코드 중 `"여기에_이미지폴더_ID_입력"` 부분을 **폴더 ① ID**로 교체

```javascript
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        if (data.action === 'getSlackUsers') return handleGetSlackUsers(data);
        if (data.action === 'runNotificationCheck') return handleNotificationCheck(data);

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DB');
        if (!sheet) return json({ result: 'error', message: 'DB sheet not found' });

        if (data.action === 'delete') {
            if (!data.id) return json({ result: 'error', message: 'No ID' });
            const idValues = sheet.getRange(2, 24, Math.max(sheet.getLastRow()-1,1), 1).getValues();
            for (let i = idValues.length - 1; i >= 0; i--) {
                if (idValues[i][0] === data.id) { sheet.deleteRow(i + 2); break; }
            }
            return json({ result: 'success' });
        }

        // ★ 아래 ID를 PART 2의 이미지 폴더 ID로 교체하세요 ★
        const FOLDER_ID = "여기에_이미지폴더_ID_입력";

        let driveImageUrl = '';
        if (data.imageUrl) driveImageUrl = saveImageToDrive(data.imageUrl, FOLDER_ID);

        const row = [
            data.startDate || data.date,
            data.endDate || data.startDate || data.date,
            getKoreanType(data.type),
            `${data.vehicleName} (${data.vehiclePlate})`,
            data.userName, data.userId || '',
            data.purpose || '',
            data.startTime || '', data.endTime || '',
            data.startMileage || '', data.endMileage || '', data.distance || '',
            data.amount || '', data.pricePerLiter || '',
            data.destination || data.station || data.shop || '',
            data.item || '', data.cost || '', data.paymentMethod || '',
            data.passengerDetail || '', data.stopoverDetail || '',
            (data.type === 'fueling' && driveImageUrl) ? `=IMAGE("${driveImageUrl}")` : '',
            (data.type === 'maintenance' && driveImageUrl) ? `=IMAGE("${driveImageUrl}")` : '',
            new Date().toLocaleString(), data.id || ''
        ];

        const lastRow = sheet.getLastRow();
        let foundIndex = -1;
        if (data.id && lastRow >= 2) {
            const ids = sheet.getRange(2, 24, lastRow-1, 1).getValues();
            for (let i = 0; i < ids.length; i++) {
                if (ids[i][0] === data.id) { foundIndex = i + 2; break; }
            }
        }
        if (foundIndex !== -1) {
            sheet.getRange(foundIndex, 1, 1, row.length).setValues([row]);
            return json({ result: 'success', message: 'Updated' });
        } else {
            sheet.appendRow(row);
            return json({ result: 'success', message: 'Appended' });
        }
    } catch (error) {
        return json({ result: 'error', message: error.toString() });
    }
}

function saveImageToDrive(imageUrl, folderId) {
    try {
        const folder = DriveApp.getFolderById(folderId);
        const blob = UrlFetchApp.fetch(imageUrl).getBlob();
        blob.setName(new Date().toISOString().replace(/[:.]/g, '-') + ".jpg");
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        return "https://drive.google.com/uc?export=view&id=" + file.getId();
    } catch(e) { return "Error: " + e.toString(); }
}

function getKoreanType(type) {
    return { driving: '운행', fueling: '주유', maintenance: '정비' }[type] || type;
}

function json(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON);
}

function handleGetSlackUsers(data) {
    try {
        var res = UrlFetchApp.fetch('https://slack.com/api/users.list', {
            headers: { 'Authorization': 'Bearer ' + data.token }
        });
        var j = JSON.parse(res.getContentText());
        if (!j.ok) return json({ result: 'error', message: j.error });
        var users = j.members
            .filter(m => !m.deleted && !m.is_bot && m.profile && m.profile.email)
            .map(m => ({ id: m.id, email: m.profile.email, name: m.name,
                         real_name: m.real_name, display_name: m.profile.display_name }));
        return json({ result: 'success', users: users });
    } catch(e) { return json({ result: 'error', message: e.toString() }); }
}

function handleNotificationCheck(data) {
    try {
        if (typeof checkAndSendNotifications === 'function') {
            var result = checkAndSendNotifications(data.test === true);
            return json({ result: 'success', alertCount: result ? result.length : 0 });
        }
        return json({ result: 'success', alertCount: 0 });
    } catch(e) { return json({ result: 'error', message: e.toString() }); }
}
```

#### appsscript.json 권한 설정
1. Apps Script → 프로젝트 설정(톱니바퀴) → **"편집기에서 appsscript.json 표시"** 체크
2. 편집기 → `appsscript.json` → 아래 내용으로 덮어쓰기:

```json
{
  "timeZone": "Asia/Seoul",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request"
  ],
  "webapp": { "executeAs": "USER_ACCESSING", "access": "ANYONE" }
}
```

#### 배포
1. **배포 → 새 배포** → 유형: 웹 앱
2. 실행: 나 / 액세스: 모든 사용자
3. 배포 → **웹 앱 URL 복사** → 메모 **(차량일지 URL)**
4. 권한 승인 팝업 뜨면 허용

---

### 시트 ②: 관내출장 시트

#### 스프레드시트 생성
1. 새 스프레드시트 생성 (시트 이름은 그대로 `시트1` 유지, GAS가 자동 생성)

#### GAS 설정
1. **확장 프로그램 → Apps Script** → 기존 내용 삭제 후 아래 코드 붙여넣기:

```javascript
const TARGET_SHEET_NAME = 'DB_Logs';

function doPost(e) {
    if (!e || !e.postData) return ContentService.createTextOutput("No data");
    try {
        var params = JSON.parse(e.postData.contents);
        if (params.action === 'record_trip') return recordTrip(params.data);
        return ContentService.createTextOutput("Unknown action");
    } catch(err) {
        return ContentService.createTextOutput("Error: " + err.toString());
    }
}

function recordTrip(data) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(TARGET_SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(TARGET_SHEET_NAME);
        sheet.appendRow(["시작일자","종료일자","성명","ID","출발시간","도착시간",
            "출장지","출장목적","상태","결재자","결재자ID","경유지","동승자",
            "반려사유","신청자서명","결재자서명","문서ID"]);
    }

    var userSignStatus = checkSignature(data[2]);
    var approverSignStatus = "대상아님";
    if (data[8] === '승인' && data[9]) approverSignStatus = checkSignature(data[9]);
    else if (data[8] === '반려') approverSignStatus = "반려됨";

    sheet.appendRow([
        data[0], data[1], data[2], data[3], data[4], data[5],
        data[6], data[7], data[8], data[9], data[10],
        data[11], data[12], data[13],
        userSignStatus, approverSignStatus, data[14]
    ]);
    return ContentService.createTextOutput("Success");
}

function checkSignature(name) {
    if (!name) return "이름없음";
    var folderId = PropertiesService.getScriptProperties().getProperty('SIGNATURE_FOLDER_ID');
    if (!folderId) return "설정오류(SIGNATURE_FOLDER_ID 없음)";
    try {
        var folder = DriveApp.getFolderById(folderId);
        var cleanName = name.replace(/\s+/g, '');
        var candidates = [name+".png", name+".jpg", name, cleanName+".png", cleanName+".jpg", cleanName];
        for (var i = 0; i < candidates.length; i++) {
            if (folder.getFilesByName(candidates[i]).hasNext()) return "서명있음";
        }
        return "서명없음";
    } catch(e) { return "폴더접근실패"; }
}
```

#### 스크립트 속성 설정 (서명 폴더 ID)
1. Apps Script → 프로젝트 설정(톱니바퀴) → 하단 **스크립트 속성 → 속성 추가**
2. 속성명: `SIGNATURE_FOLDER_ID` / 값: **PART 2 폴더 ② ID**
3. 저장

#### appsscript.json 설정
위 차량일지 GAS와 동일한 JSON 내용 적용

#### 배포
동일하게 배포 → **웹 앱 URL 복사** → 메모 **(관내출장 URL)**

---

## PART 4: setup.bat 실행

`setup.bat` 더블클릭 → PART 1의 Firebase 설정값 입력 → 자동 빌드/배포 완료

---

## PART 5: 앱 내 연동 설정

앱 접속 → **관리자 페이지 → 시스템 설정**

| 항목 | 입력값 |
|------|--------|
| 구글 시트 URL | 차량일지 GAS 웹앱 URL |
| 관내출장 시트 URL | 관내출장 GAS 웹앱 URL |
| 슬랙 웹훅 URL | (선택) Slack Incoming Webhook URL |

---

## PART 6: 슬랙 알림 설정 (선택)

1. Slack → 앱 추가 → **Incoming Webhooks** 검색 → 채널 선택
2. 웹훅 URL 복사 (`https://hooks.slack.com/services/...`)
3. 앱 관리자 → 시스템 설정 → **슬랙 웹훅 URL** 입력

---

## 최종 체크리스트

```
[ ] Firebase: 프로젝트 생성 + 4개 서비스 활성화 + Blaze 전환
[ ] 드라이브: 이미지 폴더 생성 + 공유(편집자) + ID 메모
[ ] 드라이브: 서명 폴더 생성 + 공유(편집자) + ID 메모 + 서명파일 업로드
[ ] 차량일지 시트: 시트명 'DB' + GAS 코드 + FOLDER_ID 교체 + 배포 + URL 메모
[ ] 관내출장 시트: GAS 코드 + 스크립트 속성(SIGNATURE_FOLDER_ID) + 배포 + URL 메모
[ ] setup.bat 실행 완료 (Firebase 7개 값 입력)
[ ] 앱 관리자 설정: GAS URL 2개 입력
[ ] 차량 정보 등록
[ ] 슬랙 웹훅 입력 (선택)
```

---

## 문제 해결

| 증상 | 해결 방법 |
|------|----------|
| 로그인이 안 됨 | Firebase Auth → 이메일/비밀번호 사용 설정 확인 |
| 일지가 시트에 안 쌓임 | GAS 배포 URL 확인, GAS에서 직접 실행해 권한 재승인 |
| 이미지가 시트에 안 나옴 | FOLDER_ID 정확히 입력됐는지 확인, 폴더 공유 권한 확인 |
| 서명 확인 안 됨 | SIGNATURE_FOLDER_ID 속성 설정 확인, 파일명 형식 확인 (홍길동.png) |
| GAS 권한 오류 | appsscript.json 설정 후 새 배포 진행 |
| 슬랙 알림 안 옴 | 웹훅 URL 재확인, 채널 권한 확인 |
