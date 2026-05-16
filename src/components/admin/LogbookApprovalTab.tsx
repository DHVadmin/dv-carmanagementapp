import React, { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, FileText, AlertTriangle, RefreshCw } from 'lucide-react';
import type { Vehicle, Log, LogbookApproval } from '../../types';
import ReasonModal from '../common/ReasonModal';

interface Props {
    currentUserRole: string;
}

const ROLE_STEPS: Record<string, number> = {
    'admin_담당': 0,
    'approver_담당': 0,
    'approver_실장': 1,
    'approver_국장': 2,
    'approver_원장': 3,
    'admin': 3, // admin은 최고 결재 단계(원장급)로 모든 단계 승인 가능
};

const STEP_ROLES = ['담당', '실장', '국장', '원장'];

export const LogbookApprovalTab: React.FC<Props> = ({ currentUserRole }) => {
    // Current month in YYYY-MM
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const [approvalDoc, setApprovalDoc] = useState<LogbookApproval | null>(null);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(false);
    
    // UI states
    const [expandedVehicles, setExpandedVehicles] = useState<Record<string, boolean>>({});
    const [reasonModalOpen, setReasonModalOpen] = useState(false);

    const userStep = ROLE_STEPS[currentUserRole] ?? -1;

    useEffect(() => {
        fetchVehicles();
    }, []);

    useEffect(() => {
        if (selectedMonth) {
            loadApprovalAndLogs();
        }
    }, [selectedMonth]);

    const fetchVehicles = async () => {
        const snap = await getDocs(collection(db, 'vehicles'));
        setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    };

    const loadApprovalAndLogs = async () => {
        setLoading(true);
        try {
            // 1. Check if an approval doc exists for this month
            const approvalRef = doc(db, 'logbookApprovals', selectedMonth);
            const approvalSnap = await getDoc(approvalRef);

            if (approvalSnap.exists()) {
                const data = approvalSnap.data() as LogbookApproval;
                setApprovalDoc(data);
                // Parse logsData directly from the snapshot
                setLogs(JSON.parse(data.logsData));
            } else {
                setApprovalDoc(null);
                // 2. Fetch fresh logs if no snapshot exists (only really useful for step 0)
                if (userStep === 0) {
                    await fetchRawLogsForMonth(selectedMonth);
                } else {
                    setLogs([]);
                }
            }
        } catch (error) {
            console.error("Error loading approval data:", error);
            alert("결재 데이터를 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const fetchRawLogsForMonth = async (monthStr: string) => {
        // We will fetch where startDate starts with YYYY-MM
        // Since we can't do simple startsWith in Firestore easily without range queries,
        // we'll fetch logs >= YYYY-MM-01 and <= YYYY-MM-31
        const startDate = `${monthStr}-01`;
        const endDate = `${monthStr}-31`;

        try {
            const fetchCollection = async (colName: string) => {
                const q1 = query(collection(db, colName), where('startDate', '>=', startDate), where('startDate', '<=', endDate));
                const q2 = query(collection(db, colName), where('date', '>=', startDate), where('date', '<=', endDate));
                
                // Fetch both just in case legacy 'date' is used instead of 'startDate'
                // This might be inefficient, but works around data inconsistency
                const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
                
                const combined = new Map();
                snap1.docs.forEach(d => combined.set(d.id, { id: d.id, ...d.data() }));
                snap2.docs.forEach(d => combined.set(d.id, { id: d.id, ...d.data() }));
                
                return Array.from(combined.values());
            };

            const [driving, fueling, maint] = await Promise.all([
                fetchCollection('drivingLogs'),
                fetchCollection('fuelingLogs'),
                fetchCollection('maintenanceLogs')
            ]);

            const usersSnap = await getDocs(collection(db, 'users'));
            const userMap = new Map();
            usersSnap.docs.forEach(doc => userMap.set(doc.id, doc.data().name || doc.data().email));

            const combinedLogs: Log[] = [
                ...driving.map(d => ({ ...d, type: 'driving', typeKr: '운행' })),
                ...fueling.map(d => ({ ...d, type: 'fueling', typeKr: '주유' })),
                ...maint.map(d => ({ ...d, type: 'maintenance', typeKr: '정비' }))
            ].map((d: any) => ({
                ...d,
                userName: d.userName || userMap.get(d.userId) || d.userId
            })) as Log[];

            setLogs(combinedLogs);
            return combinedLogs;
        } catch (error) {
            console.error("Error fetching raw logs:", error);
            return [];
        }
    };

    const toggleVehicleAccordion = (vehicleId: string) => {
        setExpandedVehicles(prev => ({ ...prev, [vehicleId]: !prev[vehicleId] }));
    };

    // Calculate sum for each vehicle
    const groupedLogs = vehicles.map(v => {
        const vLogs = logs.filter(l => l.vehicleId === v.id);
        const driving = vLogs.filter(l => l.type === 'driving');
        const fueling = vLogs.filter(l => l.type === 'fueling');
        const maint = vLogs.filter(l => l.type === 'maintenance');

        const totalDist = driving.reduce((sum, l) => sum + (Number(l.totalDistance) || 0), 0);
        const totalFuelCost = fueling.reduce((sum, l) => sum + (Number(l.cost) || 0), 0);
        const totalMaintCost = maint.reduce((sum, l) => sum + (Number(l.cost) || 0), 0);

        return {
            vehicle: v,
            logs: vLogs,
            driving,
            fueling,
            maint,
            totalDist,
            totalFuelCost,
            totalMaintCost
        };
    }).filter(group => group.logs.length > 0 || group.vehicle); // keep all vehicles or only those with logs? let's keep all for now to show 0.

    // Actions
    const handleInitialSubmit = async () => {
        if (!confirm(`${selectedMonth}월 차량일지 결재를 상신하시겠습니까?\n(상신 후에는 내용 수정이 어렵습니다.)`)) return;
        
        try {
            const currentUser = auth.currentUser;
            const userDoc = await getDoc(doc(db, 'users', currentUser!.uid));
            const userName = userDoc.exists() ? userDoc.data().name || currentUser!.email : currentUser!.email;

            // Include vehicle IDs that have logs
            const activeVehicleIds = Array.from(new Set(logs.map(l => l.vehicleId)));

            const newApproval: LogbookApproval = {
                month: selectedMonth,
                status: '담당', // It means 담당 has approved
                currentStep: 1, // Now waiting for 실장
                vehicleIds: activeVehicleIds as string[],
                logsData: JSON.stringify(logs), // Snapshot
                approvals: [{
                    step: 0,
                    role: '담당',
                    userId: currentUser!.uid,
                    userName: userName || 'Unknown',
                    timestamp: new Date() // will be replaced by serverTimestamp in firestore mostly, but keeping date object for immediate UI
                }],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            const dataToSave = { ...newApproval, approvals: [{ ...newApproval.approvals[0], timestamp: serverTimestamp() }] };
            await setDoc(doc(db, 'logbookApprovals', selectedMonth), dataToSave);
            
            alert('상신 완료되었습니다.');
            loadApprovalAndLogs();
        } catch (error) {
            console.error("Submit error:", error);
            alert('상신 중 오류가 발생했습니다.');
        }
    };

    const handleApprove = async () => {
        if (!approvalDoc) return;
        if (!confirm(`[${STEP_ROLES[userStep]}] 단계 승인을 진행하시겠습니까?`)) return;

        try {
            const currentUser = auth.currentUser;
            const userDoc = await getDoc(doc(db, 'users', currentUser!.uid));
            const userName = userDoc.exists() ? userDoc.data().name || currentUser!.email : currentUser!.email;

            const nextStep = approvalDoc.currentStep + 1;
            const isFinal = nextStep > 3;

            if (isFinal) {
                try {
                    const { sendToGoogleSheet } = await import('../../utils/googleSheets');
                    const settingsSnap = await getDoc(doc(db, 'settings', 'default'));
                    if (settingsSnap.exists()) {
                        const settings = settingsSnap.data() as any;
                        const webhookUrl = settings.sheetConfig?.url || localStorage.getItem('GOOGLE_SHEET_WEBHOOK_URL');
                        if (webhookUrl) {
                            const payload = {
                                event: 'LOGBOOK_APPROVAL_FINALIZED',
                                month: selectedMonth,
                                approver: userName,
                                approvedAt: new Date().toISOString(),
                                data: JSON.parse(approvalDoc.logsData),
                            };
                            await sendToGoogleSheet(payload, webhookUrl);
                        }
                    }
                } catch (e) {
                    console.error('Webhook error:', e);
                }
            }

            const newApprovalEntry = {
                step: userStep,
                role: STEP_ROLES[userStep],
                userId: currentUser!.uid,
                userName: userName || 'Unknown',
                timestamp: serverTimestamp()
            };

            await updateDoc(doc(db, 'logbookApprovals', selectedMonth), {
                status: isFinal ? 'approved' : STEP_ROLES[userStep],
                currentStep: nextStep,
                approvals: [...(approvalDoc.approvals || []), newApprovalEntry],
                updatedAt: serverTimestamp()
            });

            alert(isFinal ? '최종 승인이 완료되었으며, 구글 시트로 데이터가 전송되었습니다.' : '승인 처리되었습니다.');
            loadApprovalAndLogs();
        } catch (error) {
            console.error("Approval error:", error);
            alert('승인 중 오류가 발생했습니다.');
        }
    };

    const handleReject = async (reason: string) => {
        if (!approvalDoc) return;
        
        try {
            const currentUser = auth.currentUser;
            const userDoc = await getDoc(doc(db, 'users', currentUser!.uid));
            const userName = userDoc.exists() ? userDoc.data().name || currentUser!.email : currentUser!.email;

            const newApprovalEntry = {
                step: userStep,
                role: STEP_ROLES[userStep],
                userId: currentUser!.uid,
                userName: userName || 'Unknown',
                action: 'reject',
                comments: reason,
                timestamp: serverTimestamp()
            };

            await updateDoc(doc(db, 'logbookApprovals', selectedMonth), {
                status: 'rejected',
                currentStep: 0, // Reset logic or keep it blocked
                rejectionReason: reason,
                approvals: [...(approvalDoc.approvals || []), newApprovalEntry],
                updatedAt: serverTimestamp()
            });

            alert('반려 처리되었습니다.');
            loadApprovalAndLogs();
        } catch (error) {
            console.error("Reject error:", error);
            alert('반려 중 오류가 발생했습니다.');
        }
    };

    const handleResubmit = async () => {
        if (!confirm(`[${selectedMonth}] 반려된 항목을 최신 로그로 재작성하여 상신하시겠습니까?\n(상신 후에는 내용 수정이 어렵습니다.)`)) return;
        
        try {
            const freshLogs = await fetchRawLogsForMonth(selectedMonth);
            const currentUser = auth.currentUser;
            const userDoc = await getDoc(doc(db, 'users', currentUser!.uid));
            const userName = userDoc.exists() ? userDoc.data().name || currentUser!.email : currentUser!.email;

            const activeVehicleIds = Array.from(new Set(freshLogs.map(l => l.vehicleId)));

            const newApprovalEntry = {
                step: 0,
                role: '담당',
                userId: currentUser!.uid,
                userName: userName || 'Unknown',
                action: 'resubmit',
                timestamp: serverTimestamp()
            };

            await updateDoc(doc(db, 'logbookApprovals', selectedMonth), {
                status: '담당',
                currentStep: 1,
                vehicleIds: activeVehicleIds as string[],
                logsData: JSON.stringify(freshLogs),
                rejectionReason: '',
                approvals: [...(approvalDoc?.approvals || []), newApprovalEntry],
                updatedAt: serverTimestamp()
            });

            alert('최신 데이터로 재상신 되었습니다.');
            loadApprovalAndLogs();
        } catch (error) {
            console.error("Resubmit error:", error);
            alert('재상신 중 오류가 발생했습니다.');
        }
    };

    if (userStep === -1) {
        return <div className="p-4 text-center text-red-500 bg-white rounded shadow border">결재 권한이 없습니다. 관리자에게 문의하세요.</div>;
    }

    const isPendingForMe = approvalDoc && approvalDoc.currentStep === userStep && approvalDoc.status !== 'rejected' && approvalDoc.status !== 'approved';
    const isNewForMe = !approvalDoc && userStep === 0;

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow border-t-4 border-blue-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold flex items-center mb-2">
                            <FileText className="mr-2 text-blue-600" /> 월간 지정 차량 일지 결재
                        </h2>
                        <p className="text-sm text-gray-500">각 차량별 운행/주유/정비 일지를 한 번에 승인합니다.</p>
                    </div>
                    <div className="mt-4 md:mt-0 flex gap-2">
                        <input 
                            type="month" 
                            className="p-2 border rounded-lg font-bold text-gray-700"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-10">데이터를 불러오는 중입니다...</div>
                ) : (
                    <>
                        {/* Status Header */}
                        <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between mb-4 border">
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-gray-700">진행 상태:</span>
                                {!approvalDoc ? (
                                    <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded-full text-sm font-bold shadow-sm">미결재 (상신 대기)</span>
                                ) : (
                                    <>
                                        {approvalDoc.status === 'approved' && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-bold shadow-sm flex items-center"><CheckCircle size={14} className="mr-1"/> 최종 승인 완료</span>}
                                        {approvalDoc.status === 'rejected' && <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold shadow-sm flex items-center"><XCircle size={14} className="mr-1"/> 반려됨</span>}
                                        {approvalDoc.status !== 'approved' && approvalDoc.status !== 'rejected' && (
                                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold shadow-sm shadow-sm flex items-center">
                                                결재 진행 중 (현재 대기: {STEP_ROLES[approvalDoc.currentStep]})
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                {isNewForMe && (
                                    <button onClick={handleInitialSubmit} className="bg-blue-600 text-white px-4 py-2 font-bold rounded-lg shadow hover:bg-blue-700">
                                        일지 마감 및 담당 결재
                                    </button>
                                )}
                                {isPendingForMe && (
                                    <>
                                        <button onClick={handleApprove} className="bg-blue-600 text-white px-4 py-2 font-bold rounded-lg shadow hover:bg-blue-700">
                                            [{STEP_ROLES[userStep]}] 승인
                                        </button>
                                        <button onClick={() => setReasonModalOpen(true)} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 font-bold rounded-lg shadow hover:bg-red-100">
                                            반려
                                        </button>
                                    </>
                                )}
                                {approvalDoc && approvalDoc.status === 'rejected' && userStep === 0 && (
                                    <button onClick={handleResubmit} className="bg-orange-500 text-white px-4 py-2 font-bold rounded-lg shadow hover:bg-orange-600 flex items-center">
                                        <RefreshCw size={16} className="mr-1" /> 재상신
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Rejection Alert */}
                        {approvalDoc?.status === 'rejected' && (
                            <div className="bg-red-50 p-4 rounded-lg mb-4 text-red-700 flex items-start border border-red-200">
                                <AlertTriangle size={20} className="mr-2 mt-0.5" />
                                <div>
                                    <div className="font-bold">반려 사유</div>
                                    <div className="text-sm mt-1">{approvalDoc.rejectionReason}</div>
                                </div>
                            </div>
                        )}

                        {/* Approval History */}
                        {approvalDoc && approvalDoc.approvals && approvalDoc.approvals.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-bold text-sm text-gray-500 mb-2">결재 이력</h3>
                                <div className="flex flex-wrap gap-2">
                                    {approvalDoc.approvals.map((arr, i) => (
                                        <div key={i} className={`text-xs px-2 py-1 rounded flex items-center border ${
                                            (arr as any).action === 'reject' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-700'
                                        }`}>
                                            <span className="font-bold mr-1">{arr.role}</span>
                                            <span>{arr.userName}</span>
                                            {(arr as any).action === 'reject' && <span className="ml-1 text-red-500 font-bold">(반려)</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Content Body: Vehicles List */}
                        <div className="space-y-4">
                            {groupedLogs.map(group => {
                                const isExpanded = expandedVehicles[group.vehicle.id];
                                return (
                                    <div key={group.vehicle.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                                        {/* Accordion Summary */}
                                        <div 
                                            className="bg-gray-50 p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition"
                                            onClick={() => toggleVehicleAccordion(group.vehicle.id)}
                                        >
                                            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                                                <h3 className="font-bold text-gray-800">
                                                    {group.vehicle.name} <span className="text-gray-500 text-sm font-normal">({group.vehicle.plateNumber})</span>
                                                </h3>
                                                <div className="text-sm text-gray-600 flex items-center gap-3">
                                                    <span>총 운행: <span className="font-bold text-blue-600">{group.totalDist.toLocaleString()}km</span></span>
                                                    <span>주유: <span className="font-bold text-green-600">{group.totalFuelCost.toLocaleString()}원</span></span>
                                                    <span>정비: <span className="font-bold text-orange-600">{group.totalMaintCost.toLocaleString()}원</span></span>
                                                </div>
                                            </div>
                                            <div>
                                                {isExpanded ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                                            </div>
                                        </div>

                                        {/* Accordion Detail */}
                                        {isExpanded && (
                                            <div className="p-4 bg-white border-t space-y-6">
                                                {/* Driving */}
                                                <div>
                                                    <h4 className="font-bold text-sm text-blue-700 mb-2 border-b pb-1">운행 기록 ({group.driving.length}건)</h4>
                                                    {group.driving.length === 0 ? <div className="text-xs text-gray-400">기록 없음</div> : (
                                                        <table className="w-full text-xs text-left text-gray-600">
                                                            <thead className="bg-gray-50 text-gray-500 rounded">
                                                                <tr>
                                                                    <th className="p-2">날짜</th>
                                                                    <th className="p-2">목적</th>
                                                                    <th className="p-2">주행거리</th>
                                                                    <th className="p-2">사용자</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y">
                                                                {group.driving.map((l: any, i) => (
                                                                    <tr key={i}>
                                                                        <td className="p-2">{l.startDate || l.date}</td>
                                                                        <td className="p-2">{l.purpose} {l.destination ? `(${l.destination})` : ''}</td>
                                                                        <td className="p-2">{l.totalDistance}km</td>
                                                                        <td className="p-2">{l.userName || l.userId}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>

                                                {/* Fueling */}
                                                <div>
                                                    <h4 className="font-bold text-sm text-green-700 mb-2 border-b pb-1">주유 기록 ({group.fueling.length}건)</h4>
                                                    {group.fueling.length === 0 ? <div className="text-xs text-gray-400">기록 없음</div> : (
                                                        <table className="w-full text-xs text-left text-gray-600">
                                                            <thead className="bg-gray-50 text-gray-500 rounded">
                                                                <tr>
                                                                    <th className="p-2">날짜</th>
                                                                    <th className="p-2">주유소</th>
                                                                    <th className="p-2">주유량/단가</th>
                                                                    <th className="p-2">금액</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y">
                                                                {group.fueling.map((l: any, i) => (
                                                                    <tr key={i}>
                                                                        <td className="p-2">{l.startDate || l.date}</td>
                                                                        <td className="p-2">{l.station}</td>
                                                                        <td className="p-2">{l.amount}L / {l.pricePerLiter || l.price || 0}원</td>
                                                                        <td className="p-2">{Number(l.cost).toLocaleString()}원</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>

                                                {/* Maintenance */}
                                                <div>
                                                    <h4 className="font-bold text-sm text-orange-700 mb-2 border-b pb-1">정비 기록 ({group.maint.length}건)</h4>
                                                    {group.maint.length === 0 ? <div className="text-xs text-gray-400">기록 없음</div> : (
                                                        <table className="w-full text-xs text-left text-gray-600">
                                                            <thead className="bg-gray-50 text-gray-500 rounded">
                                                                <tr>
                                                                    <th className="p-2">날짜</th>
                                                                    <th className="p-2">정비소</th>
                                                                    <th className="p-2">항목</th>
                                                                    <th className="p-2">금액</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y">
                                                                {group.maint.map((l: any, i) => (
                                                                    <tr key={i}>
                                                                        <td className="p-2">{l.startDate || l.date}</td>
                                                                        <td className="p-2">{l.shop}</td>
                                                                        <td className="p-2">{l.item}</td>
                                                                        <td className="p-2">{Number(l.cost).toLocaleString()}원</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            <ReasonModal 
                isOpen={reasonModalOpen}
                title="일지 결재 반려"
                message="반려 사유를 입력하세요. 반려 시 상신자(담당)에게 돌아가며 기존 결재 상태가 초기화됩니다."
                onSubmit={(reason) => {
                    handleReject(reason);
                    setReasonModalOpen(false);
                }}
                onClose={() => setReasonModalOpen(false)}
            />
        </div>
    );
};
