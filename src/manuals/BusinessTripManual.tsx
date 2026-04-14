
import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';

interface ManualProps {
  onClose: () => void;
}

export const BusinessTripManual: React.FC<ManualProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);

  const scriptCode = `/**
 * [수신 스크립트] 관내출장 기록 수신 및 서명 확인 (수정완료V4.1)
 * 
 * - 기능: 전송된 출장 기록을 'DB_Logs' 시트에 저장
 * - 서명: 신청자/결재자 이름으로 드라이브에서 서명 파일을 찾아 유무를 기록
 * - 설정: 스크립트 속성 'SIGNATURE_FOLDER_ID' 설정 필요
 */

const TARGET_SHEET_NAME = 'DB_Logs';

function doPost(e) {
    if (!e || !e.postData || !e.postData.contents) {
        return ContentService.createTextOutput("No data received");
    }
    try {
        var jsonString = e.postData.contents;
        var params = JSON.parse(jsonString);

        if (params.action === 'record_trip') {
            return recordTrip(params.data);
        }
        
        return ContentService.createTextOutput("Unknown action: " + params.action);
    } catch (err) {
        return ContentService.createTextOutput("Error: " + err.toString());
    }
}

function recordTrip(data) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(TARGET_SHEET_NAME);
    
    if (!sheet) {
        sheet = ss.insertSheet(TARGET_SHEET_NAME);
        // 헤더 설정 (17열)
        sheet.appendRow([
            "시작일자", "종료일자", "성명", "ID", "출발시간", "도착시간", 
            "출장지", "출장목적", "상태", "결재자", "결재자ID", 
            "경유지", "동승자", "반려사유", "신청자서명", "결재자서명", "문서ID"
        ]);
    }

    // 데이터 인덱스 매핑 (Payload 기준)
    // 0:startDate, 1:endDate, 2:userName, 3:userId, 4:startTime, 5:endTime
    // 6:destination, 7:purpose, 8:status, 9:approverName, 10:approverId
    // 11:waypoints, 12:passengerInfo, 13:reason, 14:docId

    var userName = data[2];       // 신청자 성명
    var status = data[8];         // 상태
    var approverName = data[9];   // 결재자 성명

    // 서명 확인
    var userSignStatus = checkSignature(userName);
    var approverSignStatus = "대상아님";

    if (status === '승인') {
        if (approverName && approverName.trim() !== '') {
            approverSignStatus = checkSignature(approverName);
        } else {
            approverSignStatus = "결재자정보없음";
        }
    } else if (status === '반려') {
        approverSignStatus = "반려됨";
    }

    // 최종 Row 구성 (17열)
    var finalRow = [
        data[0], // A: 시작일자
        data[1], // B: 종료일자
        data[2], // C: 성명
        data[3], // D: ID
        data[4], // E: 출발시간
        data[5], // F: 도착시간
        data[6], // G: 출장지
        data[7], // H: 출장목적
        data[8], // I: 상태
        data[9], // J: 결재자
        data[10], // K: 결재자ID
        data[11], // L: 경유지
        data[12], // M: 동승자
        data[13], // N: 반려사유
        userSignStatus,     // O: 신청자서명
        approverSignStatus, // P: 결재자서명
        data[14]            // Q: 문서ID
    ];

    sheet.appendRow(finalRow);
    return ContentService.createTextOutput("Success");
}

function checkSignature(name) {
    if (!name) return "이름없음";
    
    // 스크립트 속성에서 폴더 ID 가져오기
    var folderId = PropertiesService.getScriptProperties().getProperty('SIGNATURE_FOLDER_ID');
    if (!folderId) return "설정오류(ID없음)";

    try {
        var folder = DriveApp.getFolderById(folderId);
        var cleanName = name.replace(/\\s+/g, ''); // 공백 제거 이름

        // 검색할 파일명 후보군
        var candidates = [
            name + ".png", name + ".jpg", name,
            cleanName + ".png", cleanName + ".jpg", cleanName
        ];

        for (var i = 0; i < candidates.length; i++) {
            var files = folder.getFilesByName(candidates[i]);
            if (files.hasNext()) return "서명있음";
        }
        return "서명없음";
    } catch (e) {
        return "폴더접근실패:" + e.toString();
    }
}
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-bold text-indigo-800">📋 관내출장 수신 스크립트 (수정완료V4.1)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6 text-sm text-gray-800 flex-1 overflow-y-auto">
          <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4">
            <p className="font-bold text-indigo-700">안내</p>
            <p className="text-gray-600 mt-1">
              이 스크립트는 <strong>관내출장 기록 수신 및 서명 확인</strong> 기능만 포함된 수정 버전입니다.
              <br />기존 코드를 모두 삭제하고 교체해주세요.
              <br /><span className="text-red-600 font-bold">* 중요: 스크립트 속성에 'SIGNATURE_FOLDER_ID'를 설정해야 서명이 연동됩니다.</span>
            </p>
          </div>

          <div className="mt-4 relative group">
            <div className="absolute top-2 right-2">
              <button
                onClick={handleCopy}
                className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${copied
                  ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                  : 'bg-white text-gray-600 hover:text-indigo-600 border shadow-sm'
                  }`}
              >
                {copied ? <><Check size={14} className="mr-1" /> 복사됨</> : <><Copy size={14} className="mr-1" /> 코드 복사</>}
              </button>
            </div>
            <pre className="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed border border-gray-700">
              {scriptCode}
            </pre>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
