
import React from 'react';
import { X } from 'lucide-react';

interface ManualProps {
  onClose: () => void;
}

export const AppScriptManual: React.FC<ManualProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
        <div className="p-8 space-y-6 text-sm text-gray-800 leading-relaxed font-sans">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
            <p className="font-bold text-blue-700">📌 관리자용 매뉴얼 (PC 환경 권장)</p>
            <p className="text-gray-600">구글 시트 연동을 위한 Apps Script 설정 방법입니다. <span className="font-bold text-blue-600">(v5.6.3)</span></p>
          </div>

          <section>
            <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">1. 구글 시트 준비</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>새 구글 스프레드시트를 생성합니다.</li>
              <li>시트(탭) 이름을 <code>DB</code>로 변경합니다. (대소문자 구분)</li>
              <li>중요: 2번째 열(B열)에 <strong>종료일</strong>이 추가됩니다. 기존 시트를 사용할 경우 B열을 삽입해주세요.</li>
              <li><code>DB</code> 시트의 1행(헤더)은 놔두거나 비워워도 되지만, 앱이 자동으로 행을 추가합니다.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">2. Apps Script 생성</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>스프레드시트 메뉴에서 <strong>[확장 프로그램] &gt; [Apps Script]</strong>를 클릭합니다.</li>
              <li>기존 <code>Code.gs</code>의 내용을 모두 지웁니다.</li>
              <li>아래 코드를 복사해서 붙여넣습니다.</li>
            </ol>
            <div className="bg-slate-900 text-slate-50 p-4 rounded-lg mt-3 font-mono text-xs overflow-x-auto">
              <pre>{`function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);

        // === Action Router ===
        // 1. Slack 사용자 동기화
        if (data.action === 'getSlackUsers') {
            return handleGetSlackUsers(data);
        }
        // 2. 알림 수동 체크 (테스트)
        if (data.action === 'runNotificationCheck') {
            return handleNotificationCheck(data);
        }

        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DB');
        if (!sheet) {
            return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'DB sheet not found' })).setMimeType(ContentService.MimeType.JSON);
        }

        // 3. Action: Delete
        if (data.action === 'delete') {
            if (!data.id) return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'No ID provided for deletion' })).setMimeType(ContentService.MimeType.JSON);
            
            const lastRow = sheet.getLastRow();
            if (lastRow < 2) return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: 'Sheet empty' })).setMimeType(ContentService.MimeType.JSON);
            
            const idRange = sheet.getRange(2, 24, lastRow - 1, 1);
            const idValues = idRange.getValues();
            
            let found = false;
            for (let i = idValues.length - 1; i >= 0; i--) {
                if (idValues[i][0] === data.id) {
                    sheet.deleteRow(i + 2); 
                    found = true;
                    break;
                }
            }
            
            return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: found ? 'Deleted' : 'Not found' })).setMimeType(ContentService.MimeType.JSON);
        }

        // 4. Action: Write / Update (UPSERT Logic)
        let note = data.remarks || '';
        if (!note) {
            if (data.passengerName) note += \`동승: \${data.passengerName} \`;
            if (data.stopovers && data.stopovers.length > 0) note += \`경유: \${data.stopovers.length}곳 \`;
        }

        let driveImageUrl = '';
        if (data.imageUrl) {
            driveImageUrl = saveImageToDrive(data.imageUrl);
        }

        const row = [
            data.startDate || data.date,
            data.endDate || data.startDate || data.date,
            getKoreanType(data.type),
            \`\${data.vehicleName} (\${data.vehiclePlate})\`,
            data.userName,
            data.userId || '',
            data.purpose || '',
            data.startTime || '',
            data.endTime || '',
            data.startMileage || '',
            data.endMileage || '',
            data.distance || '',
            data.amount || '',
            data.pricePerLiter || '',
            data.destination || data.station || data.shop || '',
            data.item || '',
            data.cost || '',
            data.paymentMethod || '',
            data.passengerDetail || '',
            data.stopoverDetail || '',
            (data.type === 'fueling' && driveImageUrl) ? (driveImageUrl.startsWith('Error') ? driveImageUrl : \`=IMAGE("\${driveImageUrl}")\`) : '',
            (data.type === 'maintenance' && driveImageUrl) ? (driveImageUrl.startsWith('Error') ? driveImageUrl : \`=IMAGE("\${driveImageUrl}")\`) : '',
            new Date().toLocaleString(),
            data.id || ''
        ];

        const lastRow = sheet.getLastRow();
        let foundIndex = -1;

        if (data.id && lastRow >= 2) {
             const idRange = sheet.getRange(2, 24, lastRow - 1, 1);
             const idValues = idRange.getValues();
             for (let i = 0; i < idValues.length; i++) {
                 if (idValues[i][0] === data.id) {
                     foundIndex = i + 2; 
                     break;
                 }
             }
        }

        if (foundIndex !== -1) {
            sheet.getRange(foundIndex, 1, 1, row.length).setValues([row]);
            return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: 'Updated row ' + foundIndex })).setMimeType(ContentService.MimeType.JSON);
        } else {
            sheet.appendRow(row);
            return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: 'Appended new row' })).setMimeType(ContentService.MimeType.JSON);
        }

    } catch (error) {
        console.error("Main Error: " + error.toString()); 
        return ContentService.createTextOutput(JSON.stringify({result: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
}

// === Slack 사용자 목록 가져오기 ===
function handleGetSlackUsers(data) {
    try {
        if (!data.token) {
            return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'Slack Bot Token is required' })).setMimeType(ContentService.MimeType.JSON);
        }
        var response = UrlFetchApp.fetch('https://slack.com/api/users.list', {
            method: 'get',
            headers: { 'Authorization': 'Bearer ' + data.token }
        });
        var json = JSON.parse(response.getContentText());
        if (!json.ok) {
            return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'Slack API Error: ' + json.error })).setMimeType(ContentService.MimeType.JSON);
        }
        var users = json.members
            .filter(function(m) { return !m.deleted && !m.is_bot && m.profile && m.profile.email; })
            .map(function(m) { return { id: m.id, email: m.profile.email, name: m.name, real_name: m.real_name, display_name: m.profile.display_name }; });
        return ContentService.createTextOutput(JSON.stringify({ result: 'success', users: users })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
}

// === 알림 수동 체크 (테스트용) ===
function handleNotificationCheck(data) {
    try {
        // 이 함수는 GAS 스케줄러가 처리하는 알림 로직의 수동 트리거입니다.
        // 기존 checkAndSendNotifications 함수가 있다면 호출합니다.
        if (typeof checkAndSendNotifications === 'function') {
            var result = checkAndSendNotifications(data.test === true);
            return ContentService.createTextOutput(JSON.stringify({
                result: 'success',
                message: 'Check completed',
                alertCount: result ? result.length : 0
            })).setMimeType(ContentService.MimeType.JSON);
        }
        return ContentService.createTextOutput(JSON.stringify({
            result: 'success',
            message: '알림 체크 함수가 아직 설정되지 않았습니다. 스케줄러 설정을 확인해주세요.',
            alertCount: 0
        })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
}

function getKoreanType(type) {
    switch (type) {
        case 'driving': return '운행';
        case 'fueling': return '주유';
        case 'maintenance': return '정비';
        default: return type;
    }
}

function saveImageToDrive(imageUrl) {
  try {
    const FOLDER_ID = "1t3Cad0Z_1hFDz70o6dJS2G-Rp0VYKfXf";
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const response = UrlFetchApp.fetch(imageUrl);
    const blob = response.getBlob();
    blob.setName(new Date().toISOString().replace(/[:.]/g, '-') + "_image.jpg");
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://drive.google.com/uc?export=view&id=" + file.getId();
  } catch(e) {
    console.error("SaveImageToDrive Error: " + e.toString());
    return "Error: " + e.toString(); 
  }
}`}</pre>
            </div>
          </section>

          <section>
            <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">3. (중요) 권한 설정 강제 적용</h3>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-3 text-sm">
              <p><strong>"권한이 없습니다" 오류가 발생할 경우</strong>, 아래 과정을 따라 권한 스코프를 직접 파일에 명시해야 합니다.</p>
            </div>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
              <li>Apps Script 편집기 좌측 메뉴의 <strong>[프로젝트 설정]</strong> (톱니바퀴 아이콘)을 클릭합니다.</li>
              <li><strong>"편집기에서 'appsscript.json' 매니페스트 파일 표시"</strong> 체크박스를 선택합니다.</li>
              <li>좌측 [편집기] (코드 아이콘)로 돌아오면 파일 목록에 <code>appsscript.json</code>이 보입니다. 클릭하세요.</li>
              <li>파일 내용을 아래와 같이 수정(덮어쓰기)합니다.</li>
            </ol>
            <div className="bg-slate-900 text-slate-50 p-4 rounded-lg mt-3 font-mono text-xs overflow-x-auto">
              <pre>{`{
  "timeZone": "Asia/Seoul",
  "dependencies": {
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request"
  ],
  "webapp": {
    "executeAs": "USER_ACCESSING",
    "access": "ANYONE"
  }
}`}</pre>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              * 수정 후 <strong>반드시 다시 [배포] &gt; [새 배포]</strong>를 해야 적용됩니다.<br />
              * <strong>testPermissions</strong> 함수를 한 번 실행하여 권한 승인 창을 띄워주세요.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">4. 배포 및 연결</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>우측 상단 <strong>[배포] &gt; [새 배포]</strong> 클릭 (버전 업 필수!)</li>
              <li>생성된 <strong>웹 앱 URL</strong>을 복사합니다.</li>
              <li>차량관리 앱 관리자 페이지 &gt; [설정] &gt; [구글 시트 연동 설정]에 붙여넣고 저장합니다.</li>
            </ol>
          </section>
        </div>
      </div>
    </div >
  );
};
