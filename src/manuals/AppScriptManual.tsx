
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
            <p className="text-gray-600">구글 시트 연동을 위한 Apps Script 설정 방법입니다. <span className="font-bold text-blue-600">(v5.5.2)</span></p>
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
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('DB');
        if (!sheet) {
            return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'DB sheet not found' })).setMimeType(ContentService.MimeType.JSON);
        }

        // 1. Action: Delete
        if (data.action === 'delete') {
            if (!data.id) return ContentService.createTextOutput(JSON.stringify({ result: 'error', message: 'No ID provided for deletion' })).setMimeType(ContentService.MimeType.JSON);
            
            const lastRow = sheet.getLastRow();
            if (lastRow < 2) return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: 'Sheet empty' })).setMimeType(ContentService.MimeType.JSON);
            
            // Read all Item IDs (Column 24 / Index 23)
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

        // 2. Action: Write / Update (UPSERT Logic)
        // 'write' action will UPDATE if ID exists, APPEND if it matches no ID.
        
        // --- Prepare Data Row ---
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
            data.startDate || data.date,                   // 1. 시작일
            data.endDate || data.startDate || data.date,   // 2. 종료일
            getKoreanType(data.type),                      // 3. 구분
            \`\${data.vehicleName} (\${data.vehiclePlate})\`,  // 4. 차량
            data.userName,                                 // 5. 사용자명
            data.userId || '',                             // 6. 아이디
            data.purpose || '',                            // 7. 목적
            data.startTime || '',                          // 8. 출발시간
            data.endTime || '',                            // 9. 도착시간
            data.startMileage || '',                       // 10. 출발누적거리
            data.endMileage || '',                         // 11. 도착누적거리
            data.distance || '',                           // 12. 주행거리(km)
            data.amount || '',                             // 13. 주유량(L)
            data.pricePerLiter || '',                      // 14. 주유단가
            data.destination || data.station || data.shop || '', // 15. 장소
            data.item || '',                               // 16. 정비항목
            data.cost || '',                               // 17. 금액
            data.paymentMethod || '',                      // 18. 결제수단
            data.passengerDetail || '',                    // 19. 동승자
            data.stopoverDetail || '',                     // 20. 경유지
            (data.type === 'fueling' && driveImageUrl) ? (driveImageUrl.startsWith('Error') ? driveImageUrl : \`=IMAGE("\${driveImageUrl}")\`) : '',      // 21. 주유이미지
            (data.type === 'maintenance' && driveImageUrl) ? (driveImageUrl.startsWith('Error') ? driveImageUrl : \`=IMAGE("\${driveImageUrl}")\`) : '',  // 22. 정비이미지
            new Date().toLocaleString(),                   // 23. 등록일시
            data.id || ''                                  // 24. Log ID
        ];

        // --- Find & Upsert ---
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
            // Update existing row
            sheet.getRange(foundIndex, 1, 1, row.length).setValues([row]);
            return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: 'Updated row ' + foundIndex })).setMimeType(ContentService.MimeType.JSON);
        } else {
            // Append new row
            sheet.appendRow(row);
            return ContentService.createTextOutput(JSON.stringify({ result: 'success', message: 'Appended new row' })).setMimeType(ContentService.MimeType.JSON);
        }

    } catch (error) {
        console.error("Main Error: " + error.toString()); 
        return ContentService.createTextOutput(JSON.stringify({result: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
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
    // 지정하신 공유 폴더 ID
    const FOLDER_ID = "1t3Cad0Z_1hFDz70o6dJS2G-Rp0VYKfXf";

                // 1. Get Folder by ID
                const folder = DriveApp.getFolderById(FOLDER_ID);

                // 2. Fetch Image Blob
                const response = UrlFetchApp.fetch(imageUrl);
                const blob = response.getBlob();

                // 3. Create File in Drive (이름 중복 방지 타임스탬프)
                blob.setName(new Date().toISOString().replace(/[:.]/g, '-') + "_image.jpg");
                const file = folder.createFile(blob);

                // 4. Set Permission (링크가 있는 모든 사용자 보기 권한)
                file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

                // 5. Return Direct Link
                return "https://drive.google.com/uc?export=view&id=" + file.getId();
    
  } catch(e) {
                  console.error("SaveImageToDrive Error: " + e.toString());
                // CRITICAL: Return error message to display in sheet
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
