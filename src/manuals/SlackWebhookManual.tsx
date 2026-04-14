
import React from 'react';
import { X } from 'lucide-react';

interface ManualProps {
    onClose: () => void;
}

export const SlackWebhookManual: React.FC<ManualProps> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X size={24} />
                </button>
                <div className="p-8 space-y-6 text-sm text-gray-800 leading-relaxed font-sans">
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                        <p className="font-bold text-blue-700">📌 관리자용 매뉴얼 (PC 환경 권장)</p>
                        <p className="text-gray-600">소모품 교체 주기 알림을 Slack으로 받기 위한 설정 방법입니다.</p>
                    </div>

                    <section>
                        <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">1. Slack 앱 생성 (Incoming Webhook)</h3>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>PC 브라우저에서 <a href="https://api.slack.com/apps" target="_blank" className="text-blue-600 underline">Slack API Apps 페이지</a>로 이동합니다.</li>
                            <li><strong>[Create New App]</strong> 버튼을 클릭하고 <strong>[From scratch]</strong>를 선택합니다.</li>
                            <li>
                                App Name을 입력(예: <code>차량관리알림</code>)하고, 알림을 받을 워크스페이스를 선택한 뒤 [Create App]을 클릭합니다.
                            </li>
                        </ol>
                    </section>

                    <section>
                        <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">2. Webhook 활성화</h3>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>좌측 메뉴에서 <strong>[Incoming Webhooks]</strong>를 클릭합니다.</li>
                            <li>우측 상단의 토글 스위치를 <strong>On</strong>으로 변경하여 활성화합니다.</li>
                        </ol>
                    </section>

                    <section>
                        <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">3. 채널 연결 및 URL 복사</h3>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>화면 하단의 <strong>[Add New Webhook to Workspace]</strong> 버튼을 클릭합니다.</li>
                            <li>알림을 전송받을 채널(예: <code>#일반</code>, <code>#차량관리</code>)을 선택하고 [Allow]를 클릭합니다.</li>
                            <li>생성된 Webhook URL 항목에서 <strong>[Copy]</strong> 버튼을 눌러 URL을 복사합니다.</li>
                            <li className="text-xs text-slate-500 bg-gray-100 p-2 rounded">
                                형식 예: <code>https://hooks.slack.com/services/T00000/B00000/XXXXX</code>
                            </li>
                        </ol>
                    </section>

                    <section>
                        <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">4. 앱에 적용</h3>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>차량관리 앱 관리자 페이지 &gt; [설정] 탭으로 이동합니다.</li>
                            <li>[Slack 알림 설정] 섹션에 복사한 URL을 입력하고 저장합니다.</li>
                            <li>[테스트 전송] 버튼을 눌러 슬랙 채널에 메시지가 오는지 확인합니다.</li>
                        </ol>
                    </section>
                </div>
            </div>
        </div>
    );
};
