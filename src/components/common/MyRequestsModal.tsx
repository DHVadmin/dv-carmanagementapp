import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { X, CheckCircle, XCircle, Clock, Trash2, Edit2, Briefcase, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MyRequestsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string;
}

const MyRequestsModal: React.FC<MyRequestsModalProps> = ({ isOpen, onClose, userEmail }) => {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchRequests = async () => {
            setLoading(true);
            try {
                const [modReqs, tripReqs] = await Promise.all([
                    getDocs(query(
                        collection(db, 'modificationRequests'),
                        where('requester', '==', userEmail),
                        limit(50)
                    )),
                    getDocs(query(
                        collection(db, 'drivingLogs'),
                        where('userId', '==', userEmail),
                        where('isBusinessTrip', '==', true),
                        limit(50)
                    ))
                ]);

                const merged = [
                    ...modReqs.docs.map(d => ({ id: d.id, _type: 'modification', ...d.data() })),
                    ...tripReqs.docs.map(d => ({ id: d.id, _type: 'trip', ...d.data() }))
                ];

                // Sort by timestamp (Modification) or date (Trip) - standardizing to simplified timestamp for sort
                merged.sort((a: any, b: any) => {
                    const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.date).getTime();
                    const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.date).getTime();
                    return timeB - timeA;
                });

                setRequests(merged);
            } catch (e) {
                console.error("Failed to fetch my requests", e);
            } finally {
                setLoading(false);
            }
        };

        if (isOpen && userEmail) {
            fetchRequests();
        }
    }, [isOpen, userEmail]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800">나의 요청 및 출장 현황</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">로딩 중...</div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">내역이 없습니다.</div>
                    ) : (
                        <div className="space-y-3">
                            {requests.map(req => {
                                const isTrip = req._type === 'trip';
                                let status = isTrip ? (req.tripStatus || 'pending') : req.status;
                                let badgeColor = 'bg-gray-100 text-gray-700';

                                if (req._type === 'modification') {
                                    badgeColor = req.changeType === 'update' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700';
                                } else {
                                    badgeColor = 'bg-purple-100 text-purple-700';
                                }

                                return (
                                    <div key={req.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${badgeColor}`}>
                                                    {isTrip ? <Briefcase size={12} /> : (req.changeType === 'update' ? <Edit2 size={12} /> : <Trash2 size={12} />)}
                                                    {isTrip ? '관내출장' : (req.changeType === 'update' ? '수정요청' : '삭제요청')}
                                                </span>
                                                <span className="text-gray-500 text-xs">
                                                    {req.timestamp?.toDate ? req.timestamp.toDate().toLocaleString() : (req.date || '-')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {status === 'approved' && <span className="text-green-600 text-sm font-bold flex items-center"><CheckCircle size={14} className="mr-1" /> 승인됨</span>}
                                                {status === 'rejected' && <span className="text-red-500 text-sm font-bold flex items-center"><XCircle size={14} className="mr-1" /> 반려됨</span>}
                                                {status === 'pending' && <span className="text-yellow-500 text-sm font-bold flex items-center"><Clock size={14} className="mr-1" /> 결재 대기</span>}
                                            </div>
                                        </div>

                                        {isTrip ? (
                                            // Business Trip Display
                                            <div className="text-sm text-gray-700 mb-2">
                                                <div><span className="font-bold">목적지:</span> {req.destination}</div>
                                                <div><span className="font-bold">목적:</span> {req.purpose}</div>
                                            </div>
                                        ) : (
                                            // Modification Request Display
                                            <div className="text-gray-700 text-sm mb-2">
                                                <span className="font-bold text-gray-900">요청 사유:</span> {req.reason}
                                            </div>
                                        )}

                                        {/* Rejection Reason */}
                                        {status === 'rejected' && (req.rejectReason) && (
                                            <div className="bg-red-50 p-3 rounded-lg text-sm text-red-700 mt-2 border border-red-100">
                                                <span className="font-bold">⚠️ 반려 사유:</span> {req.rejectReason}
                                            </div>
                                        )}

                                        {/* 7. Re-application Button */}
                                        {status === 'rejected' && isTrip && (
                                            <div className="mt-3 flex justify-end">
                                                <button
                                                    onClick={() => {
                                                        onClose();
                                                        navigate(`/log/${req.vehicleId}`, {
                                                            state: {
                                                                reapplyData: {
                                                                    id: req.id, // Pass ID for "Edit" mode
                                                                    date: req.date,
                                                                    destination: req.destination,
                                                                    purpose: req.purpose,
                                                                    startMileage: req.startMileage,
                                                                    endMileage: req.endMileage,
                                                                    startTime: req.startTime,
                                                                    endTime: req.endTime,
                                                                    passengerName: req.passengerName,
                                                                    isBusinessTrip: req.isBusinessTrip,
                                                                    stopovers: req.stopovers
                                                                    // We pass the data to pre-fill
                                                                },
                                                                mode: 'reapply'
                                                            }
                                                        });
                                                    }}
                                                    className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm font-bold hover:bg-blue-200 transition-colors"
                                                >
                                                    <RefreshCw size={14} /> 재신청하기
                                                </button>
                                            </div>
                                        )}

                                        {/* Original Data Summary (Only for Mod Requests) */}
                                        {!isTrip && (
                                            <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-500 mt-2">
                                                <div>대상: {req.targetCollection === 'drivingLogs' ? '운행일지' : (req.targetCollection === 'fuelingLogs' ? '주유일지' : '정비일지')}</div>
                                                <div>날짜: {req.originalData?.date} {req.originalData?.type && `(${req.originalData.type})`}</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-white">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MyRequestsModal;
