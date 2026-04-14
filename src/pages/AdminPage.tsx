import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Car, FileText, Settings, X, Download, Edit2, Trash2, Plus, FileDown, UploadCloud, ArrowUp, ArrowDown } from 'lucide-react';
import { collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import type { Vehicle, SystemSettings, Log, ModificationRequest } from '../types';
import * as XLSX from 'xlsx';
import { TripApprovalTab } from '../components/admin/TripApprovalTab';
import { SettingsTab } from '../components/admin/SettingsTab';
import { UserManagementTab } from '../components/admin/UserManagementTab';
import { VehicleModal } from '../components/admin/VehicleModal';
import { SlackWebhookManual } from '../manuals/SlackWebhookManual';
import { unifiedDeleteLog } from '../utils/logUtils';
import { BusinessTripManual } from '../manuals/BusinessTripManual';
import { AppScriptManual } from '../manuals/AppScriptManual';
import ConfirmModal from '../components/common/ConfirmModal';
import SuccessModal from '../components/common/SuccessModal';
import ReasonModal from '../components/common/ReasonModal';
import { sendSlackNotification, getLogSummary } from '../utils/slackUtils';
import { sendToGoogleSheet } from '../utils/googleSheets';
import { checkAndSendNotificationsUtil, type NotificationResult } from '../utils/notificationUtils';
import { compressImage } from '../utils/imageUtils';

const AdminPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'vehicles' | 'logs' | 'requests' | 'users' | 'settings' | 'trips'>('vehicles');
    const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
    const [manualModal, setManualModal] = useState<'slack' | 'sheet' | 'businessTrip' | null>(null);

    // Vehicle State
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle>>({});

    // Global System Settings
    const [systemSettings, setSystemSettings] = useState<SystemSettings>({
        drivingPurposes: [],
        drivingDestinations: [],
        maintenanceShops: [],
        gasStations: [],
        consumableSettings: [],
        slackWebhook: '',
        sheetConfig: { url: '' }
    });

    // Request State
    const [requests, setRequests] = useState<ModificationRequest[]>([]);

    // Log & Filter State
    const [logs, setLogs] = useState<Log[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<Log[]>([]);
    const [logFilters, setLogFilters] = useState({
        startDate: '',
        endDate: '',
        vehicleId: 'all',
        user: '',
        type: 'all'
    });
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);


    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<any>(null);
    const [processingLogId, setProcessingLogId] = useState<string | null>(null);
    const [isLogSaving, setIsLogSaving] = useState(false);

    // Modal States
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', confirmText: undefined as string | undefined, isDestructive: undefined as boolean | undefined, onConfirm: () => { } });
    const [successModal, setSuccessModal] = useState({ isOpen: false, message: '' });
    const [reasonModal, setReasonModal] = useState<{ isOpen: boolean, title: string, message: string, onSubmit: (reason: string) => void }>({ isOpen: false, title: '', message: '', onSubmit: () => { } });
    const [newImageFile, setNewImageFile] = useState<File | null>(null);

    // Removed old individual states for purposes, destinations, gasStations, etc. as they are now in systemSettings or handled by SettingsTab
    // But we need derived state for compatibility if used elsewhere? 
    // Actually, we should just use systemSettings in the UI.

    // User Role State
    const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'user' | 'approver' | null>(null);

    useEffect(() => {
        const checkUserRole = async () => {
            const user = auth.currentUser;
            if (user) {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setCurrentUserRole(userData.role || 'user');

                    // If approver, default to trips tab
                    if (userData.role === 'approver') {
                        setActiveTab('trips');
                    }
                }
            }
        };
        checkUserRole();
    }, []);

    useEffect(() => {
        fetchSettings();
        fetchUsers();
    }, []);

    // Sync Tab with URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam && ['vehicles', 'logs', 'requests', 'users', 'settings', 'trips'].includes(tabParam)) {
            setActiveTab(tabParam as any);
        }
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('tab') !== activeTab) {
            navigate(`?tab=${activeTab}`, { replace: true });
        }
    }, [activeTab, navigate]);


    // User Data Fetching
    const [users, setUsers] = useState<any[]>([]);
    const fetchUsers = async () => {
        try {
            const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
            const snapshot = await getDocs(q);
            setUsers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() })));
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };



    useEffect(() => {
        // Reset all modals when tab changes
        setIsVehicleModalOpen(false);
        setIsExportModalOpen(false);
        setIsLogModalOpen(false);
        setManualModal(null);
        setEditingVehicle({});
        setEditingVehicle({});
        setEditingLog(null);
        setNewImageFile(null);

        if (activeTab === 'vehicles') fetchVehicles();
        if (activeTab === 'requests') fetchRequests();
        if (activeTab === 'settings') fetchSettings();
        if (activeTab === 'logs') fetchAllLogs();
    }, [activeTab]);

    // Data Fetching
    const fetchVehicles = async () => {
        const q = await getDocs(collection(db, 'vehicles'));
        setVehicles(q.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    };

    const fetchRequests = async () => {
        try {
            // Note: This requires a composite index on Firestore: status (Ascending) + timestamp (Descending)
            // Use the link in the console error to create it.
            const q = query(
                collection(db, 'modificationRequests'),
                where('status', '==', 'pending'),
                orderBy('timestamp', 'desc')
            );
            const snap = await getDocs(q);
            setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })) as ModificationRequest[]);
        } catch (e: any) {
            console.error("Error fetching requests:", e);
            if (e.code === 'failed-precondition') {
                alert("Firestore 색인(Index) 설정이 필요합니다. 개발자 도구의 콘솔(F12)에 있는 링크를 클릭하여 인덱스를 생성해주세요.");
            }
        }
    };



    const fetchSettings = async () => {
        try {
            const docSnap = await getDoc(doc(db, 'settings', 'global'));
            if (docSnap.exists()) {
                const data = docSnap.data() as SystemSettings;
                setSystemSettings(data);

                // Sync with LocalStorage for utility access
                if (data.sheetConfig?.url) {
                    localStorage.setItem('GOOGLE_SHEET_WEBHOOK_URL', data.sheetConfig.url);
                }
            } else {
                setSystemSettings({
                    drivingPurposes: ['출퇴근', '업무용', '기타'],
                    drivingDestinations: [],
                    gasStations: [],
                    consumableSettings: [],
                    maintenanceShops: [],
                    slackWebhook: '',
                    sheetConfig: { url: '' }
                });
            }
        } catch (e) {
            console.error("Error fetching settings:", e);
        }
    };

    const fetchAllLogs = async () => {
        try {
            const [driving, fueling, maintenance] = await Promise.all([
                getDocs(query(collection(db, 'drivingLogs'), orderBy('date', 'desc'))),
                getDocs(query(collection(db, 'fuelingLogs'), orderBy('date', 'desc'))),
                getDocs(query(collection(db, 'maintenanceLogs'), orderBy('date', 'desc')))
            ]);

            const userMap = new Map();
            try {
                const usersSnap = await getDocs(collection(db, 'users'));
                usersSnap.docs.forEach(doc => {
                    const data = doc.data();
                    userMap.set(doc.id, data.name || data.email || 'Unknown');
                });
            } catch (e) {
                console.warn("User fetch failed, continuing without user names:", e);
            }

            const combined = [
                ...driving.docs.map(d => {
                    const data = d.data();
                    return { ...data, id: d.id, type: 'driving', typeKr: '운행', userName: userMap.get(data.userId) || data.userName || data.userId };
                }) as Log[],
                ...fueling.docs.map(d => {
                    const data = d.data();
                    return { ...data, id: d.id, type: 'fueling', typeKr: '주유', userName: userMap.get(data.userId) || data.userName || data.userId };
                }) as Log[],
                ...maintenance.docs.map(d => {
                    const data = d.data();
                    return { ...data, id: d.id, type: 'maintenance', typeKr: '정비', userName: userMap.get(data.userId) || data.userName || data.userId };
                }) as Log[]
            ].sort((a: any, b: any) => new Date(b.startDate || b.date || 0).getTime() - new Date(a.startDate || a.date || 0).getTime());

            setLogs(combined);
            setFilteredLogs(combined);
        } catch (error) {
            console.error("Failed to fetch logs:", error);
            alert("로그 데이터를 불러오는데 실패했습니다.");
        }
    };

    // Filter Effect
    useEffect(() => {
        let res = logs;
        if (logFilters.startDate) res = res.filter(l => (l.startDate || l.date || '') >= logFilters.startDate);
        if (logFilters.endDate) res = res.filter(l => (l.endDate || l.startDate || l.date || '') <= logFilters.endDate);
        if (logFilters.vehicleId !== 'all') res = res.filter(l => l.vehicleId === logFilters.vehicleId);
        if (logFilters.type !== 'all') {
            // Filter by English type stored in DB
            res = res.filter(l => l.type === logFilters.type);
        }
        if (logFilters.user) res = res.filter(l => l.userId.includes(logFilters.user) || l.userName?.includes(logFilters.user));
        if (logFilters.user) res = res.filter(l => l.userId.includes(logFilters.user) || l.userName?.includes(logFilters.user));

        // Sorting
        res.sort((a: any, b: any) => {
            const dateA = new Date(a.startDate || a.date || 0).getTime();
            const dateB = new Date(b.startDate || b.date || 0).getTime();
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });

        setFilteredLogs(res);
    }, [logFilters, logs, sortOrder]);

    // Vehicle Logic


    const handleSaveVehicle = async (vehicleToSave: Partial<Vehicle>, newImageFile: File | null) => {
        try {
            let imageUrl = vehicleToSave.imageUrl;

            // 1. Upload Image (if new file provided)
            if (newImageFile) {
                const storageRef = ref(storage, `vehicles/${Date.now()}_${newImageFile.name}`);
                await uploadBytes(storageRef, newImageFile);
                imageUrl = await getDownloadURL(storageRef);
            }

            // 2. Prepare Data
            const vehicleData = {
                ...vehicleToSave,
                imageUrl,
                initialMileage: Number(vehicleToSave.initialMileage || 0),
                insuranceHistory: vehicleToSave.insuranceHistory || [],
                updatedAt: serverTimestamp(),
            };

            // Remove id from data
            // Remove id from data
            const id = vehicleData.id;

            // 4. Sanitize Data (JSON Stringify removes undefined keys)
            // Note: We normally avoid JSON.stringify for Firestore data to preserve Types/ServerTimestamp
            // But here we need to strip 'undefined'. We will exclude known FieldValues (serverTimestamp) from stringify.

            const { updatedAt, createdAt, ...restData } = vehicleData as any;
            const sanitizedRest = JSON.parse(JSON.stringify(restData));

            const sanitizedData: any = {
                ...sanitizedRest,
                updatedAt: updatedAt || serverTimestamp()
            };
            if (createdAt) sanitizedData.createdAt = createdAt;

            // 5. Save to Firestore
            if (id) {
                await setDoc(doc(db, 'vehicles', id), sanitizedData, { merge: true });
            } else {
                // Create new document with auto-ID
                const newDocRef = doc(collection(db, 'vehicles'));
                await setDoc(newDocRef, { ...sanitizedData, createdAt: serverTimestamp() });
            }

            // 6. Cleanup
            setIsVehicleModalOpen(false);
            setEditingVehicle({});
            fetchVehicles();
            alert("차량 정보가 저장되었습니다.");

        } catch (error: any) {
            console.error("Error saving vehicle:", error);
            alert(`저장 중 오류가 발생했습니다: ${error.message}`);
        }
    };

    // ... (Existing handleDeleteVehicle) ...

    // --- Excel Data Management ---
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [processing, setProcessing] = useState(false);

    // 1. Template Download (3 Sheets)
    const handleTemplateDownload = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: 기본정보
        const h1 = ['차량번호(필수)', '차량명', '소유자', '최초등록일', '차종', '용도', '법인등록번호', '주소', '사용본거지'];
        const s1 = ['12가3456', '그랜저', '법인', '2024-01-01', '승용', '업무용', '123-45-67890', '서울시 강남구', '서울시 서초구'];
        const ws1 = XLSX.utils.aoa_to_sheet([h1, s1]);
        XLSX.utils.book_append_sheet(wb, ws1, "기본정보");

        // Sheet 2: 제원정보
        const h2 = ['차량번호(필수)', '형식', '연식', '차대번호', '원동기', '제원번호', '길이', '너비', '높이', '중량', '배기량', '출력', '승차정원', '최대적재량', '기통수', '연료', '연비', '최초주행거리'];
        const s2 = ['12가3456', 'HG300', '2024', 'KMH...', 'G4...', '123...', '5000', '1800', '1400', '1600', '3000', '200hp', '5', '0', '6', '휘발유', '10.5', '15000'];
        const ws2 = XLSX.utils.aoa_to_sheet([h2, s2]);
        XLSX.utils.book_append_sheet(wb, ws2, "제원정보");

        // Sheet 3: 보험정보
        const h3 = ['차량번호(필수)', '보험사', '증권번호', '시작일', '종료일', '연령한정', '운전자한정', '차량가액', '자차', '긴급출동', '할증'];
        const s3 = ['12가3456', '삼성화재', '123456', '2024-01-01', '2025-01-01', '만26세', '임직원', '3000', '가입', '5', '표준'];
        const ws3 = XLSX.utils.aoa_to_sheet([h3, s3]);
        XLSX.utils.book_append_sheet(wb, ws3, "보험정보");

        XLSX.writeFile(wb, '차량등록_템플릿_v5.xlsx');
    };

    // 2. Upload Data
    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });

            // Parse all sheets
            const basic = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]] || {});
            const specs = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]] || {});
            const insurance = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[2]] || {});

            // Merge Logic by Plate Number
            const merged: any = {};

            // 1. Basic
            basic.forEach((row: any) => {
                const plate = row['차량번호(필수)'];
                if (!plate) return;
                merged[plate] = {
                    name: row['차량명'],
                    plateNumber: plate,
                    ownerName: row['소유자'],
                    initialRegistrationDate: row['최초등록일'],
                    vehicleType: row['차종'],
                    usage: row['용도'],
                    corporateRegNo: row['법인등록번호'],
                    ownerAddress: row['주소'],
                    baseAddress: row['사용본거지']
                };
            });

            // 2. Specs
            specs.forEach((row: any) => {
                const plate = row['차량번호(필수)'];
                if (merged[plate]) {
                    merged[plate] = {
                        ...merged[plate],
                        format: row['형식'],
                        modelYear: row['연식'],
                        vin: row['차대번호'],
                        motorType: row['원동기'],
                        specMgmtNo: row['제원번호'],
                        length: row['길이'],
                        width: row['너비'],
                        height: row['높이'],
                        totalWeight: row['중량'],
                        displacement: row['배기량'],
                        power: row['출력'],
                        capacity: row['승차정원'],
                        maxLoad: row['최대적재량'],
                        cylinders: row['기통수'],
                        fuelType: row['연료'],
                        mpg: row['연비'],
                        initialMileage: row['최초주행거리'] // v5 New
                    };
                }
            });

            // 3. Insurance
            insurance.forEach((row: any) => {
                const plate = row['차량번호(필수)'];
                if (merged[plate]) {
                    merged[plate].insurance = {
                        company: row['보험사'],
                        policyNumber: row['증권번호'],
                        startDate: row['시작일'],
                        expiryDate: row['종료일'],
                        ageLimit: row['연령한정'],
                        driverLimit: row['운전자한정'],
                        vehicleValue: row['차량가액'],
                        ownDamageType: row['자차'],
                        emergencyDispatch: row['긴급출동'],
                        surchargeStandard: row['할증']
                    };
                }
            });

            setPreviewData(Object.values(merged));
        };
        reader.readAsBinaryString(file);
    };

    // 3. Bulk Save
    const handleBulkUpload = async () => {
        if (previewData.length === 0) return;
        if (!window.confirm(`총 ${previewData.length}대의 차량을 등록하시겠습니까?`)) return;

        setProcessing(true);
        try {
            // Delete existing (if requested, but here we just append/overwrite if logic differs)
            // Actually, user might want to KEEP existing if they didn't click "Delete All". 
            // The UI separate buttons imply "Delete All" is separate action.
            // But this specific button mimics previous "Reset & Upload" logic? 
            // The previous logic had "handleResetAndSeed" (delete all) AND "handleBulkUpload" (append).
            // Let's assume append mode for this button.

            let count = 0;
            for (const item of previewData) {
                const docRef = doc(collection(db, 'vehicles'));
                const vehicleData = { ...item, id: docRef.id };
                await setDoc(docRef, vehicleData);
                count++;
            }
            alert(`${count}대 차량 등록 완료!`);
            setPreviewData([]);
            fetchVehicles();
        } catch (e: any) {
            console.error(e);
            alert("일괄 등록 실패: " + e.message);
        } finally {
            setProcessing(false);
        }
    };


    const handleResetAndSeed = async () => {
        if (!window.confirm('경고: 모든 차량 데이터가 삭제됩니다. 계속하시겠습니까?')) return;
        if (!window.confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

        setProcessing(true);
        try {
            // 1. Delete all vehicles
            const q = await getDocs(collection(db, 'vehicles'));
            const deletePromises = q.docs.map(d => deleteDoc(doc(db, 'vehicles', d.id)));
            await Promise.all(deletePromises);

            alert('초기화 완료. 엑셀 파일을 업로드하고 [일괄 등록]을 실행해주세요.');
            fetchVehicles();
        } catch (e) {
            console.error(e);
            alert('초기화 실패');
        } finally {
            setProcessing(false);
        }
    };







    const handleDeleteVehicle = async (id: string) => {
        if (!window.confirm('정말 삭제하시겠습니까? 관련 로그는 유지되지만 차량 접근이 불가능해집니다.')) return;
        await deleteDoc(doc(db, 'vehicles', id));
        fetchVehicles();
    };

    const handleDeleteLog = (log: any) => {
        setConfirmModal({
            isOpen: true,
            title: '로그 삭제',
            message: '정말 이 로그를 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.',
            confirmText: '삭제',
            isDestructive: true,
            onConfirm: () => executeDeleteLog(log)
        });
    };

    const executeDeleteLog = async (log: any) => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        setProcessingLogId(log.id);

        try {
            await unifiedDeleteLog(
                log,
                systemSettings.sheetConfig?.url,
                (msg) => {
                    setSuccessModal({ isOpen: true, message: msg });
                    setProcessingLogId(null);
                    fetchAllLogs();
                },
                (error) => {
                    alert('삭제 실패: ' + error.message);
                    setProcessingLogId(null);
                }
            );
        } catch (e: any) {
            setProcessingLogId(null);
        }
    };

    // Destination Logic


    // Request Logic
    // Request Logic
    const handleApprove = async (req: any) => {
        if (!confirm(`[${req.changeType === 'delete' ? '삭제' : '수정'}] 요청을 승인하시겠습니까?`)) return;
        setProcessingRequestId(req.id);
        await executeApprove(req);
        setProcessingRequestId(null);
    };

    const executeApprove = async (req: any) => {
        try {
            if (req.changeType === 'delete') {
                // Construct a mock 'log' object for unifiedDeleteLog
                const logData = {
                    id: req.targetDocId,
                    type: req.targetCollection === 'drivingLogs' ? 'driving'
                        : req.targetCollection === 'fuelingLogs' ? 'fueling' : 'maintenance',
                    vehicleId: req.originalData?.vehicleId,
                    ...req.originalData
                };

                await unifiedDeleteLog(
                    logData,
                    systemSettings.sheetConfig?.url,
                    async (msg) => {
                        await updateDoc(doc(db, 'modificationRequests', req.id), { status: 'approved', processedAt: serverTimestamp() });
                        setSuccessModal({ isOpen: true, message: '승인 완료: ' + msg });

                        // Slack Notification
                        if (systemSettings.slackWebhook) {
                            sendSlackNotification(
                                systemSettings.slackWebhook,
                                `🗑️ [삭제 완료] ${req.requesterName || '사용자'}님의 삭제 요청이 승인되었습니다.\n\n` +
                                `📋 *삭제된 기록*\n${getLogSummary(req.originalData, req.targetCollection)}`
                            );
                        }

                        fetchRequests();
                    },
                    (err) => alert('삭제 처리 중 오류: ' + err)
                );
            } else {
                await updateDoc(doc(db, 'modificationRequests', req.id), { status: 'approved', processedAt: serverTimestamp() });
                setSuccessModal({ isOpen: true, message: '승인 완료' });
                fetchRequests();
                fetchAllLogs(); // Also refresh logs to show immediate effect
            }
        } catch (e) {
            console.error(e);
            alert('처리 실패: ' + e);
        }
    };

    const handleReject = (id: string) => {
        setReasonModal({
            isOpen: true,
            title: '반려 사유 입력',
            message: '요청을 반려하는 사유를 입력해주세요. 입력 내용은 사용자에게 전달됩니다.',
            onSubmit: (reason) => {
                executeReject(id, reason);
            }
        });
    };

    const executeReject = async (id: string, reason: string) => {
        try {
            await updateDoc(doc(db, 'modificationRequests', id), {
                status: 'rejected',
                rejectReason: reason, // Store the reason
                processedAt: serverTimestamp()
            });
            setSuccessModal({ isOpen: true, message: '반려되었습니다.' });

            // Slack Notification
            const req = requests.find(r => r.id === id);
            if (req && systemSettings.slackWebhook) {
                sendSlackNotification(
                    systemSettings.slackWebhook,
                    `🚫 [반려 알림] ${req.requesterName || '사용자'}님의 요청이 반려되었습니다.\n\n` +
                    `💬 *반려 사유*: ${reason}\n` +
                    `📋 *요청 내역*\n${getLogSummary(req.originalData, req.targetCollection)}`
                );
            }

            fetchRequests();
        } catch (e) {
            console.error(e);
            alert('반려 처리 실패: ' + e);
        }
    };



    // Bulk Sync Logic
    const handleBulkSync = async () => {
        if (!filteredLogs.length) { alert('동기화할 로그가 없습니다.'); return; }
        if (!confirm(`현재 조회된 ${filteredLogs.length}개의 로그를 구글 시트로 전송하시겠습니까?\n(경고: 대량의 데이터 전송 시 시간이 소요될 수 있으며, 중복된 ID는 덮어씌워집니다.)`)) return;

        setProcessing(true);
        let successCount = 0;
        const failCount = 0;

        try {
            for (let i = 0; i < filteredLogs.length; i++) {
                const log: any = filteredLogs[i];
                // Construct Payload (Same as update)
                const sheetPayload = {
                    action: 'write',
                    ...log,
                    id: log.id,
                    logId: log.id,
                    startDate: log.startDate || log.date,
                    endDate: log.endDate || log.date,
                    date: log.startDate || log.date,
                    distance: log.totalDistance,
                    startTime: log.startTime && log.startTime.includes('T') ? new Date(log.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : log.startTime,
                    endTime: log.endTime && log.endTime.includes('T') ? new Date(log.endTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : log.endTime,
                    passengerName: log.passengerName,
                    passengerDetail: log.passengerName,
                    // Ensure fueling/maintenance fields are preserved if they exist in log
                    amount: log.amount,
                    cost: log.cost,
                    item: log.item,
                    shop: log.shop,
                    station: log.station,
                    pricePerLiter: log.pricePerLiter || log.price, // Fallback for legacy
                    paymentMethod: log.paymentMethod || log.fundingSource // Fallback
                };

                await sendToGoogleSheet(sheetPayload, systemSettings.sheetConfig?.url);
                successCount++;

                // Rate Limit Delay (100ms)
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            alert(`동기화 완료!\n성공: ${successCount}건\n실패: ${failCount}건`);
        } catch (error) {
            console.error(error);
            alert('동기화 중 오류 발생');
        } finally {
            setProcessing(false);
        }
    };

    // Export Logic
    const handleExportCSV = () => {
        if (!filteredLogs.length) { alert('내보낼 데이터가 없습니다.'); return; }

        // 1. Headers (22 Columns)
        let csvContent = "\uFEFF"; // BOM for Excel UTF-8
        csvContent += "날짜,구분,차량,사용자명,아이디,목적,출발시간,도착시간,출발누적거리,도착누적거리,주행거리(km),주유량(L),주유단가,장소(주유소/정비소),정비항목,금액,결제수단,동승자,경유지,주유이미지,정비이미지,등록일시\n";

        // 2. Data Mapping
        const rows = filteredLogs.map(log => {
            const vehicleName = vehicles.find(v => v.id === log.vehicleId)?.name || '차량 미상';
            const vehicleStr = `${vehicleName} (${log.vehiclePlate || ''})`;

            // Format Helpers
            const fmtTime = (iso: string) => iso ? new Date(iso).toLocaleTimeString() : '';
            const fmtStopovers = (stops: any[]) => stops ? stops.map(s => s.location).join('|') : '';

            // Fields based on Type
            const isDriving = log.type === 'driving';
            const isFueling = log.type === 'fueling';
            const isMaint = log.type === 'maintenance';

            return [
                log.date,                                               // 1. 날짜
                log.type,                                               // 2. 구분
                `"${vehicleStr}"`,                                      // 3. 차량
                log.userName || '',                                     // 4. 사용자명
                log.userId || '',                                       // 5. 아이디
                isDriving ? `"${log.purpose || ''}"` : '',              // 6. 목적
                isDriving ? fmtTime(log.startTime) : '',                // 7. 출발시간
                isDriving ? fmtTime(log.endTime) : '',                  // 8. 도착시간
                isDriving ? (log.startMileage || 0) : '',               // 9. 출발누적거리
                isDriving ? (log.endMileage || 0) : '',                 // 10. 도착누적거리
                isDriving ? (log.totalDistance || 0) : '',              // 11. 주행거리
                isFueling ? (log.amount || 0) : '',                     // 12. 주유량
                isFueling ? (log.pricePerLiter || 0) : '',              // 13. 주유단가
                `"${log.station || log.shop || ''}"`,                   // 14. 장소
                isMaint ? `"${log.item || ''}"` : '',                   // 15. 정비항목
                log.cost || 0,                                          // 16. 금액
                log.paymentMethod || log.fundingSource || '',           // 17. 결제수단
                isDriving ? `"${log.passengerName || ''}"` : '',        // 18. 동승자
                isDriving ? `"${fmtStopovers(log.stopovers)}"` : '',    // 19. 경유지
                isFueling ? `"${log.imageUrl || ''}"` : '',             // 20. 주유이미지
                isMaint ? `"${log.imageUrl || ''}"` : '',               // 21. 정비이미지
                log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : '' // 22. 등록일시
            ].join(",");
        });

        csvContent += rows.join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `차량운행기록_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExportModalOpen(false);
    };




    const handleUpdateLog = async () => {
        if (!editingLog) return;
        setIsLogSaving(true);
        try {
            // Normalize User Data (Ensure ID is Email, Name is Display Name)
            // This fixes legacy data where ID was UID or Name was Email
            const matchedUser = users.find(u => u.uid === editingLog.userId || u.email === editingLog.userId);
            const finalLogData = {
                ...editingLog,
                userId: matchedUser?.email || editingLog.userId,
                userName: matchedUser?.displayName || editingLog.userName,
            };

            // Image Upload Logic
            if (newImageFile) {
                try {
                    const compressed = await compressImage(newImageFile, 1280, 1280, 0.7);
                    const path = `logs/${finalLogData.vehicleId}/${finalLogData.type}/${Date.now()}_${compressed.name}`;
                    const storageRef = ref(storage, path);
                    await uploadBytes(storageRef, compressed);
                    const downloadURL = await getDownloadURL(storageRef);
                    finalLogData.imageUrl = downloadURL;
                } catch (imgErr) {
                    console.error("Image upload failed:", imgErr);
                    alert("이미지 업로드 실패 (기존 이미지 유지)");
                }
            }

            // Recalculate Passenger Detail from Name (String -> Array)
            if (typeof finalLogData.passengerName === 'string') {
                finalLogData.passengerDetail = finalLogData.passengerName.split(',').map((s: string) => s.trim()).filter(Boolean);
                finalLogData.passengerCount = finalLogData.passengerDetail.length;
            }

            let collectionName = '';
            if (['driving', '운행'].includes(finalLogData.type)) collectionName = 'drivingLogs';
            else if (['fueling', '주유'].includes(finalLogData.type)) collectionName = 'fuelingLogs';
            else if (['maintenance', '정비'].includes(finalLogData.type)) collectionName = 'maintenanceLogs';

            if (!collectionName) {
                alert('알 수 없는 로그 타입입니다: ' + finalLogData.type);
                setIsLogSaving(false);
                return;
            }

            // Normalize type to English before saving
            if (collectionName === 'drivingLogs') finalLogData.type = 'driving';
            else if (collectionName === 'fuelingLogs') finalLogData.type = 'fueling';
            else if (collectionName === 'maintenanceLogs') finalLogData.type = 'maintenance';

            await updateDoc(doc(db, collectionName, finalLogData.id), finalLogData);

            // --- AUTOMATION: Consumable Update on Edit ---
            if (finalLogData.type === 'maintenance' && finalLogData.item) {
                const matchedSetting = systemSettings.consumableSettings.find((s: any) => s.label === finalLogData.item);
                if (matchedSetting) {
                    // Update Vehicle Consumables
                    const vehicleRef = doc(db, 'vehicles', finalLogData.vehicleId);
                    const updateField = `consumables.${finalLogData.item}`;
                    const mileageToUpdate = finalLogData.maintenanceMileage ? Number(finalLogData.maintenanceMileage) : 0;

                    if (mileageToUpdate > 0) {
                        try {
                            await updateDoc(vehicleRef, {
                                [updateField]: {
                                    lastDate: finalLogData.date,
                                    lastMileage: mileageToUpdate
                                }
                            });
                            console.log(`Auto-updated consumable (Admin Edit): ${finalLogData.item}`);
                        } catch (e) {
                            console.error("Failed to auto-update consumable from Admin:", e);
                        }
                    }
                }
            }

            if (finalLogData.requestId) {
                // If this edit was triggered from a Request
                await updateDoc(doc(db, 'modificationRequests', finalLogData.requestId), {
                    status: 'approved',
                    processedAt: serverTimestamp()
                });

                // Notify User via Slack
                const requestDoc = requests.find(r => r.id === finalLogData.requestId);
                if (requestDoc && systemSettings.slackWebhook) {
                    sendSlackNotification(
                        systemSettings.slackWebhook,
                        `✅ [수정 완료] ${requestDoc.requesterName || '사용자'}님의 수정 요청이 처리되었습니다.\n\n` +
                        `📋 *수정된 내용*\n${getLogSummary(finalLogData, requestDoc.targetCollection)}`
                    );
                }
            }

            // Sync to Google Sheet
            try {
                // Format Data for Sheet
                const sheetPayload = {
                    action: 'write',
                    ...finalLogData,
                    id: finalLogData.id,
                    logId: finalLogData.id,
                    startDate: finalLogData.startDate || finalLogData.date,
                    endDate: finalLogData.endDate || finalLogData.date,
                    date: finalLogData.startDate || finalLogData.date, // Legacy
                    distance: finalLogData.totalDistance, // Map totalDistance to distance column
                    startTime: finalLogData.startTime && finalLogData.startTime.includes('T') ? new Date(finalLogData.startTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : finalLogData.startTime,
                    endTime: finalLogData.endTime && finalLogData.endTime.includes('T') ? new Date(finalLogData.endTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : finalLogData.endTime,
                    passengerName: finalLogData.passengerName,
                    passengerDetail: finalLogData.passengerName,
                    amount: finalLogData.amount,
                    cost: finalLogData.cost,
                    item: finalLogData.item,
                    shop: finalLogData.shop,
                    station: finalLogData.station,
                    pricePerLiter: finalLogData.pricePerLiter,
                    paymentMethod: finalLogData.paymentMethod
                };

                await sendToGoogleSheet(sheetPayload, systemSettings.sheetConfig?.url);
            } catch (sheetError) {
                console.error("Google Sheet Sync Error:", sheetError);
                // Non-fatal, continue
            }

            setSuccessModal({ isOpen: true, message: '저장되었습니다.' });
            setIsLogModalOpen(false);
            setEditingLog(null);
            setNewImageFile(null);
            fetchAllLogs();
            fetchRequests(); // Refresh requests to show status change
        } catch (e) {
            console.error(e);
            alert('수정 실패');
        } finally {
            setIsLogSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 pb-20 md:pb-0">
            {/* Header */}
            <header className="bg-white shadow sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center">
                        <button onClick={() => navigate('/')} className="mr-4 p-2 rounded-full hover:bg-gray-100">
                            <ArrowLeft className="text-gray-600" />
                        </button>
                        <h1 className="font-bold text-xl text-gray-800">관리자 페이지</h1>
                    </div>
                </div>

                {/* Tabs */}
                {/* Tabs */}
                <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto">
                    {['admin', 'approver'].includes(currentUserRole || '') && (
                        <>
                            <button onClick={() => setActiveTab('vehicles')} className={`px-4 py-3 font-bold text-sm whitespace-nowrap ${activeTab === 'vehicles' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>차량 관리</button>
                            <button onClick={() => setActiveTab('logs')} className={`px-4 py-3 font-bold text-sm whitespace-nowrap ${activeTab === 'logs' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>로그 관리</button>
                            <button onClick={() => setActiveTab('requests')} className={`px-4 py-3 font-bold text-sm whitespace-nowrap ${activeTab === 'requests' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
                                수정/삭제 요청
                                {requests.length > 0 && <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{requests.length}</span>}
                            </button>
                        </>
                    )}

                    {/* Trips is visible ONLY to Approver */}
                    {currentUserRole === 'approver' && (
                        <button onClick={() => setActiveTab('trips')} className={`px-4 py-3 font-bold text-sm whitespace-nowrap ${activeTab === 'trips' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>관내출장 결재</button>
                    )}

                    {['admin', 'approver'].includes(currentUserRole || '') && (
                        <>
                            <button onClick={() => setActiveTab('users')} className={`px-4 py-3 font-bold text-sm whitespace-nowrap ${activeTab === 'users' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>사용자 관리</button>
                            <button onClick={() => setActiveTab('settings')} className={`px-4 py-3 font-bold text-sm whitespace-nowrap ${activeTab === 'settings' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>시스템 설정</button>
                        </>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4">
                {/* VEHICLES TAB */}
                {activeTab === 'vehicles' && (
                    <div>
                        <button onClick={() => { setEditingVehicle({}); setIsVehicleModalOpen(true); }} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold mb-4 shadow flex justify-center items-center">
                            <Plus size={20} className="mr-2" /> 신규 차량 등록
                        </button>
                        <div className="space-y-3">
                            {vehicles.map(v => (
                                <div key={v.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center hover:bg-gray-50 transition">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden flex-shrink-0 border flex items-center justify-center">
                                            {v.imageUrl ? <img src={v.imageUrl} alt={v.name} className="w-full h-full object-cover" /> : <Car className="text-gray-400" />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-lg flex items-center">
                                                {v.name}
                                                {(() => {
                                                    let status = 'normal';
                                                    systemSettings.consumableSettings.forEach(setting => {
                                                        const consumable = v.consumables?.[setting.label];
                                                        if (consumable) {
                                                            if (setting.distance > 0 && consumable.lastMileage !== undefined) {
                                                                const distDiff = v.lastMileage - consumable.lastMileage;
                                                                if (distDiff >= setting.distance) status = 'danger';
                                                                else if (distDiff >= setting.distance * 0.9) status = status === 'normal' ? 'warning' : status;
                                                            }
                                                            if (setting.months > 0 && consumable.lastDate) {
                                                                const lastDate = new Date(consumable.lastDate);
                                                                const monthsDiff = (new Date().getFullYear() - lastDate.getFullYear()) * 12 + (new Date().getMonth() - lastDate.getMonth());
                                                                if (monthsDiff >= setting.months) status = 'danger';
                                                                else if (monthsDiff >= setting.months * 0.9) status = status === 'normal' ? 'warning' : status;
                                                            }
                                                        } else {
                                                            // No record
                                                        }
                                                    });
                                                    if (status === 'danger') return <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">⚠️ 정비필요</span>;
                                                    if (status === 'warning') return <span className="ml-2 text-xs bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full">⚡ 점검요망</span>;
                                                    return null;
                                                })()}
                                            </div>
                                            <div className="text-gray-500 font-mono">{v.plateNumber}</div>
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">
                                        <button onClick={() => { setEditingVehicle(v); setIsVehicleModalOpen(true); }} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                                            <Edit2 size={16} className="text-gray-600" />
                                        </button>
                                        <button onClick={() => handleDeleteVehicle(v.id)} className="p-2 bg-red-50 rounded-full hover:bg-red-100">
                                            <Trash2 size={16} className="text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* LOGS TAB WITH FILTERS */}
                {activeTab === 'logs' && (
                    <div className="bg-white rounded-xl shadow p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold flex items-center"><FileText className="mr-2" size={20} /> 로그 관리</h2>
                            <div className="flex space-x-2">
                                <button onClick={handleBulkSync} disabled={processing} className={`flex items-center bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-bold shadow hover:bg-green-700 ${processing ? 'opacity-50 cursor-wait' : ''}`}>
                                    <UploadCloud size={16} className="mr-1" />
                                    {processing ? '동기화 중...' : '구글 시트 동기화'}
                                </button>
                                <button onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')} className="flex items-center bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold shadow hover:bg-gray-200 border">
                                    {sortOrder === 'desc' ? <ArrowDown size={16} className="mr-1" /> : <ArrowUp size={16} className="mr-1" />}
                                    {sortOrder === 'desc' ? '최신순' : '과거순'}
                                </button>
                                <button onClick={() => setIsExportModalOpen(true)} className="flex items-center bg-gray-600 text-white px-3 py-2 rounded-lg text-sm font-bold shadow hover:bg-gray-700">
                                    <Download size={16} className="mr-1" /> 엑셀 내보내기
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="bg-gray-50 p-4 rounded-lg mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                            <input type="date" className="p-2 border rounded" value={logFilters.startDate} onChange={e => setLogFilters({ ...logFilters, startDate: e.target.value })} />
                            <input type="date" className="p-2 border rounded" value={logFilters.endDate} onChange={e => setLogFilters({ ...logFilters, endDate: e.target.value })} />
                            <select className="p-2 border rounded" value={logFilters.vehicleId} onChange={e => setLogFilters({ ...logFilters, vehicleId: e.target.value })}>
                                <option value="all">전체 차량</option>
                                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                            <select className="p-2 border rounded" value={logFilters.type} onChange={e => setLogFilters({ ...logFilters, type: e.target.value })}>
                                <option value="all">전체 기록</option>
                                <option value="driving">운행 기록</option>
                                <option value="fueling">주유 기록</option>
                                <option value="maintenance">정비 기록</option>
                            </select>
                            <input type="text" placeholder="사용자 검색" className="p-2 border rounded" value={logFilters.user} onChange={e => setLogFilters({ ...logFilters, user: e.target.value })} />
                        </div>

                        {/* Logs List Preview */}
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {filteredLogs.slice(0, 100).map((log, idx) => {
                                const vehicle = vehicles.find(v => v.id === log.vehicleId);
                                const vehicleDisplay = log.vehicleName ? `${log.vehicleName} (${log.vehiclePlate || ''})` : (vehicle ? `${vehicle.name} (${vehicle.plateNumber})` : '차량 미상');
                                const userDisplay = log.userName ? `${log.userName} (${log.userId})` : log.userId;

                                return (
                                    <div key={log.id || idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative mb-3">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${log.type === 'driving' ? 'bg-blue-100 text-blue-700' :
                                                    log.type === 'fueling' ? 'bg-green-100 text-green-700' :
                                                        'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    {log.typeKr}
                                                </span>
                                                <span className="text-gray-400 text-xs">
                                                    {(log.startDate && log.endDate && log.startDate !== log.endDate)
                                                        ? `${log.startDate} ~ ${log.endDate}`
                                                        : (log.startDate || log.date)}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 font-medium text-right">
                                                <div>{userDisplay}</div>
                                                <div className="text-gray-400 text-[10px]">{vehicleDisplay}</div>
                                            </div>
                                        </div>

                                        {/* Log Details */}
                                        {log.type === 'driving' && (
                                            <div className="mt-2 space-y-3">
                                                <div className="flex items-start gap-2">
                                                    <span className="text-lg">🕒</span>
                                                    <div className="text-xs text-gray-600">
                                                        <div className="font-bold mb-1">운행시간</div>
                                                        <div>{log.startTime ? new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'} ~ {log.endTime ? new Date(log.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <span className="text-lg">🚗</span>
                                                    <div className="text-xs text-gray-600">
                                                        <div className="font-bold mb-1">운행거리 ({log.totalDistance}km)</div>
                                                        <div>{log.startMileage?.toLocaleString()}km ~ {log.endMileage?.toLocaleString()}km</div>
                                                    </div>
                                                </div>
                                                <div className="pl-8 text-xs text-gray-600 space-y-1">
                                                    <div><span className="font-bold">목적:</span> {log.purpose} {log.detailPurpose ? `(${log.detailPurpose})` : ''}</div>
                                                    <div>
                                                        <span className="font-bold">목적지:</span> {log.destination}
                                                        {log.stopovers && log.stopovers.length > 0 && <span className="text-gray-500"> / 경유({log.stopovers.length})</span>}
                                                    </div>
                                                    {(log.passengerCount > 0 || log.passengerName) && (
                                                        <div><span className="font-bold">동승자:</span> {log.passengerName || '-'} ({log.passengerCount}명)</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {log.type === 'fueling' && (
                                            <div className="mt-2 space-y-3">
                                                <div className="flex items-start gap-2">
                                                    <span className="text-lg">⛽</span>
                                                    <div className="text-xs text-gray-600 space-y-1">
                                                        <div><span className="font-bold">주유량 :</span> {log.amount}L</div>
                                                        <div><span className="font-bold">금액 :</span> {Number(log.cost).toLocaleString()}원 {log.pricePerLiter ? `(${Number(log.pricePerLiter).toLocaleString()}원/L)` : (log.price ? `(${Number(log.price).toLocaleString()}원/L)` : '')}</div>
                                                        <div><span className="font-bold">주유소 :</span> {log.station}</div>
                                                        <div><span className="font-bold">결제 :</span> {log.paymentMethod || log.fundingSource || '-'}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {log.type === 'maintenance' && (
                                            <div className="mt-2 space-y-3">
                                                <div className="flex items-start gap-2">
                                                    <span className="text-lg">🔧</span>
                                                    <div className="text-xs text-gray-600 space-y-1">
                                                        <div><span className="font-bold">정비항목 :</span> {log.item}</div>
                                                        <div><span className="font-bold">금액 :</span> {Number(log.cost).toLocaleString()}원</div>
                                                        <div><span className="font-bold">정비소 :</span> {log.shop}</div>
                                                        <div><span className="font-bold">결제 :</span> {log.paymentMethod || log.fundingSource || '-'}</div>
                                                        {log.endDate && log.endDate !== log.date && (
                                                            <div><span className="font-bold">기간 :</span> {log.date} ~ {log.endDate}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex justify-end mt-4 space-x-2">
                                            <button onClick={() => { setEditingLog({ ...log }); setNewImageFile(null); setIsLogModalOpen(true); }} className="p-1.5 bg-gray-100 rounded hover:bg-gray-200">
                                                <Edit2 size={14} className="text-gray-600" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteLog(log)}
                                                disabled={processingLogId === log.id}
                                                className={`p-1.5 rounded ${processingLogId === log.id ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                                            >
                                                {processingLogId === log.id ? <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full font-bold"></div> : <Trash2 size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredLogs.length === 0 && <div className="text-center py-10 text-gray-400">데이터가 없습니다.</div>}
                        </div>
                    </div>
                )}

                {/* USER MANAGEMENT TAB */}
                {activeTab === 'users' && (
                    <UserManagementTab />
                )}

                {/* SETTINGS TAB */}
                {activeTab === 'settings' && (
                    <div className="space-y-6">
                        <SettingsTab
                            settings={systemSettings}
                            onUpdate={fetchSettings}
                            onOpenSlackManual={() => setManualModal('slack')}
                            onOpenSheetManual={() => setManualModal('sheet')}
                            onOpenBusinessTripManual={() => setManualModal('businessTrip')}
                            onCheckConsumables={async () => {
                                const confirmRun = confirm("알림 체크를 강제로 실행하시겠습니까?\n(오늘 이미 실행했더라도 다시 체크하여 발송합니다)");
                                if (!confirmRun) return;

                                const result: NotificationResult = await checkAndSendNotificationsUtil(systemSettings, true);
                                if (result && result.sent) {
                                    alert(`알림이 성공적으로 발송되었습니다. (총 ${result.count}건)`);
                                } else {
                                    alert(`알림이 발송되지 않았습니다.\n사유: ${result?.reason || 'Unknown reason'}`);
                                }
                            }}
                        />

                        {/* DATA MANAGEMENT */}
                        <div className="bg-white rounded-xl shadow p-6 border-t-4 border-red-500">
                            <h2 className="text-lg font-bold text-red-600 mb-4 flex items-center"><Settings className="mr-2" size={20} /> 데이터 초기화 및 일괄 등록</h2>
                            <p className="text-sm text-gray-600 mb-4">
                                기존 차량 데이터를 모두 삭제하고, 엑셀 파일(.xlsx)을 업로드하여 새로 등록합니다.<br />
                                (운행 기록 로그는 유지됩니다)
                            </p>

                            <div className="mb-4 space-y-4">
                                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border">
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-700">1. 양식 다운로드</h4>
                                        <p className="text-xs text-gray-500">엑셀 양식을 다운로드하여 내용을 작성하세요.</p>
                                    </div>
                                    <button
                                        onClick={handleTemplateDownload}
                                        className="flex items-center px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-bold"
                                    >
                                        <Download size={16} className="mr-2" />
                                        양식 받기
                                    </button>
                                </div>

                                <div className="bg-gray-50 p-4 rounded-lg border">
                                    <h4 className="font-bold text-sm text-gray-700 mb-2">2. 파일 업로드</h4>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={handleExcelUpload}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                    </div>
                                </div>
                            </div>

                            {previewData.length > 0 && (
                                <div className="mb-4 border rounded-lg overflow-hidden">
                                    <div className="bg-gray-100 px-4 py-2 border-b flex justify-between items-center">
                                        <h4 className="font-bold text-sm text-gray-700">미리보기 ({previewData.length}건)</h4>
                                        <span className="text-xs text-gray-500">상위 5건만 표시됩니다.</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-xs text-left">
                                            <thead className="bg-white border-b">
                                                <tr>
                                                    <th className="px-4 py-2">차량명</th>
                                                    <th className="px-4 py-2">번호</th>
                                                    <th className="px-4 py-2">소유자</th>
                                                    <th className="px-4 py-2">연식</th>
                                                    <th className="px-4 py-2">유종</th>
                                                    <th className="px-4 py-2">보험사</th>
                                                    <th className="px-4 py-2">만료일</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y">
                                                {previewData.slice(0, 5).map((row: any, i) => (
                                                    <tr key={i}>
                                                        <td className="px-4 py-2">{row.name}</td>
                                                        <td className="px-4 py-2">{row.plateNumber}</td>
                                                        <td className="px-4 py-2">{row.ownerName}</td>
                                                        <td className="px-4 py-2">{row.modelYear}</td>
                                                        <td className="px-4 py-2">{row.fuelType}</td>
                                                        <td className="px-4 py-2">{row.insurance?.company}</td>
                                                        <td className="px-4 py-2">{row.insurance?.expiryDate}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="flex space-x-2 pt-4 border-t">
                                <button
                                    onClick={handleResetAndSeed}
                                    disabled={processing}
                                    className="px-4 py-2 bg-red-100 text-red-600 font-bold rounded-lg hover:bg-red-200 text-sm"
                                >
                                    ⚠️ 기존 데이터 전체 삭제
                                </button>
                                <button
                                    onClick={handleTemplateDownload}
                                    className="px-4 py-2 bg-green-100 text-green-700 font-bold rounded-lg hover:bg-green-200 text-sm flex items-center"
                                >
                                    <FileDown size={16} className="mr-1" />
                                    양식 다운로드
                                </button>
                                <button
                                    onClick={handleBulkUpload}
                                    disabled={processing || previewData.length === 0}
                                    className={`flex-1 px-4 py-2 font-bold rounded-lg text-sm ${processing || previewData.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
                                >
                                    {processing ? '처리 중...' : `검증된 데이터 ${previewData.length}건 일괄 등록`}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* REQUESTS TAB */}
                {activeTab === 'requests' && (
                    <div className="space-y-4">
                        {requests.map(req => (
                            <div key={req.id} className={`bg-white p-5 rounded-lg shadow border-l-4 ${req.changeType === 'delete' ? 'border-red-400' : 'border-blue-400'}`}>
                                <div className="flex justify-between mb-2">
                                    <span className={`font-bold text-sm ${req.changeType === 'delete' ? 'text-red-600' : 'text-blue-600'}`}>
                                        {req.changeType === 'delete' ? '삭제 요청' : '수정 요청'}
                                    </span>
                                    <span className="text-gray-400 text-xs">{req.requesterName ? `${req.requesterName} (${req.requester})` : req.requester}</span>
                                </div>
                                <div className="mb-3">
                                    <p className="font-bold text-gray-800">{req.reason}</p>
                                    <div className="text-xs text-gray-500 mt-1 bg-gray-50 p-2 rounded">
                                        대상: {req.targetCollection === 'drivingLogs' ? '운행일지' : req.targetCollection === 'fuelingLogs' ? '주유일지' : '정비일지'}
                                        {req.originalData?.date && ` (${req.originalData.date})`}
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    {/* Approve Button - Only for 'delete' */}
                                    {req.changeType === 'delete' && (
                                        <button
                                            onClick={() => handleApprove(req)}
                                            disabled={!!processingRequestId}
                                            className={`flex-1 py-2 text-white rounded font-bold text-sm ${processingRequestId === req.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                                        >
                                            {processingRequestId === req.id ? '처리 중...' : '승인 (삭제)'}
                                        </button>
                                    )}

                                    {/* Direct Edit Button - Always Visible */}
                                    <button
                                        onClick={() => {
                                            const typeMap: Record<string, string> = { 'drivingLogs': '운행', 'fuelingLogs': '주유', 'maintenanceLogs': '정비' };
                                            const derivedType = typeMap[req.targetCollection] || '운행';
                                            // Pass requestId to tracking
                                            setEditingLog({ ...req.originalData, id: req.targetDocId, type: derivedType, requestId: req.id });
                                            setIsLogModalOpen(true);
                                        }}
                                        className="px-3 py-2 bg-green-100 text-green-700 rounded font-bold text-sm hover:bg-green-200 flex items-center"
                                    >
                                        <Edit2 size={16} className="mr-1" /> 수정하기
                                    </button>

                                    <button
                                        onClick={() => req.id && handleReject(req.id)}
                                        className="flex-1 py-2 bg-gray-200 text-gray-700 rounded font-bold text-sm hover:bg-gray-300"
                                    >
                                        반려
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}


                {/* TRIPS TAB */}
                {
                    activeTab === 'trips' && (
                        <TripApprovalTab settings={systemSettings} />
                    )
                }
            </main>

            {/* MANUAL MODALS */}
            {manualModal === 'slack' && <SlackWebhookManual onClose={() => setManualModal(null)} />}
            {manualModal === 'sheet' && <AppScriptManual onClose={() => setManualModal(null)} />}
            {manualModal === 'businessTrip' && <BusinessTripManual onClose={() => setManualModal(null)} />}


            {/* VEHICLE MODAL */}
            {/* VEHICLE MODAL */}
            <VehicleModal
                isOpen={isVehicleModalOpen}
                onClose={() => setIsVehicleModalOpen(false)}
                vehicle={editingVehicle}
                onSave={handleSaveVehicle}
                consumableSettings={systemSettings.consumableSettings}
            />
            {/* EXPORT MODAL */}
            {
                isExportModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl p-6 w-full max-w-sm text-center">
                            <FileText size={48} className="mx-auto text-green-600 mb-4" />
                            <h3 className="text-xl font-bold mb-2">필터링된 로그 내보내기</h3>
                            <p className="text-gray-500 text-sm mb-6">현재 화면에 적용된 필터 조건으로<br />CSV 파일을 생성합니다.</p>
                            <div className="flex space-x-2">
                                <button onClick={handleExportCSV} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold">다운로드</button>
                                <button onClick={() => setIsExportModalOpen(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-bold">취소</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* LOG EDIT MODAL */}
            {
                isLogModalOpen && editingLog && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">로그 수정 ({editingLog.type})</h3>
                                <button onClick={() => { setIsLogModalOpen(false); setEditingLog(null); }}><X /></button>
                            </div>
                            <div className="space-y-4">
                                {/* User Selection */}
                                <div>
                                    <label className="block text-sm text-gray-500">사용자</label>
                                    <select
                                        className="w-full p-2 border rounded"
                                        value={users.find(u => u.email === editingLog.userId)?.uid || editingLog.userId}
                                        onChange={e => {
                                            const selectedUser = users.find(u => u.uid === e.target.value);
                                            if (selectedUser) {
                                                setEditingLog({
                                                    ...editingLog,
                                                    userId: selectedUser.email, // Store Email as ID
                                                    userName: selectedUser.displayName || selectedUser.email.split('@')[0], // Store Name Only
                                                    // Start/End Time Validation (if needed) is handled on render
                                                });
                                            }
                                        }}
                                    >
                                        <option value="">사용자 선택</option>
                                        {users.map(u => (
                                            <option key={u.uid} value={u.uid}>
                                                {u.displayName} ({u.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex space-x-2">
                                    <div className="flex-1">
                                        <label className="block text-sm text-gray-500">시작일</label>
                                        <input
                                            type="date"
                                            className="w-full p-2 border rounded"
                                            value={editingLog.startDate || editingLog.date}
                                            onChange={e => {
                                                const newStart = e.target.value;
                                                setEditingLog({
                                                    ...editingLog,
                                                    startDate: newStart,
                                                    // Auto-sync end date if start > end, or if it was same
                                                    endDate: (!editingLog.endDate || editingLog.endDate < newStart) ? newStart : editingLog.endDate,
                                                    date: newStart // Legacy sync
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm text-gray-500">종료일</label>
                                        <input
                                            type="date"
                                            className="w-full p-2 border rounded"
                                            value={editingLog.endDate || editingLog.date}
                                            onChange={e => setEditingLog({ ...editingLog, endDate: e.target.value })}
                                            min={editingLog.startDate || editingLog.date}
                                        />
                                    </div>
                                </div>

                                {['운행', 'driving'].includes(editingLog.type) && (
                                    <>
                                        {/* Time Editing */}
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div>
                                                <label className="block text-sm text-gray-500">출발시간</label>
                                                <input
                                                    type="time"
                                                    className="w-full p-2 border rounded"
                                                    value={(() => {
                                                        if (!editingLog.startTime) return '';
                                                        try {
                                                            // If ISO string, convert to HH:mm
                                                            if (editingLog.startTime.includes('T')) {
                                                                const d = new Date(editingLog.startTime);
                                                                return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                                                            }
                                                            return editingLog.startTime; // Fallback if already HH:mm
                                                        } catch (e) { return ''; }
                                                    })()}
                                                    onChange={e => {
                                                        // Construct ISO string to maintain consistency
                                                        const timeVal = e.target.value;
                                                        if (timeVal && editingLog.date) {
                                                            const dateTime = new Date(`${editingLog.date}T${timeVal}:00`);
                                                            setEditingLog({ ...editingLog, startTime: dateTime.toISOString() });
                                                        } else {
                                                            setEditingLog({ ...editingLog, startTime: timeVal });
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-gray-500">도착시간</label>
                                                <input
                                                    type="time"
                                                    className="w-full p-2 border rounded"
                                                    value={(() => {
                                                        if (!editingLog.endTime) return '';
                                                        try {
                                                            if (editingLog.endTime.includes('T')) {
                                                                const d = new Date(editingLog.endTime);
                                                                return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
                                                            }
                                                            return editingLog.endTime;
                                                        } catch (e) { return ''; }
                                                    })()}
                                                    onChange={e => {
                                                        const timeVal = e.target.value;
                                                        if (timeVal && editingLog.date) {
                                                            const dateTime = new Date(`${editingLog.date}T${timeVal}:00`);
                                                            setEditingLog({ ...editingLog, endTime: dateTime.toISOString() });
                                                        } else {
                                                            setEditingLog({ ...editingLog, endTime: timeVal });
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="block text-sm text-gray-500">출발거리</label><input type="number" className="w-full p-2 border rounded" value={editingLog.startMileage} onChange={e => setEditingLog({ ...editingLog, startMileage: Number(e.target.value), totalDistance: (editingLog.endMileage || 0) - Number(e.target.value) })} /></div>
                                            <div><label className="block text-sm text-gray-500">도착거리</label><input type="number" className="w-full p-2 border rounded" value={editingLog.endMileage} onChange={e => setEditingLog({ ...editingLog, endMileage: Number(e.target.value), totalDistance: Number(e.target.value) - (editingLog.startMileage || 0) })} /></div>
                                        </div>
                                        <div><label className="block text-sm text-gray-500">주행거리</label><input type="number" className="w-full p-2 border rounded bg-gray-100" value={editingLog.totalDistance} readOnly /></div>
                                        <div><label className="block text-sm text-gray-500">운행목적</label><input className="w-full p-2 border rounded" value={editingLog.purpose} onChange={e => setEditingLog({ ...editingLog, purpose: e.target.value })} /></div>
                                        <div><label className="block text-sm text-gray-500">상세내용</label><input className="w-full p-2 border rounded" value={editingLog.detailPurpose || ''} onChange={e => setEditingLog({ ...editingLog, detailPurpose: e.target.value })} /></div>
                                        <div><label className="block text-sm text-gray-500">목적지</label><input className="w-full p-2 border rounded" value={editingLog.destination || ''} onChange={e => setEditingLog({ ...editingLog, destination: e.target.value })} /></div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="block text-sm text-gray-500">동승자 수</label><input type="number" className="w-full p-2 border rounded" value={editingLog.passengerCount || 0} onChange={e => setEditingLog({ ...editingLog, passengerCount: Number(e.target.value) })} /></div>
                                            <div><label className="block text-sm text-gray-500">동승자 명단</label><input className="w-full p-2 border rounded" value={editingLog.passengerName || ''} onChange={e => setEditingLog({ ...editingLog, passengerName: e.target.value })} /></div>
                                        </div>
                                    </>
                                )}

                                {['주유', 'fueling'].includes(editingLog.type) && (
                                    <>
                                        <div><label className="block text-sm text-gray-500">주유소</label><input className="w-full p-2 border rounded" value={editingLog.station} onChange={e => setEditingLog({ ...editingLog, station: e.target.value })} /></div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="block text-sm text-gray-500">주유량(L)</label><input type="number" className="w-full p-2 border rounded" value={editingLog.amount} onChange={e => setEditingLog({ ...editingLog, amount: Number(e.target.value) })} /></div>
                                            <div><label className="block text-sm text-gray-500">금액</label><input type="number" className="w-full p-2 border rounded" value={editingLog.cost} onChange={e => setEditingLog({ ...editingLog, cost: Number(e.target.value) })} /></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="block text-sm text-gray-500">단가(원/L)</label><input type="number" className="w-full p-2 border rounded" value={editingLog.pricePerLiter || 0} onChange={e => setEditingLog({ ...editingLog, pricePerLiter: Number(e.target.value) })} /></div>
                                            <div><label className="block text-sm text-gray-500">결제수단</label><input className="w-full p-2 border rounded" value={editingLog.paymentMethod || ''} onChange={e => setEditingLog({ ...editingLog, paymentMethod: e.target.value })} /></div>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-500">영수증/이미지 변경</label>
                                            <input type="file" accept="image/*" className="w-full p-2 border rounded" onChange={e => setNewImageFile(e.target.files?.[0] || null)} />
                                            {editingLog.imageUrl && !newImageFile && <p className="text-xs text-green-600 mt-1">현재 이미지 등록됨 (변경하려면 파일 선택)</p>}
                                        </div>
                                    </>
                                )}

                                {['정비', 'maintenance'].includes(editingLog.type) && (
                                    <>
                                        <div><label className="block text-sm text-gray-500">정비항목</label><input className="w-full p-2 border rounded" value={editingLog.item} onChange={e => setEditingLog({ ...editingLog, item: e.target.value })} /></div>
                                        <div><label className="block text-sm text-gray-500">정비소</label><input className="w-full p-2 border rounded" value={editingLog.shop || ''} onChange={e => setEditingLog({ ...editingLog, shop: e.target.value })} /></div>
                                        <div><label className="block text-sm text-gray-500">비용</label><input type="number" className="w-full p-2 border rounded" value={editingLog.cost} onChange={e => setEditingLog({ ...editingLog, cost: Number(e.target.value) })} /></div>
                                        <div><label className="block text-sm text-gray-500">정비시 주행거리 (km)</label><input type="number" className="w-full p-2 border rounded" value={editingLog.maintenanceMileage || ''} onChange={e => setEditingLog({ ...editingLog, maintenanceMileage: Number(e.target.value) })} placeholder="입력 시 소모품 갱신됨" /></div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label className="block text-sm text-gray-500">종료일</label><input type="date" className="w-full p-2 border rounded" value={editingLog.endDate || ''} onChange={e => setEditingLog({ ...editingLog, endDate: e.target.value })} /></div>
                                            <div><label className="block text-sm text-gray-500">결제수단</label><input className="w-full p-2 border rounded" value={editingLog.paymentMethod || ''} onChange={e => setEditingLog({ ...editingLog, paymentMethod: e.target.value })} /></div>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-500">영수증/이미지 변경</label>
                                            <input type="file" accept="image/*" className="w-full p-2 border rounded" onChange={e => setNewImageFile(e.target.files?.[0] || null)} />
                                            {editingLog.imageUrl && !newImageFile && <p className="text-xs text-green-600 mt-1">현재 이미지 등록됨 (변경하려면 파일 선택)</p>}
                                        </div>
                                    </>
                                )}

                                <button
                                    onClick={handleUpdateLog}
                                    disabled={isLogSaving}
                                    className={`w-full py-3 text-white font-bold rounded-lg mt-4 ${isLogSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                >
                                    {isLogSaving ? '저장 중...' : '수정 저장'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }



            {/* CONFIRM MODAL */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDestructive={confirmModal.isDestructive}
                onConfirm={confirmModal.onConfirm}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />

            {/* REASON MODAL (For Rejection) */}
            <ReasonModal
                isOpen={reasonModal.isOpen}
                title={reasonModal.title}
                message={reasonModal.message}
                onSubmit={reasonModal.onSubmit}
                onClose={() => setReasonModal(prev => ({ ...prev, isOpen: false }))}
            />

            {/* SUCCESS MODAL */}
            <SuccessModal
                isOpen={successModal.isOpen}
                message={successModal.message}
                onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
            />
        </div>
    );
};

export default AdminPage;
