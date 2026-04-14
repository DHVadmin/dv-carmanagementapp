
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
            <p className="font-bold text-blue-700">?“Œ ê´€ë¦¬ì??ë§¤ë‰´??(PC ?˜ê²½ ê¶Œì¥)</p>
            <p className="text-gray-600">êµ¬ê? ?œíŠ¸ ?°ë™???„í•œ Apps Script ?¤ì • ë°©ë²•?…ë‹ˆ?? <span className="font-bold text-blue-600">(v5.5.3)</span></p>
          </div>

          <section>
            <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">1. êµ¬ê? ?œíŠ¸ ì¤€ë¹?/h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>??êµ¬ê? ?¤í”„?ˆë“œ?œíŠ¸ë¥??ì„±?©ë‹ˆ??</li>
              <li>?œíŠ¸(?? ?´ë¦„??<code>DB</code>ë¡?ë³€ê²½í•©?ˆë‹¤. (?€?Œë¬¸??êµ¬ë¶„)</li>
              <li>ì¤‘ìš”: 2ë²ˆì§¸ ??B????<strong>ì¢…ë£Œ??/strong>??ì¶”ê??©ë‹ˆ?? ê¸°ì¡´ ?œíŠ¸ë¥??¬ìš©??ê²½ìš° B?´ì„ ?½ì…?´ì£¼?¸ìš”.</li>
              <li><code>DB</code> ?œíŠ¸??1???¤ë”)?€ ?”ë‘ê±°ë‚˜ ë¹„ì›Œ?Œë„ ?˜ì?ë§? ?±ì´ ?ë™?¼ë¡œ ?‰ì„ ì¶”ê??©ë‹ˆ??</li>
            </ol>
          </section>

          <section>
            <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">2. Apps Script ?ì„±</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>?¤í”„?ˆë“œ?œíŠ¸ ë©”ë‰´?ì„œ <strong>[?•ì¥ ?„ë¡œê·¸ë¨] &gt; [Apps Script]</strong>ë¥??´ë¦­?©ë‹ˆ??</li>
              <li>ê¸°ì¡´ <code>Code.gs</code>???´ìš©??ëª¨ë‘ ì§€?ë‹ˆ??</li>
              <li>?„ë˜ ì½”ë“œë¥?ë³µì‚¬?´ì„œ ë¶™ì—¬?£ìŠµ?ˆë‹¤.</li>
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
            if (data.passengerName) note += \`?™ìŠ¹: \${data.passengerName} \`;
            if (data.stopovers && data.stopovers.length > 0) note += \`ê²½ìœ : \${data.stopovers.length}ê³?\`;
        }

        let driveImageUrl = '';
        if (data.imageUrl) {
            driveImageUrl = saveImageToDrive(data.imageUrl);
        }

        const row = [
            data.startDate || data.date,                   // 1. ?œì‘??
            data.endDate || data.startDate || data.date,   // 2. ì¢…ë£Œ??
            getKoreanType(data.type),                      // 3. êµ¬ë¶„
            \`\${data.vehicleName} (\${data.vehiclePlate})\`,  // 4. ì°¨ëŸ‰
            data.userName,                                 // 5. ?¬ìš©?ëª…
            data.userId || '',                             // 6. ?„ì´??
            data.purpose || '',                            // 7. ëª©ì 
            data.startTime || '',                          // 8. ì¶œë°œ?œê°„
            data.endTime || '',                            // 9. ?„ì°©?œê°„
            data.startMileage || '',                       // 10. ì¶œë°œ?„ì ê±°ë¦¬
            data.endMileage || '',                         // 11. ?„ì°©?„ì ê±°ë¦¬
            data.distance || '',                           // 12. ì£¼í–‰ê±°ë¦¬(km)
            data.amount || '',                             // 13. ì£¼ìœ ??L)
            data.pricePerLiter || '',                      // 14. ì£¼ìœ ?¨ê?
            data.destination || data.station || data.shop || '', // 15. ?¥ì†Œ
            data.item || '',                               // 16. ?•ë¹„??ª©
            data.cost || '',                               // 17. ê¸ˆì•¡
            data.paymentMethod || '',                      // 18. ê²°ì œ?˜ë‹¨
            data.passengerDetail || '',                    // 19. ?™ìŠ¹??
            data.stopoverDetail || '',                     // 20. ê²½ìœ ì§€
            (data.type === 'fueling' && driveImageUrl) ? (driveImageUrl.startsWith('Error') ? driveImageUrl : \`=IMAGE("\${driveImageUrl}")\`) : '',      // 21. ì£¼ìœ ?´ë?ì§€
            (data.type === 'maintenance' && driveImageUrl) ? (driveImageUrl.startsWith('Error') ? driveImageUrl : \`=IMAGE("\${driveImageUrl}")\`) : '',  // 22. ?•ë¹„?´ë?ì§€
            new Date().toLocaleString(),                   // 23. ?±ë¡?¼ì‹œ
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
        case 'driving': return '?´í–‰';
                case 'fueling': return 'ì£¼ìœ ';
                case 'maintenance': return '?•ë¹„';
                default: return type;
    }
}

                function saveImageToDrive(imageUrl) {
  try {
    // ì§€?•í•˜??ê³µìœ  ?´ë” ID
    const FOLDER_ID = "1t3Cad0Z_1hFDz70o6dJS2G-Rp0VYKfXf";

                // 1. Get Folder by ID
                const folder = DriveApp.getFolderById(FOLDER_ID);

                // 2. Fetch Image Blob
                const response = UrlFetchApp.fetch(imageUrl);
                const blob = response.getBlob();

                // 3. Create File in Drive (?´ë¦„ ì¤‘ë³µ ë°©ì? ?€?„ìŠ¤?¬í”„)
                blob.setName(new Date().toISOString().replace(/[:.]/g, '-') + "_image.jpg");
                const file = folder.createFile(blob);

                // 4. Set Permission (ë§í¬ê°€ ?ˆëŠ” ëª¨ë“  ?¬ìš©??ë³´ê¸° ê¶Œí•œ)
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
            <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">3. (ì¤‘ìš”) ê¶Œí•œ ?¤ì • ê°•ì œ ?ìš©</h3>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-3 text-sm">
              <p><strong>"ê¶Œí•œ???†ìŠµ?ˆë‹¤" ?¤ë¥˜ê°€ ë°œìƒ??ê²½ìš°</strong>, ?„ë˜ ê³¼ì •???°ë¼ ê¶Œí•œ ?¤ì½”?„ë? ì§ì ‘ ?Œì¼??ëª…ì‹œ?´ì•¼ ?©ë‹ˆ??</p>
            </div>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-700">
              <li>Apps Script ?¸ì§‘ê¸?ì¢Œì¸¡ ë©”ë‰´??<strong>[?„ë¡œ?íŠ¸ ?¤ì •]</strong> (?±ë‹ˆë°”í€??„ì´ì½????´ë¦­?©ë‹ˆ??</li>
              <li><strong>"?¸ì§‘ê¸°ì—??'appsscript.json' ë§¤ë‹ˆ?˜ìŠ¤???Œì¼ ?œì‹œ"</strong> ì²´í¬ë°•ìŠ¤ë¥?? íƒ?©ë‹ˆ??</li>
              <li>ì¢Œì¸¡ [?¸ì§‘ê¸? (ì½”ë“œ ?„ì´ì½?ë¡??Œì•„?¤ë©´ ?Œì¼ ëª©ë¡??<code>appsscript.json</code>??ë³´ì…?ˆë‹¤. ?´ë¦­?˜ì„¸??</li>
              <li>?Œì¼ ?´ìš©???„ë˜?€ ê°™ì´ ?˜ì •(??–´?°ê¸°)?©ë‹ˆ??</li>
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
              * ?˜ì • ??<strong>ë°˜ë“œ???¤ì‹œ [ë°°í¬] &gt; [??ë°°í¬]</strong>ë¥??´ì•¼ ?ìš©?©ë‹ˆ??<br />
              * <strong>testPermissions</strong> ?¨ìˆ˜ë¥???ë²??¤í–‰?˜ì—¬ ê¶Œí•œ ?¹ì¸ ì°½ì„ ?„ì›Œì£¼ì„¸??
            </p>
          </section>

          <section>
            <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">4. ë°°í¬ ë°??°ê²°</h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>?°ì¸¡ ?ë‹¨ <strong>[ë°°í¬] &gt; [??ë°°í¬]</strong> ?´ë¦­ (ë²„ì „ ???„ìˆ˜!)</li>
              <li>?ì„±??<strong>????URL</strong>??ë³µì‚¬?©ë‹ˆ??</li>
              <li>ì°¨ëŸ‰ê´€ë¦???ê´€ë¦¬ì ?˜ì´ì§€ &gt; [?¤ì •] &gt; [êµ¬ê? ?œíŠ¸ ?°ë™ ?¤ì •]??ë¶™ì—¬?£ê³  ?€?¥í•©?ˆë‹¤.</li>
            </ol>
          </section>
        </div>
      </div>
    </div >
  );
};
