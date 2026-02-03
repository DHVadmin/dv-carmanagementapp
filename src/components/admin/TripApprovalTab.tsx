import React, { useEffect, useState } from 'react';
import { collection, query, where, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Check, RefreshCw } from 'lucide-react';
import { sendSlackNotification } from '../../utils/slackUtils';
import ReasonModal from '../common/ReasonModal';
import ConfirmModal from '../common/ConfirmModal';

interface TripApprovalTabProps {
    settings: any; // SystemSettings
}

export const TripApprovalTab: React.FC<TripApprovalTabProps> = ({ settings }) => {
    const { user } = useAuth();
    const [trips, setTrips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectModal, setRejectModal] = useState<{ isOpen: boolean, log: any | null }>({ isOpen: false, log: null });
    const [approveModal, setApproveModal] = useState<{ isOpen: boolean, log: any | null }>({ isOpen: false, log: null });
    const [successModal, setSuccessModal] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: '' });

    const formatTime = (isoString: string) => {
        if (!isoString) return '--:--';
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch (e) {
            return '--:--';
        }
    };

    useEffect(() => {
        setLoading(true);
        // Use onSnapshot for Real-time Updates
        const q = query(
            collection(db, 'drivingLogs'),
            where('tripStatus', '==', 'pending')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            // Client side sort (safe if index missing for sort)
            list.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setTrips(list);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching trips:", error);
            // If index error, it enters here. We might want to alert developer.
            if (error.code === 'failed-precondition') {
                alert("시스템 오류: DB 인덱스가 필요합니다. 개발자에게 문의하세요.\n(Firestore Index Link Required)");
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const fetchTrips = () => {
        // Legacy function kept for compatibility if refresh button used, but now we use real-time.
        // We can just trigger a manual re-mount or simple log.
        console.log("Refreshing trip list...");
    };

    const sendLogToSheet = async (log: any, status: '승인' | '반려', reason: string = '') => {
        const scriptUrl = settings.businessTripConfig?.url;
        if (!scriptUrl) return;

        // Waypoints: "Stopover1, Stopover2"
        const waypoints = log.stopovers ? log.stopovers.map((s: any) => s.location).join(', ') : '';
        // Passengers: "Alice, Bob (2명)"
        const passengerInfo = log.passengerName ? `${log.passengerName} (${log.passengerCount}명)` : '';

        // Approver Info
        const approverName = user?.displayName || '결재자(시스템)';
        const approverId = user?.email || 'system';

        const payload = {
            action: 'record_trip',
            data: [
                log.startDate || log.date,                  // 0: 시작일자
                log.endDate || log.startDate || log.date,   // 1: 종료일자
                log.userName,                               // 2: 성명(신청자)
                log.userId,                                 // 3: ID(신청자)
                formatTime(log.startTime),                  // 4: 출발시간
                formatTime(log.endTime),                    // 5: 도착시간
                log.destination,                            // 6: 출장지
                log.purpose,                                // 7: 출장목적
                status,                                     // 8: 상태
                status === '승인' ? approverName : '',      // 9: 결재자 (승인 시에만)
                status === '승인' ? approverId : '',        // 10: 결재자ID (승인 시에만)
                waypoints,                                  // 11: 경유지
                passengerInfo,                              // 12: 동승자
                reason,                                     // 13: 반려사유
                log.id                                      // 14: 문서ID
                // Note: 서명 이미지 유무(15, 16)는 GAS에서 처리
            ]
        };

        await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    };

    const handleApproveClick = (log: any) => {
        const scriptUrl = settings.businessTripConfig?.url;
        if (!scriptUrl) {
            alert("관내출장 연동 설정(URL)이 없습니다. 시스템 설정 탭에서 설정해주세요.");
            return;
        }
        setApproveModal({ isOpen: true, log });
    };

    const executeApprove = async () => {
        const log = approveModal.log;
        if (!log) return;

        setProcessingId(log.id);
        setApproveModal({ isOpen: false, log: null }); // Close modal immediately

        try {
            // 1. Send to Google Script
            await sendLogToSheet(log, '승인');

            // 2. Update Firestore
            await updateDoc(doc(db, 'drivingLogs', log.id), {
                tripStatus: 'approved',
                tripApprovedAt: new Date().toISOString()
            });

            // 3. Notify Slack
            if (settings.slackWebhook) {
                sendSlackNotification(
                    settings.slackWebhook,
                    `✅ [관내출장 승인] *${log.userName}* 님의 출장이 승인되었습니다.\n📅 ${log.date} ${log.destination}\n🔗 구글 출장대장에 기록됨.`
                );
            }

            setSuccessModal({
                isOpen: true,
                message: `${log.userName}님의 출장이 승인되었으며,\n구글 시트에 성공적으로 기록되었습니다.`
            });
            fetchTrips();

        } catch (e) {
            console.error("Error during approval:", e);
            alert("승인 처리 중 오류가 발생했습니다.");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (reason: string) => {
        const { log } = rejectModal;
        if (!log) return;

        setProcessingId(log.id);
        try {
            // 1. Send to Google Sheet (Rejection Record)
            const scriptUrl = settings.businessTripConfig?.url;
            if (scriptUrl) {
                await sendLogToSheet(log, '반려', reason);
            }

            // 2. Update Firestore
            await updateDoc(doc(db, 'drivingLogs', log.id), {
                tripStatus: 'rejected',
                rejectReason: reason,
                tripRejectedAt: new Date().toISOString()
            });

            // 3. Notify Slack
            if (settings.slackWebhook) {
                sendSlackNotification(
                    settings.slackWebhook,
                    `🚫 [관내출장 반려] ${log.userName} 님의 출장이 반려되었습니다.\n💬 사유: ${reason}`
                );
            }

            setRejectModal({ isOpen: false, log: null });
            fetchTrips();
        } catch (e) {
            console.error(e);
            alert("반려 처리 실패");
        } finally {
            setProcessingId(null);
        }
    };

    const handleSuccessConfirm = () => {
        setSuccessModal({ isOpen: false, message: '' });
    };

    if (loading) return <div className="p-8 text-center text-gray-500">로딩 중...</div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center text-indigo-700">
                    <Check className="mr-2" /> 관내출장 결재 대기 ({trips.length})
                </h2>
                <button onClick={fetchTrips} className="p-2 bg-gray-100 rounded hover:bg-gray-200">
                    <RefreshCw size={18} />
                </button>
            </div>

            {trips.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500">대기 중인 출장 결재 요청이 없습니다.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {trips.map(log => (
                        <div key={log.id} className="bg-white p-5 rounded-xl shadow border-l-4 border-indigo-500 hover:shadow-md transition">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800">{log.userName} <span className="text-sm font-normal text-gray-500">({log.date})</span></h3>
                                    <p className="text-indigo-600 font-bold">{log.destination}</p>
                                </div>
                                <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold">결재 대기</span>
                            </div>

                            <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1 mb-4">
                                <p><span className="text-gray-500 w-16 inline-block">목적:</span> {log.purpose}</p>
                                <p><span className="text-gray-500 w-16 inline-block">시간:</span>
                                    {formatTime(log.startTime)} ~ {formatTime(log.endTime)}
                                </p>
                                <p><span className="text-gray-500 w-16 inline-block">거리:</span> {log.totalDistance} km</p>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleApproveClick(log)}
                                    disabled={!!processingId}
                                    className={`flex-1 py-3 rounded-lg font-bold text-white transition-colors ${processingId === log.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                                >
                                    {processingId === log.id ? '처리 중...' : '승인 (시트 전송)'}
                                </button>
                                <button
                                    onClick={() => setRejectModal({ isOpen: true, log })}
                                    disabled={!!processingId}
                                    className="flex-1 py-3 bg-red-100 text-red-600 rounded-lg font-bold hover:bg-red-200"
                                >
                                    반려
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Approve Confirmation Modal */}
            <ConfirmModal
                isOpen={approveModal.isOpen}
                title="출장 승인"
                message={`${approveModal.log?.userName} 님의 출장을 승인하시겠습니까?\n구글 시트에 기록되고 슬랙 알림이 전송됩니다.`}
                confirmText="승인"
                isDestructive={false}
                onConfirm={executeApprove}
                onClose={() => setApproveModal({ isOpen: false, log: null })}
            />

            {/* Success Modal */}
            <ConfirmModal
                isOpen={successModal.isOpen}
                title="승인 완료"
                message={successModal.message}
                confirmText="확인"
                isDestructive={false}
                showCancel={false}
                onConfirm={handleSuccessConfirm}
                onClose={handleSuccessConfirm}
            />

            <ReasonModal
                isOpen={rejectModal.isOpen}
                title="반려 사유 입력"
                message={`${rejectModal.log?.userName} 님의 출장을 반려하시겠습니까? 사유를 입력해주세요.`}
                onSubmit={handleReject}
                onClose={() => setRejectModal({ isOpen: false, log: null })}
            />
        </div>
    );
};
