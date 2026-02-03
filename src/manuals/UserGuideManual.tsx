
import React from 'react';

export const UserGuideManual: React.FC = () => {
    return (
        <div className="space-y-8 text-sm text-gray-800 leading-relaxed font-sans pb-10">
            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
                <p className="font-bold text-green-700">📱 사용자용 매뉴얼 (모바일 환경)</p>
                <p className="text-gray-600">앱의 주요 기능 및 최신 변경사항을 안내합니다.</p>
            </div>

            <section>
                <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">1. 로그인 및 시작</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li>관리자로부터 부여받은 계정(이메일)과 비밀번호로 로그인합니다.</li>
                    <li>앱 점검 모드가 활성화된 경우, 서비스 이용이 일시적으로 제한될 수 있습니다.</li>
                </ul>
            </section>

            <section>
                <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">2. 차량 선택</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li>로그인 후 <strong>차량 목록</strong> 화면이 나타납니다.</li>
                    <li>운행 또는 관리할 차량을 터치하여 선택합니다.</li>
                    <li>차량의 현재 누적 주행거리와 상태를 한눈에 확인할 수 있습니다.</li>
                    <li><strong>[보험/차량등록증]</strong> 버튼을 눌러 관련 서류 이미지를 팝업으로 확인할 수 있습니다.</li>
                </ul>
            </section>

            <section>
                <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">3. 운행 기록 작성</h3>
                <div className="pl-2 space-y-3">
                    <div>
                        <h4 className="font-bold text-blue-600">📝 운행 기록 입력</h4>
                        <p className="text-gray-600 mb-1">차량 선택 후 <strong>[운행]</strong> 탭에서 기록을 작성합니다.</p>
                        <ul className="list-disc pl-5 text-gray-600 space-y-1">
                            <li><strong>누적 주행거리:</strong> 출발 시점의 누적 거리는 자동 입력되며, 도착 후 누적 거리를 입력하면 주행거리가 자동 계산됩니다.</li>
                            <li><strong>총 운행 거리:</strong> 이번 운행 거리를 직접 입력하여 누적 거리를 자동 계산할 수도 있습니다.</li>
                            <li><strong>목적지:</strong> 여러 곳을 방문한 경우, 목적지를 입력하고 [추가]하거나 엔터키를 눌러 <strong>다중 목적지</strong>를 등록할 수 있습니다.</li>
                            <li><strong>경유지:</strong> 경유한 장소가 있다면 별도로 추가하여 상세하게 기록할 수 있습니다.</li>
                            <li><strong>동승자:</strong> 동승자가 있는 경우 이름이나 인원수를 기록합니다.</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold text-indigo-600">🏢 관내 출장 체크</h4>
                        <p className="text-gray-600">
                            공무 수행을 위한 관내 출장의 경우, 상단의 <strong>[관내출장]</strong> 체크박스를 선택하세요.<br />
                            저장 시 관리자에게 <strong>승인 요청</strong>이 전송되며, Slack으로 알림이 발송됩니다.
                        </p>
                    </div>
                </div>
            </section>

            <section>
                <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">4. 주유 기록</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li><strong>[주유]</strong> 탭을 선택하여 기록합니다.</li>
                    <li><strong>영수증/주유기</strong> 사진을 촬영하여 첨부할 수 있습니다. (이미지는 자동 최적화되어 업로드됩니다)</li>
                    <li>주유소 이름, 주유량(L), 금액을 입력합니다. (단가는 자동 계산됨)</li>
                    <li>자주 가는 주유소는 목록에서 빠르게 선택할 수 있습니다.</li>
                </ul>
            </section>

            <section>
                <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">5. 정비 기록</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li><strong>[정비]</strong> 탭에서 차량 정비 내역을 기록합니다.</li>
                    <li><strong>정비 항목:</strong> 관리자가 설정한 항목(엔진오일, 타이어 등)을 드롭다운에서 선택할 수 있습니다.</li>
                    <li>정비 사진(명세서 등)을 첨부하고, 비용과 결제 수단을 입력합니다.</li>
                    <li>기록된 내용은 소모품 교체 주기 알림의 기초 데이터로 활용됩니다.</li>
                </ul>
            </section>

            <section>
                <h3 className="font-bold text-lg text-slate-800 border-b pb-2 mb-3">6. 기록 조회 및 수정</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li>화면 하단의 <strong>[기록 조회]</strong> 탭에서 과거 이력을 볼 수 있습니다.</li>
                    <li><strong>[내 기록만 보기]</strong> 필터를 통해 본인의 기록만 모아볼 수 있습니다.</li>
                    <li>본인이 작성한 기록은 상세 화면에서 <strong>[수정 요청]</strong> 또는 <strong>[삭제 요청]</strong>을 할 수 있습니다.</li>
                    <li>관내출장 신청이 <strong>반려</strong>된 경우, 해당 기록을 수정하여 <strong>재신청</strong>할 수 있습니다.</li>
                </ul>
            </section>

            <div className="text-center text-xs text-gray-400 mt-8">
                © Vehicle Management App Guide v5.3.0
            </div>
        </div>
    );
};
