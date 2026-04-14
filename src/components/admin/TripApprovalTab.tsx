import React, { useEffect, useState } from 'react';
import { collection, query, where, updateDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Check, RefreshCw } from 'lucide-react';
import { sendTripStatusNotification } from '../../utils/slackUtils';
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
                await sendTripStatusNotification(settings, log, '승인');
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
                await sendTripStatusNotification(settings, log, '반려', reason);
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
                        <div key={log.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                            {/* 1. Header: Name (Start ~ End) */}
                            <div className="flex justify-between items-start mb-3 border-b pb-3 border-gray-100">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg text-gray-900">{log.userName}</h3>
                                    <span className="text-sm text-gray-500 font-medium">
                                        ({log.startDate || log.date} ~ {log.endDate || log.date})
                                    </span>
                                </div>
                                <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap">
                                    결재 대기
                                </span>
                            </div>

                            {/* 2. Destination (Highlighted) */}
                            <div className="mb-4">
                                <span className="text-xs text-indigo-500 font-bold mb-1 block">출장지</span>
                                <p className="text-xl font-extrabold text-gray-800 break-keep leading-tight">
                                    {log.destination}
                                </p>
                            </div>

                            {/* 3. Detailed Info Grid */}
                            <div className="bg-gray-50 rounded-lg p-4 space-y-3 mb-5 text-sm">
                                {/* Row 1: Purpose & Vehicle */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="flex items-center text-gray-700">
                                        <span className="w-5 flex justify-center mr-2 text-indigo-500">🎯</span>
                                        <span className="font-semibold mr-2 w-10 text-gray-500">목적</span>
                                        <span className="font-medium text-gray-900 flex-1 truncate">{log.purpose}</span>
                                    </div>
                                    <div className="flex items-center text-gray-700">
                                        <span className="w-5 flex justify-center mr-2 text-indigo-500">🚗</span>
                                        <span className="font-semibold mr-2 w-10 text-gray-500">차량</span>
                                        <span className="font-medium text-gray-900 flex-1 truncate">
                                            {log.vehicleName ? `${log.vehicleName} (${log.vehiclePlate})` : (log.carName || '차량 미지정')}
                                        </span>
                                    </div>
                                </div>

                                <div className="h-px bg-gray-200 w-full my-1"></div>

                                {/* Row 2: Time & Duration */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="flex items-center text-gray-700">
                                        <span className="w-5 flex justify-center mr-2 text-indigo-500">🕒</span>
                                        <span className="font-semibold mr-2 w-10 text-gray-500">시간</span>
                                        <span className="font-medium text-gray-900 tracking-tight">
                                            {formatTime(log.startTime)} ~ {formatTime(log.endTime)}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-gray-700">
                                        <span className="w-5 flex justify-center mr-2 text-indigo-500">⏳</span>
                                        <span className="font-semibold mr-2 w-10 text-gray-500">소요</span>
                                        <span className="font-medium text-gray-900">
                                            {(() => {
                                                if (!log.startTime || !log.endTime) return '-';
                                                const start = new Date(log.startTime).getTime();
                                                const end = new Date(log.endTime).getTime();
                                                const diff = end - start;
                                                if (diff < 0) return '0분';
                                                const hours = Math.floor(diff / (1000 * 60 * 60));
                                                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                                return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
                                            })()}
                                        </span>
                                    </div>
                                </div>

                                <div className="h-px bg-gray-200 w-full my-1"></div>

                                {/* Row 3: Others (Mileage, Passengers, Stops, Costs) */}
                                <div className="space-y-2 pt-1">
                                    <div className="flex items-center">
                                        <span className="w-5 flex justify-center mr-2 text-gray-400">📏</span>
                                        <span className="text-gray-600 mr-2">주행거리:</span>
                                        <span className="font-medium text-gray-900">
                                            {log.startMileage?.toLocaleString()} km → {log.endMileage?.toLocaleString()} km
                                            <span className="text-indigo-600 font-bold ml-2">
                                                (총 {log.totalDistance?.toLocaleString()} km)
                                            </span>
                                        </span>
                                    </div>

                                    {(log.passengerCount > 0 || log.passengerName) && (
                                        <div className="flex items-center">
                                            <span className="w-5 flex justify-center mr-2 text-gray-400">👥</span>
                                            <span className="text-gray-600 mr-2">동승자:</span>
                                            <span className="font-medium text-gray-900">
                                                {log.passengerName} <span className="text-gray-500 text-xs">({log.passengerCount}명)</span>
                                            </span>
                                        </div>
                                    )}

                                    {log.stopovers && log.stopovers.length > 0 && (
                                        <div className="flex items-start">
                                            <span className="w-5 flex justify-center mr-2 text-gray-400 mt-0.5">🚩</span>
                                            <span className="text-gray-600 mr-2 whitespace-nowrap">경유지:</span>
                                            <span className="font-medium text-gray-900 break-all">
                                                {log.stopovers.map((s: any) => s.location).join(', ')}
                                            </span>
                                        </div>
                                    )}

                                    {(log.fuelCost > 0 || log.tollCost > 0 || log.etcCost > 0) && (
                                        <div className="flex items-center">
                                            <span className="w-5 flex justify-center mr-2 text-gray-400">💰</span>
                                            <span className="text-gray-600 mr-2">비용:</span>
                                            <div className="flex gap-3 text-gray-900 font-medium">
                                                {log.fuelCost > 0 && <span>주유 {log.fuelCost.toLocaleString()}원</span>}
                                                {log.tollCost > 0 && <span>통행/주차 {log.tollCost.toLocaleString()}원</span>}
                                                {log.etcCost > 0 && <span>기타 {log.etcCost.toLocaleString()}원</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleApproveClick(log)}
                                    disabled={!!processingId}
                                    className={`flex-1 py-3.5 rounded-lg font-bold text-white text-base shadow-sm transition-all
                                        ${processingId === log.id
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md active:scale-[0.98]'
                                        }`}
                                >
                                    {processingId === log.id ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <RefreshCw className="animate-spin w-5 h-5" /> 처리 중...
                                        </span>
                                    ) : '승인하기'}
                                </button>
                                <button
                                    onClick={() => setRejectModal({ isOpen: true, log })}
                                    disabled={!!processingId}
                                    className="px-6 py-3.5 bg-white border border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm"
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
