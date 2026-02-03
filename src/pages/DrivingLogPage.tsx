import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs, orderBy, limit, serverTimestamp, doc, updateDoc, deleteDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Plus, Minus, Camera, X, FileText } from 'lucide-react';
import { sendToGoogleSheet } from '../utils/googleSheets';
import { sendSlackNotification, getLogSummary } from '../utils/slackUtils';
import { compressImage } from '../utils/imageUtils';
import AlertModal from '../components/common/AlertModal';
import SuccessModal from '../components/common/SuccessModal';
import ReasonModal from '../components/common/ReasonModal';
import MyRequestsModal from '../components/common/MyRequestsModal';
import { getTodayString, combineDateAndTime } from '../utils/dateUtils';

const InfoItem = ({ label, value }: { label: string, value?: string | number }) => (
    <div className="flex justify-between border-b border-gray-100 pb-1 last:border-0 last:pb-0">
        <span className="text-gray-500 text-xs">{label}</span>
        <span className="font-bold text-gray-800 text-sm text-right break-words max-w-[60%]">{value || '-'}</span>
    </div>
);

const uploadImage = async (file: File, path: string) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
};

const DrivingLogPage: React.FC = () => {
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { vehicleId } = useParams();

    // State
    const [vehicle, setVehicle] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState('log');
    const [reapplyId, setReapplyId] = useState<string | null>(null);

    // Driving Log State
    const [startDate, setStartDate] = useState(getTodayString());
    const [endDate, setEndDate] = useState(getTodayString());
    // 5. Time Input Improvement: Start Time manual (null), End Time current (now)
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [endTime, setEndTime] = useState<Date | null>(new Date());
    const [startMileage, setStartMileage] = useState<number>(0);
    const [endMileage, setEndMileage] = useState<number>(0);
    // const [distanceInput, setDistanceInput] = useState<string | number>(''); // Removed unused
    // 1. Multiple Destinations
    const [destination, setDestination] = useState(''); // Current input
    const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]); // Selected List

    const [purpose, setPurpose] = useState('');
    const [selectedPurposeCategory, setSelectedPurposeCategory] = useState('');
    const [passengerList, setPassengerList] = useState<string[]>(['']);
    const [stopovers, setStopovers] = useState<{ location: string; time: Date }[]>([]);
    const [stopoverInput, setStopoverInput] = useState('');
    const [isBusinessTrip, setIsBusinessTrip] = useState(false);

    // Fueling State
    const [station, setStation] = useState('');
    const [fuelAmount, setFuelAmount] = useState('');
    const [fuelCost, setFuelCost] = useState('');
    const [pricePerLiter, setPricePerLiter] = useState('');
    const [fuelFundingSource, setFuelFundingSource] = useState('법인전입금');

    // 2. Fuel Cost Auto-Calculation
    useEffect(() => {
        if (fuelAmount && pricePerLiter) {
            const cost = Number(fuelAmount) * Number(pricePerLiter);
            setFuelCost(Math.round(cost).toString()); // Rounding to integer
        }
    }, [fuelAmount, pricePerLiter]);

    const [imageFile, setImageFile] = useState<File | null>(null);
    const fuelImageRef = useRef<HTMLInputElement>(null);

    // Maintenance State
    // endDate is now global
    const [maintenanceItem, setMaintenanceItem] = useState('');
    const [maintenanceShop, setMaintenanceShop] = useState('');
    const [maintenanceCost, setMaintenanceCost] = useState('');
    const [fundingSource, setFundingSource] = useState('법인전입금');
    const maintenanceImageRef = useRef<HTMLInputElement>(null);
    // New State for Maintenance Mileage
    const [maintenanceMileage, setMaintenanceMileage] = useState<number | ''>('');

    // History & Modals
    const [logs, setLogs] = useState<any[]>([]);
    const [historyFilter, setHistoryFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showMyLogsOnly, setShowMyLogsOnly] = useState(false);
    const [selectedImage, setSelectedImage] = useState<{ url: string; type: string } | null>(null);

    const [successModal, setSuccessModal] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
    const [reasonModal, setReasonModal] = useState<{ isOpen: boolean; title: string; type: 'update' | 'delete'; log?: any }>({ isOpen: false, title: '', type: 'update' });
    const [myRequestsModalOpen, setMyRequestsModalOpen] = useState(false);

    // Settings Data
    const [destinations, setDestinations] = useState<string[]>([]);
    const [purposes, setPurposes] = useState<string[]>([]);
    const [gasStations, setGasStations] = useState<string[]>([]);
    const [maintenanceItems, setMaintenanceItems] = useState<string[]>([]);
    const [maintenanceShops, setMaintenanceShops] = useState<string[]>([]);
    const [consumableSettings, setConsumableSettings] = useState<any[]>([]);
    const [slackWebhook, setSlackWebhook] = useState('');
    const [businessTripSlackWebhook, setBusinessTripSlackWebhook] = useState('');
    const [sheetConfig, setSheetConfig] = useState<any>(null);
    // const [businessTripConfig, setBusinessTripConfig] = useState<any>(null); // Removed unused
    const [imageResizeConfig, setImageResizeConfig] = useState<any>(null);

    // Real-time Settings Listener
    useEffect(() => {
        const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();

                // --- DIAGNOSTIC ALERT: REMOVE AFTER FIX ---
                // alert(`설정 불러오기 성공!\n운행목적: ${data.drivingPurposes?.length || 0}개\n정비소: ${data.maintenanceShops?.length || 0}개`);
                // ------------------------------------------

                setDestinations(data.drivingDestinations || []);
                setPurposes(data.drivingPurposes || []);
                setGasStations(data.gasStations || []);
                setMaintenanceShops(data.maintenanceShops || []);

                // Merge Maintenance Items & Consumable Labels
                const manualItems = data.maintenanceItems && data.maintenanceItems.length > 0
                    ? data.maintenanceItems
                    : ['엔진오일', '타이어', '배터리', '브레이크 라이닝', '와이퍼', '에어컨 필터', '기타'];
                const consumableLabels = (data.consumableSettings || []).map((c: any) => c.label);
                // Deduplicate and Set
                const mergedItems = Array.from(new Set([...manualItems, ...consumableLabels]));

                setMaintenanceItems(mergedItems);
                setSlackWebhook(data.slackWebhook || '');
                setBusinessTripSlackWebhook(data.businessTripSlackWebhook || '');
                setSheetConfig(data.sheetConfig || null);
                setImageResizeConfig(data.imageResizeConfig || null);
                setConsumableSettings(data.consumableSettings || []);
            } else {
                console.error("Settings document does not exist!");
                alert("오류: 시스템 설정 데이터 문서(settings/global)가 존재하지 않습니다. 관리자에게 문의하세요.");
            }
        }, (error) => {
            console.error("Error listening to settings:", error);
            alert("시스템 설정 동기화 오류: " + error.message);
        });

        return () => unsubscribe();
    }, []);

    const fetchLogs = async (vid: string) => {
        try {
            const dQ = query(collection(db, 'drivingLogs'), where('vehicleId', '==', vid), orderBy('date', 'desc'), limit(50));
            const fQ = query(collection(db, 'fuelingLogs'), where('vehicleId', '==', vid), orderBy('date', 'desc'), limit(50));
            const mQ = query(collection(db, 'maintenanceLogs'), where('vehicleId', '==', vid), orderBy('date', 'desc'), limit(50));

            const results = await Promise.allSettled([getDocs(dQ), getDocs(fQ), getDocs(mQ)]);

            const docs: any[] = [];

            // Driving Logs
            if (results[0].status === 'fulfilled') {
                docs.push(...results[0].value.docs.map(doc => ({ id: doc.id, type: 'driving', ...doc.data() })));
            } else {
                console.error("Driving Logs Query Failed:", results[0].reason);
            }

            // Fueling Logs
            if (results[1].status === 'fulfilled') {
                docs.push(...results[1].value.docs.map(doc => ({ id: doc.id, type: 'fueling', ...doc.data() })));
            } else {
                console.error("Fueling Logs Query Failed:", results[1].reason);
            }

            // Maintenance Logs
            if (results[2].status === 'fulfilled') {
                docs.push(...results[2].value.docs.map(doc => ({ id: doc.id, type: 'maintenance', ...doc.data() })));
            } else {
                console.error("Maintenance Logs Query Failed (Check Console for Index Link):", results[2].reason);
            }

            const combined = docs.sort((a: any, b: any) => new Date(b.startDate || b.date).getTime() - new Date(a.startDate || a.date).getTime());

            setLogs(combined);
        } catch (e) { console.error("Critical Error in fetchLogs:", e); }
    };

    const fetchVehicle = async (vid: string, isReapply: boolean = false) => {
        try {
            const vSnap = await getDoc(doc(db, 'vehicles', vid));
            if (vSnap.exists()) {
                const vData = { id: vSnap.id, ...vSnap.data() } as any;
                setVehicle(vData);

                // Only reset mileage if NOT re-applying (prevent overwrite of historical data)
                if (!isReapply) {
                    setStartMileage(vData.lastMileage || 0);
                    setEndMileage(vData.lastMileage || 0);
                    // Set default maintenance mileage
                    setMaintenanceMileage(vData.lastMileage || 0);
                }

                fetchLogs(vid);
            } else {
                console.error("Vehicle not found with ID:", vid);
            }
        } catch (e: any) {
            console.error("Error loading vehicle:", e);
            alert("차량 정보 로딩 오류: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) { setLoading(false); return; }

        if (location.state?.vehicle) {
            setVehicle(location.state.vehicle);
            setStartMileage(location.state.vehicle.lastMileage || 0);
            setEndMileage(location.state.vehicle.lastMileage || 0);
            setConsumableSettings(location.state.vehicle.consumableSettings || []);
            fetchLogs(location.state.vehicle.id);
            // Refresh vehicle data in background to ensure latest status (e.g. deleted files)
            fetchVehicle(location.state.vehicle.id);
            setLoading(false);
        } else if (location.state?.reapplyData && location.state?.mode === 'reapply') {
            // Re-apply Mode Logic
            const data = location.state.reapplyData;
            console.log("Entering Re-apply Mode with data:", data);

            if (vehicleId) {
                // Pass true to prevent mileage overwrite
                fetchVehicle(vehicleId, true).then(async () => {
                    console.log("Vehicle Loaded, Setting Re-apply Data:", data);

                    // Fetch Settings to Determine Purpose Category
                    let validPurposes: string[] = [];
                    try {
                        const sSnap = await getDoc(doc(db, 'settings', 'global'));
                        if (sSnap.exists()) {
                            validPurposes = sSnap.data().drivingPurposes || [];
                            // Also update local state to avoid double-fetch flicker
                            setPurposes(validPurposes);
                        }
                    } catch (e) { console.error("Error fetching settings for re-apply:", e); }

                    // Helper for safe date parsing
                    const safeParseDate = (input: any): Date | null => {
                        if (!input) return null;
                        let d: Date;
                        if (input.seconds) {
                            d = new Date(input.seconds * 1000);
                        } else if (input.toDate) {
                            d = input.toDate();
                        } else if (typeof input === 'string') {
                            if (input.includes('T')) {
                                d = new Date(input);
                            } else if (input.includes(':')) {
                                const [h, m] = input.split(':');
                                d = new Date(); d.setHours(Number(h), Number(m));
                            } else {
                                d = new Date(input);
                            }
                        } else {
                            d = new Date(input);
                        }

                        // Check validity
                        if (d && !isNaN(d.getTime())) return d;
                        console.warn("Invalid Date parsed:", input);
                        return null;
                    };

                    if (data.id) setReapplyId(data.id); // Set ID for update

                    // Pre-fill fields
                    const sDate = data.startDate || data.date || getTodayString();
                    setStartDate(sDate);
                    setEndDate(data.endDate || sDate);
                    setDestination(data.destination || '');

                    // Handle Purpose & Category
                    const pVal = data.purpose || '';
                    setPurpose(pVal);
                    if (pVal) {
                        if (validPurposes.includes(pVal)) {
                            setSelectedPurposeCategory(pVal);
                        } else {
                            setSelectedPurposeCategory('기타');
                        }
                    }

                    setPassengerList(data.passengerName ? data.passengerName.split(',').map((s: string) => s.trim()) : ['']);

                    if (data.startMileage !== undefined) setStartMileage(Number(data.startMileage)); // Ensure number
                    if (data.isBusinessTrip !== undefined) setIsBusinessTrip(data.isBusinessTrip);

                    // Safe Date Parsing for Stopovers
                    if (data.stopovers && Array.isArray(data.stopovers)) {
                        const parsedStopovers = data.stopovers.map((s: any) => ({
                            location: s.location,
                            time: safeParseDate(s.time) || new Date() // Fallback to now if invalid
                        }));
                        setStopovers(parsedStopovers);
                    }

                    if (data.startTime) {
                        const parsed = safeParseDate(data.startTime);
                        if (parsed) setStartTime(parsed);
                    }
                    if (data.endTime) {
                        const parsed = safeParseDate(data.endTime);
                        if (parsed) setEndTime(parsed);
                    }

                    if (data.startMileage !== undefined && data.endMileage !== undefined) {
                        setEndMileage(Number(data.endMileage));
                    }
                });
            }
        } else {
            const params = new URLSearchParams(location.search);
            const id = params.get('id') || vehicleId;
            if (id) fetchVehicle(id);
            else setLoading(false);
        }
    }, [user, location.state, location.search, vehicleId]);


    // Alert Modal State
    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'warning' | 'error' | 'success';
        details?: string[];
    }>({ isOpen: false, title: '', message: '', type: 'warning' });

    // ... (other state)

    const handleDrivingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Mandatory Field Validation
        if (!startDate || !endDate) { alert('날짜를 선택해주세요.'); return; }
        if (!startTime || !endTime) { alert('시작/종료 시간을 입력해주세요.'); return; }
        if (typeof startMileage !== 'number' || typeof endMileage !== 'number') { alert('주행거리를 입력해주세요.'); return; }
        if (selectedDestinations.length === 0 && !destination.trim()) { alert('목적지를 입력해주세요.'); return; }
        if (!purpose.trim()) { alert('운행 목적을 입력해주세요.'); return; }

        if (!vehicle) return;
        // Handle case where user typed but didn't press Add. Auto-add it.
        if (destination.trim() && selectedDestinations.length === 0) {
            // We'll handle this by updating the state implicitly during submission prep or just allow it.
            // Better to just push it to the list for logic below.
            // Actually, the submission logic uses `destination` state if list is empty? 
            // Refactored logic:
        }

        // --- Time Overlap Validation ---
        let fullStartTime: Date | null = null;
        let fullEndTime: Date | null = null;

        if (startTime && endTime) {
            // Combine Date + Time
            fullStartTime = combineDateAndTime(startDate, startTime);
            fullEndTime = combineDateAndTime(endDate, endTime);

            // Validate: Start Time vs End Time
            if (fullStartTime >= fullEndTime) {
                alert('종료 시간은 시작 시간보다 늦어야 합니다.');
                return;
            }
        }

        if (endMileage <= startMileage) {
            alert('도착 누적거리는 출발 누적거리보다 커야 합니다.');
            return;
        }

        setSubmitting(true); // Temporarily set to prevent double clicks while checking

        // 1. Get existing logs for this vehicle on this date
        // -------------------------------
        // Validation: Date Overlap Check (Only for Driving Logs)
        // -------------------------------
        // Validation: Date Overlap Check (Future Implementation)
        // if (activeTab === 'log' && startTime && endTime) { ... }

        setSubmitting(true);
        try {
            const commonData = {
                vehicleId: vehicle.id,
                vehicleName: vehicle.name || '차량명 미상',
                vehiclePlate: vehicle.plateNumber || '번호 미상',
                userId: user?.email,
                userName: user?.displayName || (user?.email ? user.email.split('@')[0] : '사용자 미상'),
                startDate,
                endDate,
                date: startDate, // Legacy
                timestamp: serverTimestamp()
            };

            let docRef;
            let sheetPayload: any = {};
            let collectionName = '';

            // ==========================================
            // CASE 1: DRIVING LOG
            // ==========================================
            // Only Driving Log is handled here. 
            // Fueling and Maintenance have their own separate handlers: handleFuelingSubmit, handleMaintenanceSubmit.

            if (activeTab === 'log') {
                // --- CRITICAL FIX: Ensure Vehicle Data Exists ---
                let currentVehicle = vehicle;
                if (!currentVehicle.name || !currentVehicle.plateNumber) {
                    try {
                        const params = new URLSearchParams(location.search);
                        const vidToFetch = vehicle.id || vehicleId || params.get('id');
                        if (vidToFetch) {
                            const vSnap = await getDoc(doc(db, 'vehicles', vidToFetch));
                            if (vSnap.exists()) {
                                currentVehicle = { id: vSnap.id, ...vSnap.data() };
                                setVehicle(currentVehicle); // Update state for UI
                            }
                        }
                    } catch (e) {
                        console.error("Emergency Vehicle Fetch Failed:", e);
                    }
                }

                collectionName = 'drivingLogs';
                const pNames = passengerList.filter(p => p.trim()).join(', ');

                const logData = {
                    ...commonData,
                    vehicleName: currentVehicle.name || '차량명 미상', // Use fetched data
                    vehiclePlate: currentVehicle.plateNumber || '번호 미상',
                    startTime: fullStartTime ? fullStartTime.toISOString() : null, // Use Combined Time
                    endTime: fullEndTime ? fullEndTime.toISOString() : null,       // Use Combined Time
                    startMileage,
                    endMileage,
                    totalDistance: endMileage - startMileage,
                    destination: selectedDestinations.length > 0 ? selectedDestinations.join(', ') : destination,
                    purpose,
                    passengerName: pNames,
                    passengerCount: passengerList.filter(p => p.trim()).length,
                    passengerDetail: passengerList.filter(p => p.trim()),
                    stopovers,
                    isBusinessTrip,
                    tripStatus: isBusinessTrip ? 'pending' : 'approved'
                };

                if (reapplyId) {
                    const ref = doc(db, collectionName, reapplyId);
                    await updateDoc(ref, logData);
                    docRef = ref;
                } else {
                    docRef = await addDoc(collection(db, collectionName), logData);
                }

                // Update Vehicle Mileage
                if (endMileage > (currentVehicle.lastMileage || 0)) {
                    await updateDoc(doc(db, 'vehicles', currentVehicle.id), { lastMileage: endMileage });
                }

                // Prepare Sheet Payload with Robust Fallbacks
                const safeVehicleName = currentVehicle.name || '차량명 미상';
                const safeVehiclePlate = currentVehicle.plateNumber || '번호 미상';
                const safeUserName = user?.displayName || (user?.email ? user.email.split('@')[0] : '사용자 미상');
                const safeUserId = user?.email || 'ID 미상';

                sheetPayload = {
                    action: 'write',
                    id: docRef.id,
                    logId: docRef.id,
                    type: 'driving',
                    startDate: startDate,
                    endDate: endDate,
                    date: startDate, // Legacy
                    startTime: fullStartTime ? fullStartTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
                    endTime: fullEndTime ? fullEndTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
                    vehicleName: safeVehicleName,
                    vehiclePlate: safeVehiclePlate,
                    userName: safeUserName,
                    userId: safeUserId,
                    startMileage: startMileage,
                    endMileage: endMileage,
                    distance: endMileage - startMileage,
                    destination: selectedDestinations.length > 0 ? selectedDestinations.join(', ') : destination,
                    purpose: purpose,
                    passengerName: pNames,
                    passengerDetail: passengerList.filter(p => p.trim()).join(', '), // Add explicit detail
                    stopoverDetail: stopovers.map(s => s.location).join(', '),       // Add explicit detail
                    remarks: `목적지: ${selectedDestinations.length > 0 ? selectedDestinations.join(', ') : destination} / 동승: ${pNames}`,
                    isBusinessTrip: isBusinessTrip ? 'TRUE' : 'FALSE'
                };
            }



            // --- Sync to Google Sheet (Common Logic) ---
            const targetSheetUrl = sheetConfig?.url;

            if (targetSheetUrl && !targetSheetUrl.includes('script.google.com')) {
                alert("⚠️ 설정 오류: '구글 시트 연동 URL'이 올바르지 않습니다.");
            } else if (targetSheetUrl) {
                console.log(`Sending ${activeTab} log to Sheet...`, sheetPayload);
                await sendToGoogleSheet(sheetPayload, targetSheetUrl);
            } else {
                console.warn("Sheet URL missing, skipping sync");
            }

            // --- Consumable Alert Check (Keep existing logic) ---
            if (activeTab === 'log' && consumableSettings.length > 0 && slackWebhook) {
                // ... existing consumable logic ...
            }

            // --- Reset Forms ---
            setStartMileage(endMileage);
            setEndMileage(0);
            setDestination('');
            setSelectedDestinations([]);
            setPassengerList(['']);
            setStopovers([]);
            setReapplyId(null);
            setIsBusinessTrip(false);
            setStartTime(null);
            setEndTime(new Date());
            setEndDate(startDate);

            // Reset Purpose
            setPurpose('');
            setSelectedPurposeCategory('');

            // Fetch Data & Switch Tab
            await fetchLogs(vehicle.id);
            setActiveTab('history');
            setHistoryFilter('driving'); // Show Driving Logs

            // Show Success Modal
            let msg = '운행 기록이 저장되었습니다.';
            if (targetSheetUrl && targetSheetUrl.includes('script.google.com')) msg += ' (시트 전송됨)';
            if (isBusinessTrip) msg += ' + 승인 요청';
            setSuccessModal({ isOpen: true, message: msg });

            // --- Business Trip Notification (Only Driving) ---
            if (isBusinessTrip && businessTripSlackWebhook) {
                sendSlackNotification(
                    businessTripSlackWebhook,
                    `📢 [관내출장 신청] 결재 대기 중\n\n` +
                    `👤 *신청자*: ${user?.displayName || '사용자'}\n` +
                    `📅 *기간*: ${startDate} ~ ${endDate}\n` +
                    `🚗 *차량*: ${vehicle.name} (${vehicle.plateNumber})\n` +
                    `📍 *목적지*: ${destination}\n` +
                    `📝 *목적*: ${purpose}\n\n` +
                    `👉 관리자 페이지에서 승인/반려 처리가 필요합니다.\n` +
                    `🔗 *바로가기*: ${window.location.origin}/admin?tab=trips`
                );
            }

        } catch (error) {
            console.error(error);
            alert('저장 실패: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setSubmitting(false);
        }
    };



    const handleFuelingSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vehicle) return;

        // Mandatory Validation: All fields required
        if (!startDate) { alert('날짜를 선택해주세요.'); return; }
        if (!fuelAmount) { alert('주유량을 입력해주세요.'); return; }
        if (!fuelCost) { alert('금액을 입력해주세요.'); return; }
        if (!pricePerLiter) { alert('단가를 입력해주세요.'); return; }
        if (!station.trim()) { alert('주유소를 입력해주세요.'); return; }
        if (!fuelFundingSource) { alert('결제 수단을 선택해주세요.'); return; }
        setSubmitting(true);
        setUploading(true);
        try {
            // 1. Upload Image if exists
            let imageUrl = null;
            if (imageFile) {
                let fileToUpload = imageFile;
                try {
                    const maxWidth = imageResizeConfig?.maxWidth || 1280;
                    const maxHeight = imageResizeConfig?.maxHeight || 1280;
                    const quality = imageResizeConfig?.quality || 0.7;

                    fileToUpload = await compressImage(imageFile, maxWidth, maxHeight, quality);
                } catch (e) {
                    console.error("Image compression failed, using original", e);
                }

                const path = `logs/${vehicle.id}/fueling/${Date.now()}_${fileToUpload.name}`;
                imageUrl = await uploadImage(fileToUpload, path);
            }

            // --- CRITICAL FIX: Ensure Vehicle Data Exists ---
            let currentVehicle = vehicle;
            if (!currentVehicle.name || !currentVehicle.plateNumber) {
                try {
                    const vidToFetch = vehicle.id;
                    if (vidToFetch) {
                        const vSnap = await getDoc(doc(db, 'vehicles', vidToFetch));
                        if (vSnap.exists()) {
                            currentVehicle = { id: vSnap.id, ...vSnap.data() };
                            setVehicle(currentVehicle);
                        }
                    }
                } catch (e) { console.error("Emergency Vehicle Fetch Failed:", e); }
            }

            const logData = {
                vehicleId: currentVehicle.id,
                vehicleName: currentVehicle.name || '차량명 미상',
                vehiclePlate: currentVehicle.plateNumber || '번호 미상',
                userId: user?.email,
                userName: user?.displayName || '사용자',
                startDate,
                endDate, // Fueling usually single day
                date: startDate, // Legacy
                amount: Number(fuelAmount),
                cost: Number(fuelCost),
                pricePerLiter: Number(pricePerLiter),
                paymentMethod: fuelFundingSource,
                station,
                imageUrl,
                timestamp: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'fuelingLogs'), logData);

            // Sync with Image and ID
            sendToGoogleSheet({
                ...logData,
                id: docRef.id, // Add ID for sync
                type: 'fueling',
                // remarks: removed, use imageUrl column
                timestamp: new Date().toISOString()
            });

            console.log("Fueling Log Saved Successfully.");

            // Reset Form
            setFuelAmount(''); setFuelCost(''); setStation(''); setImageFile(null);
            if (fuelImageRef.current) fuelImageRef.current.value = '';

            // Update & Navigate
            await fetchLogs(vehicle.id);
            setActiveTab('history');
            setHistoryFilter('fueling');
            setSuccessModal({ isOpen: true, message: '주유 기록이 저장되었습니다.' });
        } catch (error) {
            console.error("Save Error:", error);
            alert('저장 실패: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setSubmitting(false);
            setUploading(false);
        }
    };

    const handleMaintenanceSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vehicle) return;

        // Mandatory Validation: All fields required
        if (!startDate) { alert('날짜를 선택해주세요.'); return; }
        if (!maintenanceItem.trim()) { alert('정비 항목을 입력해주세요.'); return; }
        if (!maintenanceCost) { alert('금액을 입력해주세요.'); return; }
        if (!maintenanceShop.trim()) { alert('정비소를 입력해주세요.'); return; }
        if (!fundingSource) { alert('결제 수단을 선택해주세요.'); return; }
        setSubmitting(true);
        setUploading(true);
        try {
            // 1. Upload Image if exists
            let imageUrl = null;
            if (imageFile) {
                let fileToUpload = imageFile;
                try {
                    const maxWidth = imageResizeConfig?.maxWidth || 1280;
                    const maxHeight = imageResizeConfig?.maxHeight || 1280;
                    const quality = imageResizeConfig?.quality || 0.7;

                    fileToUpload = await compressImage(imageFile, maxWidth, maxHeight, quality);
                } catch (e) {
                    console.error("Image compression failed, using original", e);
                }

                const path = `logs/${vehicle.id}/maintenance/${Date.now()}_${fileToUpload.name}`;
                imageUrl = await uploadImage(fileToUpload, path);
            }

            // --- CRITICAL FIX: Ensure Vehicle Data Exists ---
            let currentVehicle = vehicle;
            if (!currentVehicle.name || !currentVehicle.plateNumber) {
                try {
                    const vidToFetch = vehicle.id;
                    if (vidToFetch) {
                        const vSnap = await getDoc(doc(db, 'vehicles', vidToFetch));
                        if (vSnap.exists()) {
                            currentVehicle = { id: vSnap.id, ...vSnap.data() };
                            setVehicle(currentVehicle);
                        }
                    }
                } catch (e) { console.error("Emergency Vehicle Fetch Failed:", e); }
            }

            const logData = {
                vehicleId: currentVehicle.id,
                vehicleName: currentVehicle.name || '차량명 미상',
                vehiclePlate: currentVehicle.plateNumber || '번호 미상',
                userId: user?.email,
                userName: user?.displayName || '사용자',
                startDate,
                endDate,
                date: startDate, // Legacy
                item: maintenanceItem,
                cost: Number(maintenanceCost),
                paymentMethod: fundingSource,
                shop: maintenanceShop,
                imageUrl,
                maintenanceMileage: maintenanceMileage !== '' ? Number(maintenanceMileage) : (currentVehicle.lastMileage || 0),
                timestamp: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'maintenanceLogs'), logData);

            // --- AUTOMATION: Update Vehicle Consumables if Item Matches Settings ---
            // Find if this maintenance item is a managed consumable
            // We use 'consumableSettings' fetched from global settings
            // Note: consumableSettings can also be in vehicle data overrides, but we prioritize global or merge?
            // The requirement says "admin registered settings".
            const matchedSetting = consumableSettings.find((s: any) => s.label === maintenanceItem);

            if (matchedSetting) {
                try {
                    const mileageToUpdate = maintenanceMileage !== '' ? Number(maintenanceMileage) : (currentVehicle.lastMileage || 0);

                    // Prepare update data for vehicle
                    // We need to update vehicle.consumables.[Label]
                    // Firestore path for nested update: "consumables.ItemName"
                    // But to be safe with keys, we construct the object.

                    // We don't want to replace the whole consumables map, just this item.
                    // Using dot notation for updateDoc works best.
                    const updateField = `consumables.${maintenanceItem}`;

                    await updateDoc(doc(db, 'vehicles', currentVehicle.id), {
                        [updateField]: {
                            lastDate: endDate, // Use End Date for consumable reset
                            lastMileage: mileageToUpdate
                        }
                    });
                    console.log(`Auto-updated consumable: ${maintenanceItem} (Date: ${endDate}, Mileage: ${mileageToUpdate})`);
                } catch (autoUpdateError) {
                    console.error("Failed to auto-update consumable:", autoUpdateError);
                    // Do not block the main flow, just log error
                }
            }

            // Sync with Image and ID
            sendToGoogleSheet({
                ...logData,
                id: docRef.id, // Add ID for sync
                type: 'maintenance',
                // remarks: removed
                timestamp: new Date().toISOString()
            });

            console.log("Maintenance Log Saved Successfully.");

            // Reset Form
            setMaintenanceItem(''); setMaintenanceCost(''); setMaintenanceShop(''); setImageFile(null);
            if (maintenanceImageRef.current) maintenanceImageRef.current.value = '';

            // Update & Navigate
            await fetchLogs(vehicle.id);
            setActiveTab('history');
            setHistoryFilter('maintenance');
            setSuccessModal({ isOpen: true, message: '정비 기록이 저장되었습니다.' });
        } catch (error) {
            console.error("Save Error:", error);
            alert('저장 실패: ' + (error instanceof Error ? error.message : String(error)));
        } finally {
            setSubmitting(false);
            setUploading(false);
        }
    };

    const requestModification = (log: any, changeType: 'update' | 'delete') => {
        setReasonModal({
            isOpen: true,
            title: changeType === 'update' ? '수정 요청' : '삭제 요청',
            type: changeType,
            log
        });
    };

    const handleReasonSubmit = async (reason: string) => {
        const { log, type } = reasonModal;
        if (!log) return;

        console.log('Processing Request:', { log, type, reason });

        const collectionName = log.type === 'driving' ? 'drivingLogs' : (log.type === 'fueling' ? 'fuelingLogs' : 'maintenanceLogs');

        try {
            await addDoc(collection(db, 'modificationRequests'), {
                targetCollection: collectionName,
                targetDocId: log.id,
                originalData: log,
                changeType: type,
                reason,
                status: 'pending',
                requester: user?.email,
                requesterName: user?.displayName || '사용자',
                timestamp: serverTimestamp()
            });

            // Send Slack Notification to Admin
            if (slackWebhook) {
                const requestType = type === 'update' ? '수정' : '삭제';
                sendSlackNotification(
                    slackWebhook,
                    `📢 [${requestType} 요청] ${user?.displayName || '사용자'} 님이 ${requestType}을 요청했습니다.\n\n` +
                    `💬 *사유*: ${reason}\n` +
                    `📋 *대상 기록*\n${getLogSummary(log, collectionName)}`
                );
            }

            setSuccessModal({ isOpen: true, message: '요청이 관리자에게 전송되었습니다.' });
        } catch (e) {
            console.error(e);
            alert('요청 전송 실패: ' + e);
        }
    };



    if (loading) return <div>Loading...</div>;
    if (!vehicle) return <div>Error loading vehicle</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white px-4 py-3 shadow-sm flex items-center z-10 sticky top-0 justify-between">
                <div className="flex items-center">
                    <button onClick={() => navigate(-1)} className="mr-3 p-1">
                        <ArrowLeft size={24} className="text-gray-600" />
                    </button>
                    <h1 className="text-lg font-bold text-gray-800">{vehicle.name} ({vehicle.plateNumber})</h1>
                </div>
                <button
                    onClick={() => setMyRequestsModalOpen(true)}
                    className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100"
                >
                    나의 요청
                </button>
            </div>

            {/* Main Tabs */}
            <div className="bg-white border-b border-gray-200 overflow-x-auto">
                <div className="flex min-w-full">
                    <button className={`flex-1 py-3 px-4 whitespace-nowrap text-sm font-bold border-b-2 ${activeTab === 'log' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`} onClick={() => setActiveTab('log')}>운행일지</button>
                    <button className={`flex-1 py-3 px-4 whitespace-nowrap text-sm font-bold border-b-2 ${activeTab === 'refuel' ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'}`} onClick={() => setActiveTab('refuel')}>주유기록</button>
                    <button className={`flex-1 py-3 px-4 whitespace-nowrap text-sm font-bold border-b-2 ${activeTab === 'maintenance' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500'}`} onClick={() => setActiveTab('maintenance')}>정비/기타</button>
                    <button className={`flex-1 py-3 px-4 whitespace-nowrap text-sm font-bold border-b-2 ${activeTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`} onClick={() => setActiveTab('history')}>기록조회</button>
                    <button className={`flex-1 py-3 px-4 whitespace-nowrap text-sm font-bold border-b-2 ${activeTab === 'info' ? 'border-gray-600 text-gray-600' : 'border-transparent text-gray-500'}`} onClick={() => setActiveTab('info')}>정보</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-20">

                {/* 1. Driving Log Form */}
                {activeTab === 'log' && (
                    <form onSubmit={handleDrivingSubmit} className="space-y-6 max-w-md mx-auto">






                        <div className="animate-fade-in space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">운행 기간</label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => {
                                            const newStart = e.target.value;
                                            setStartDate(newStart);
                                            if (newStart > endDate) setEndDate(newStart);
                                        }}
                                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg text-lg"
                                        required
                                    />
                                    <span className="text-gray-500 font-bold">~</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        min={startDate}
                                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg text-lg"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex space-x-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">출발 시간</label>
                                    <input
                                        type="time"
                                        value={startTime ? startTime.toTimeString().slice(0, 5) : ''}
                                        onChange={(e) => {
                                            const [h, m] = e.target.value.split(':');
                                            const d = new Date(); d.setHours(Number(h), Number(m));
                                            setStartTime(d);
                                        }}
                                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg"
                                        required
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">도착 시간</label>
                                    <input
                                        type="time"
                                        value={endTime ? endTime.toTimeString().slice(0, 5) : ''}
                                        onChange={(e) => {
                                            const [h, m] = e.target.value.split(':');
                                            const d = new Date(); d.setHours(Number(h), Number(m));
                                            setEndTime(d);
                                        }}
                                        className="block w-full px-4 py-3 border border-gray-300 rounded-lg"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Mileage Logic Refactor: Start (ReadOnly), End (Input), Distance (Calc) */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">
                                        출발 전 누적 거리
                                        <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={startMileage}
                                            disabled
                                            className="w-full p-3 border border-gray-200 rounded-xl bg-gray-100 text-gray-500 font-mono"
                                        />
                                        <span className="absolute right-3 top-3 text-sm text-gray-400">km</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">
                                        도착 후 누적 거리
                                        <span className="text-red-500 ml-1">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={endMileage || ''}
                                            onChange={(e) => setEndMileage(Number(e.target.value))}
                                            placeholder={startMileage ? `>${startMileage}` : '0'}
                                            className={`w-full p-3 border rounded-xl font-mono text-lg font-bold ${endMileage > 0 && endMileage <= startMileage ? 'border-red-500 text-red-500 focus:ring-red-200' : 'border-gray-200 focus:ring-2 focus:ring-slate-800'}`}
                                        />
                                        <span className="absolute right-3 top-3 text-sm text-gray-400">km</span>
                                    </div>
                                    {endMileage > 0 && endMileage <= startMileage && (
                                        <p className="text-xs text-red-500 mt-1">출발 거리보다 커야 합니다.</p>
                                    )}
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl mb-6 flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-600">이번 운행 거리</span>
                                <span className="text-xl font-black text-slate-800">
                                    {endMileage > startMileage ? (endMileage - startMileage).toLocaleString() : 0} <span className="text-sm font-normal text-slate-500">km</span>
                                </span>
                            </div>

                            {/* Destination Input (Multiple) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">목적지</label>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            list="destinations-list"
                                            value={destination}
                                            onChange={(e) => setDestination(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (destination.trim()) {
                                                        setSelectedDestinations([...selectedDestinations, destination.trim()]);
                                                        setDestination('');
                                                    }
                                                }
                                            }}
                                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg"
                                            placeholder="목적지를 입력하거나 선택하세요 (Enter로 추가)"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (destination.trim()) {
                                                    setSelectedDestinations([...selectedDestinations, destination.trim()]);
                                                    setDestination('');
                                                }
                                            }}
                                            className="bg-gray-100 px-4 rounded-lg font-bold text-gray-600 hover:bg-gray-200"
                                        >
                                            추가
                                        </button>
                                    </div>
                                    <datalist id="destinations-list">
                                        {destinations.map((d, i) => <option key={i} value={d} />)}
                                    </datalist>

                                    {/* Selected Destinations Tags */}
                                    {selectedDestinations.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {selectedDestinations.map((dest, idx) => (
                                                <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold flex items-center">
                                                    {dest}
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedDestinations(selectedDestinations.filter((_, i) => i !== idx))}
                                                        className="ml-2 text-blue-400 hover:text-blue-600"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stopovers List */}
                            {/* Stopovers List & Manual Input */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-xs font-bold text-gray-500">🚩 경유지 추가</label>
                                </div>
                                <div className="flex space-x-2 mb-3">
                                    <input
                                        type="text"
                                        value={stopoverInput}
                                        onChange={(e) => setStopoverInput(e.target.value)}
                                        placeholder="경유지 명칭 (예: 휴게소)"
                                        className="flex-1 px-3 py-2 border rounded-lg text-sm"
                                        list="stopover-list"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (stopoverInput.trim()) {
                                                    setStopovers([...stopovers, { location: stopoverInput.trim(), time: new Date() }]);
                                                    setStopoverInput('');
                                                }
                                            }
                                        }}
                                    />
                                    <datalist id="stopover-list">
                                        {destinations.map((d, i) => <option key={i} value={d} />)}
                                    </datalist>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (stopoverInput.trim()) {
                                                setStopovers([...stopovers, { location: stopoverInput.trim(), time: new Date() }]);
                                                setStopoverInput('');
                                            }
                                        }}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200"
                                    >
                                        추가
                                    </button>
                                </div>

                                {stopovers.length > 0 ? (
                                    <ul className="space-y-2">
                                        {stopovers.map((stop, idx) => (
                                            <li key={idx} className="text-sm text-gray-800 flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100">
                                                <span className="truncate flex-1 mr-2">{stop.location}</span>
                                                <span className="text-xs text-gray-500 font-mono whitespace-nowrap">{stop.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setStopovers(stopovers.filter((_, i) => i !== idx))}
                                                    className="ml-2 text-red-400 hover:text-red-500"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-gray-400 text-center py-2">등록된 경유지가 없습니다.</p>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-medium text-gray-500">동승자 성명</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">동승 인원</span>
                                    <div className="bg-gray-100 px-3 py-1 rounded text-sm font-bold text-gray-700 min-w-[3rem] text-center">
                                        {passengerList.filter(p => p.trim()).length}명
                                    </div>
                                </div>
                            </div>

                            {passengerList.map((name, index) => (
                                <div key={index} className="flex gap-2">
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => {
                                            const newList = [...passengerList];
                                            newList[index] = e.target.value;
                                            setPassengerList(newList);
                                        }}
                                        className="flex-1 block w-full px-4 py-3 bg-white border border-gray-300 rounded-lg"
                                        placeholder="이름 입력"
                                    />
                                    {index === 0 ? (
                                        <button
                                            type="button"
                                            onClick={() => setPassengerList([...passengerList, ''])}
                                            className="p-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newList = passengerList.filter((_, i) => i !== index);
                                                setPassengerList(newList);
                                            }}
                                            className="p-3 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 border border-red-200 transition-colors"
                                        >
                                            <Minus size={20} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Business Trip Toggle */}
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-6">
                            <label className="flex items-start space-x-3 cursor-pointer">
                                <div className="flex items-center h-5">
                                    <input
                                        type="checkbox"
                                        checked={isBusinessTrip}
                                        onChange={(e) => setIsBusinessTrip(e.target.checked)}
                                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <span className="font-bold text-indigo-900 block text-sm">관내출장 기록 병행</span>
                                    <span className="text-xs text-indigo-600 block mt-1">체크 시 출장대장에도 기록되며 관리자 결재가 필요합니다.</span>
                                </div>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">운행 목적</label>
                            <select
                                value={selectedPurposeCategory}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedPurposeCategory(val);
                                    if (val !== '기타') {
                                        setPurpose(val);
                                    } else {
                                        setPurpose('');
                                    }
                                }}
                                className="block w-full px-4 py-3 border border-gray-300 rounded-lg bg-white mb-2"
                                required
                            >
                                <option value="">선택해주세요</option>
                                {purposes.map((p, i) => (
                                    <option key={i} value={p}>{p}</option>
                                ))}
                                <option value="기타">기타 (직접 입력)</option>
                            </select>
                            {selectedPurposeCategory === '기타' && (
                                <input
                                    type="text"
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    placeholder="상세 목적을 입력하세요"
                                    className="block w-full px-4 py-3 border border-gray-300 rounded-lg bg-white"
                                    required
                                />
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`w-full py-4 rounded-xl font-bold shadow-md transition-colors ${submitting
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                        >
                            운행 기록 저장
                        </button>
                    </form >
                )}


                {/* 2. Fueling Form */}
                {
                    activeTab === 'refuel' && (
                        <form onSubmit={handleFuelingSubmit} className="space-y-6 max-w-md mx-auto">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">주유 일자</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => {
                                        setStartDate(e.target.value);
                                        setEndDate(e.target.value); // Sync end date for fueling
                                    }}
                                    className="block w-full px-4 py-3 border border-gray-300 rounded-lg text-lg"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    주유소 이름
                                    {vehicle.fuelType && <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">연료: {vehicle.fuelType}</span>}
                                </label>
                                <input
                                    list="stations-list"
                                    type="text"
                                    value={station}
                                    onChange={(e) => setStation(e.target.value)}
                                    className="block w-full px-4 py-3 border border-gray-300 rounded-lg"
                                    placeholder="예: SK엔크린 강남점 (선택 또는 입력)"
                                    required
                                />
                                <datalist id="stations-list">
                                    {gasStations.map((s, i) => <option key={i} value={s} />)}
                                </datalist>
                            </div>
                            <div className="flex space-x-4">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">주유량 (L)</label>
                                    <input type="number" value={fuelAmount} onChange={(e) => setFuelAmount(e.target.value)} className="block w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="0" required />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">단가 (원/L)</label>
                                    <input type="number" value={pricePerLiter} onChange={(e) => setPricePerLiter(e.target.value)} className="block w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="1700" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">결제 금액 및 수단</label>
                                <div className="flex space-x-2">
                                    <input type="number" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg" placeholder="총 금액 (원)" required />
                                    <select value={fuelFundingSource} onChange={(e) => setFuelFundingSource(e.target.value)} className="w-1/3 px-2 py-3 border border-gray-300 rounded-lg text-sm">
                                        <option value="법인전입금">법인전입금</option>
                                        <option value="자부담금">자부담금</option>
                                        <option value="보조금">보조금</option>
                                        <option value="후원금">후원금</option>
                                    </select>
                                </div>
                            </div>

                            {/* Photo Upload */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">주유사진</label>
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        {imageFile ? (
                                            <p className="text-sm text-green-600 font-bold">{imageFile.name}</p>
                                        ) : (
                                            <>
                                                <Camera className="w-8 h-8 text-gray-400 mb-2" />
                                                <p className="text-xs text-gray-500">사진 찍기 또는 업로드</p>
                                            </>
                                        )}
                                    </div>
                                    <input ref={fuelImageRef} type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files) setImageFile(e.target.files[0]); }} />
                                </label>
                            </div>

                            <button type="submit" disabled={submitting || uploading} className="w-full py-4 bg-green-600 text-white rounded-xl font-bold shadow-md">
                                {uploading ? '사진 업로드 중...' : '주유 기록 저장'}
                            </button>
                        </form>
                    )
                }

                {/* 3. Maintenance Form */}
                {
                    activeTab === 'maintenance' && (
                        <form onSubmit={handleMaintenanceSubmit} className="space-y-6 max-w-md mx-auto">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">정비 기간</label>
                                <div className="flex space-x-2">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => {
                                            const newStart = e.target.value;
                                            setStartDate(newStart);
                                            // Optional: if (newStart > endDate) setEndDate(newStart);
                                        }}
                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm"
                                        required
                                    />
                                    <span className="self-center">~</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        min={startDate}
                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">정비 항목</label>
                                <select value={maintenanceItem} onChange={(e) => setMaintenanceItem(e.target.value)} className="block w-full px-4 py-3 border border-gray-300 rounded-lg" required>
                                    <option value="">항목 선택</option>
                                    {maintenanceItems.map(item => <option key={item} value={item}>{item}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">정비 시 주행거리 (km)</label>
                                <input
                                    type="number"
                                    value={maintenanceMileage}
                                    onChange={(e) => setMaintenanceMileage(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="block w-full px-4 py-3 border border-gray-300 rounded-lg"
                                    placeholder="정비 시점의 주행거리를 입력하세요"
                                />
                                <p className="text-xs text-gray-500 mt-1">* 입력 시 해당 소모품의 교체 주기가 자동으로 갱신됩니다.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">정비소 / 구매처</label>
                                <input type="text" value={maintenanceShop} onChange={(e) => setMaintenanceShop(e.target.value)} list="shop-list" className="block w-full px-4 py-3 border border-gray-300 rounded-lg" placeholder="예: 블루핸즈 역삼점" />
                                <datalist id="shop-list">
                                    {maintenanceShops.map((shop, index) => (
                                        <option key={index} value={shop} />
                                    ))}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">결제 금액 및 수단</label>
                                <div className="flex space-x-2">
                                    <input type="number" value={maintenanceCost} onChange={(e) => setMaintenanceCost(e.target.value)} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg" placeholder="비용 (원)" required />
                                    <select value={fundingSource} onChange={(e) => setFundingSource(e.target.value)} className="w-1/3 px-2 py-3 border border-gray-300 rounded-lg text-sm">
                                        <option value="법인전입금">법인전입금</option>
                                        <option value="자부담금">자부담금</option>
                                        <option value="보조금">보조금</option>
                                        <option value="후원금">후원금</option>
                                    </select>
                                </div>
                            </div>

                            {/* Photo Upload */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">정비사진</label>
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        {imageFile ? (
                                            <p className="text-sm text-green-600 font-bold">{imageFile.name}</p>
                                        ) : (
                                            <>
                                                <Camera className="w-8 h-8 text-gray-400 mb-2" />
                                                <p className="text-xs text-gray-500">사진 찍기 또는 업로드</p>
                                            </>
                                        )}
                                    </div>
                                    <input ref={maintenanceImageRef} type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files) setImageFile(e.target.files[0]); }} />
                                </label>
                            </div>

                            <button type="submit" disabled={submitting || uploading} className="w-full py-4 bg-orange-600 text-white rounded-xl font-bold shadow-md">
                                {uploading ? '사진 업로드 중...' : '정비 기록 저장'}
                            </button>
                        </form>
                    )
                }

                {/* 4. History Tab (Merged) */}
                {
                    activeTab === 'history' && (
                        <div className="space-y-4 max-w-md mx-auto">
                            {/* Filter Buttons */}
                            <div className="flex space-x-2 overflow-x-auto pb-2">
                                <button
                                    onClick={() => setHistoryFilter('all')}
                                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${historyFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
                                >
                                    전체
                                </button>
                                <button
                                    onClick={() => setHistoryFilter('driving')}
                                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${historyFilter === 'driving' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
                                >
                                    운행 기록
                                </button>
                                <button
                                    onClick={() => setHistoryFilter('fueling')}
                                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${historyFilter === 'fueling' ? 'bg-green-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
                                >
                                    주유 기록
                                </button>
                                <button
                                    onClick={() => setHistoryFilter('maintenance')}
                                    className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${historyFilter === 'maintenance' ? 'bg-orange-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
                                >
                                    정비 기록
                                </button>
                            </div>

                            <div className="flex justify-between items-center text-xs text-gray-500 px-2">
                                <span>날짜/구분</span>
                                <span>상세내역</span>
                            </div>

                            {/* Search & My Logs Filter */}
                            <div className="flex gap-2 mb-2 px-1">
                                <input
                                    type="text"
                                    placeholder="검색 (날짜, 목적, 장소 등)"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="flex-1 p-2 border rounded-lg text-sm"
                                />
                                <button
                                    onClick={() => setShowMyLogsOnly(!showMyLogsOnly)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap border ${showMyLogsOnly ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300'}`}
                                >
                                    내 기록만
                                </button>
                            </div>

                            {logs.filter(log => {
                                const matchesType = historyFilter === 'all' || log.type === historyFilter;
                                const matchesUser = !showMyLogsOnly || log.userId === user?.email;
                                const searchLower = searchTerm.toLowerCase();
                                const matchesSearch = !searchTerm ||
                                    log.date.includes(searchTerm) ||
                                    log.purpose?.toLowerCase().includes(searchLower) ||
                                    log.station?.toLowerCase().includes(searchLower) ||
                                    log.shop?.toLowerCase().includes(searchLower) ||
                                    log.userName?.toLowerCase().includes(searchLower);

                                return matchesType && matchesUser && matchesSearch;
                            }).map(log => (
                                <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${log.type === 'driving' ? 'bg-blue-100 text-blue-700' :
                                                log.type === 'fueling' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                {log.type === 'driving' ? '운행' : log.type === 'fueling' ? '주유' : '정비'}
                                            </span>
                                            <span className="text-gray-400 text-xs">
                                                {log.startDate === log.endDate || !log.endDate
                                                    ? log.date
                                                    : `${log.startDate} ~ ${log.endDate}`}
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-500 font-medium">
                                            {log.userName ? `${log.userName}(${log.userId || 'ID없음'})` : '사용자'}
                                        </span>
                                    </div>

                                    {log.type === 'driving' && (
                                        <div className="mt-2 space-y-3">
                                            {/* Time Section */}
                                            <div className="flex items-start gap-2">
                                                <span className="text-lg">🕒</span>
                                                <div className="text-xs text-gray-600">
                                                    <div className="font-bold mb-1">운행시간</div>
                                                    {log.startTime && log.endTime ? (
                                                        <div>출발 : {new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ~ 도착 : {new Date(log.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    ) : (
                                                        <div className="text-gray-400">시간 기록 없음</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Mileage Section */}
                                            <div className="flex items-start gap-2">
                                                <span className="text-lg">🚗</span>
                                                <div className="text-xs text-gray-600">
                                                    <div className="font-bold mb-1">운행거리 ({log.totalDistance}km 운행)</div>
                                                    <div>출발 : {log.startMileage?.toLocaleString()}km ~ 도착 : {log.endMileage?.toLocaleString()}km</div>
                                                </div>
                                            </div>

                                            {/* Details Section */}
                                            <div className="pl-8 text-xs text-gray-600 space-y-1">
                                                <div><span className="font-bold">운행목적 :</span> {log.purpose}</div>
                                                <div>
                                                    <span className="font-bold">목적지 :</span> {log.destination}
                                                    {log.stopovers && log.stopovers.length > 0 && (
                                                        <span className="text-gray-500"> / 경유지({log.stopovers.length}) : {log.stopovers.map((s: any) => s.location).join(', ')}</span>
                                                    )}
                                                </div>
                                                {(log.passengerCount > 0 || log.passengerName) && (
                                                    <div><span className="font-bold">동승자 :</span> {log.passengerName || '-'} ({log.passengerCount}명)</div>
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
                                                    <div><span className="font-bold">금액 :</span> {log.cost.toLocaleString()}원 {log.pricePerLiter ? `(${Number(log.pricePerLiter).toLocaleString()}원/L)` : ''}</div>
                                                    <div><span className="font-bold">주유소 :</span> {log.station}</div>
                                                    <div><span className="font-bold">결제 :</span> {log.paymentMethod || '-'}</div>
                                                </div>
                                            </div>
                                            {log.imageUrl && (
                                                <button
                                                    onClick={() => setSelectedImage({ url: log.imageUrl, type: 'image' })}
                                                    className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium pl-8"
                                                >
                                                    <Camera className="w-3 h-3" />
                                                    <span>사진 보기</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {log.type === 'maintenance' && (
                                        <div className="mt-2 space-y-3">
                                            <div className="flex items-start gap-2">
                                                <span className="text-lg">🔧</span>
                                                <div className="text-xs text-gray-600 space-y-1">
                                                    <div><span className="font-bold">정비항목 :</span> {log.item}</div>
                                                    <div><span className="font-bold">금액 :</span> {log.cost.toLocaleString()}원</div>
                                                    <div><span className="font-bold">정비소 :</span> {log.shop}</div>
                                                    <div><span className="font-bold">결제 :</span> {log.paymentMethod || '-'}</div>
                                                    {log.endDate && log.endDate !== log.date && (
                                                        <div><span className="font-bold">기간 :</span> {log.date} ~ {log.endDate}</div>
                                                    )}
                                                </div>
                                            </div>
                                            {log.imageUrl && (
                                                <button
                                                    onClick={() => setSelectedImage({ url: log.imageUrl, type: 'image' })}
                                                    className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium pl-8"
                                                >
                                                    <Camera className="w-3 h-3" />
                                                    <span>사진 보기</span>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Edit/Delete Request Button */}
                                    <div className="flex justify-end mt-4 gap-3">
                                        {isAdmin ? (
                                            <button
                                                onClick={async () => {
                                                    if (confirm('관리자 권한으로 데이터를 삭제하시겠습니까?\n(가장 최근 운행기록 삭제 시, 차량 주행거리가 이전 상태로 복구됩니다.)')) {
                                                        try {
                                                            const logTypeCol = log.type === 'driving' ? 'drivingLogs' : (log.type === 'fueling' ? 'fuelingLogs' : 'maintenanceLogs');
                                                            await deleteDoc(doc(db, logTypeCol, log.id));

                                                            // Sync Deletion to Google Sheet
                                                            sendToGoogleSheet({ action: 'delete', id: log.id });

                                                            // Mileage Revert Logic
                                                            if (log.type === 'driving') {
                                                                // Find the new latest log
                                                                const q = query(
                                                                    collection(db, 'drivingLogs'),
                                                                    where('vehicleId', '==', vehicle.id),
                                                                    orderBy('date', 'desc'),
                                                                    orderBy('startTime', 'desc'), // Assuming startTime exists or is sortable
                                                                    limit(1)
                                                                );
                                                                const snap = await getDocs(q);
                                                                let newMileage = vehicle.initialMileage || 0;

                                                                if (!snap.empty) {
                                                                    newMileage = snap.docs[0].data().endMileage || 0;
                                                                }

                                                                // Update Vehicle
                                                                await updateDoc(doc(db, 'vehicles', vehicle.id), {
                                                                    lastMileage: newMileage
                                                                });

                                                                alert(`삭제되었습니다. 차량 주행거리가 ${newMileage.toLocaleString()}km 로 변경되었습니다.`);
                                                            } else {
                                                                alert('삭제되었습니다.');
                                                            }

                                                            fetchLogs(vehicle.id);
                                                            fetchVehicle(vehicle.id); // Refresh vehicle info
                                                        } catch (e) {
                                                            console.error(e);
                                                            alert('삭제 실패: ' + e);
                                                        }
                                                    }
                                                }}
                                                className="text-xs text-red-500 hover:text-red-700 underline font-bold"
                                            >
                                                기록 삭제 (관리자)
                                            </button>
                                        ) : (
                                            <div className="flex gap-3">
                                                <button type="button" onClick={() => requestModification(log, 'update')} className="text-xs text-gray-400 hover:text-gray-600 underline">
                                                    수정 요청
                                                </button>
                                                <button type="button" onClick={() => requestModification(log, 'delete')} className="text-xs text-red-400 hover:text-red-600 underline">
                                                    삭제 요청
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                }

                {/* INFO TAB */}
                {
                    activeTab === 'info' && (
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg">차량 정보</h3>
                                {isAdmin && (
                                    <button
                                        onClick={() => alert('차량 정보 수정은 [관리자 페이지 > 차량 관리] 탭에서 가능합니다.\n우측 상단의 "관리자 모드" 버튼을 눌러 이동해주세요.')}
                                        className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg font-bold border"
                                    >
                                        수정 안내
                                    </button>
                                )}
                            </div>

                            <div className="space-y-4 text-sm">
                                <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-500">차량명</span>
                                        <span className="font-bold">{vehicle.name}</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-500">차량번호</span>
                                        <span className="font-bold">{vehicle.plateNumber}</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-500">유종</span>
                                        <span className="font-bold">{vehicle.fuelType}</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-500">승차정원</span> {/* Added Capacity */}
                                        <span className="font-bold">{vehicle.capacity ? `${vehicle.capacity}인승` : '-'}</span>
                                    </div>
                                    <div className="flex justify-between border-b pb-2">
                                        <span className="text-gray-500">누적 주행거리</span>
                                        <span className="font-bold">{vehicle.lastMileage.toLocaleString()} km</span>
                                    </div>
                                    {vehicle.registrationImage && vehicle.registrationImage.length > 0 && (
                                        <div className="flex justify-between items-center border-t pt-2 mt-2">
                                            <span className="text-gray-500">차량등록증</span>
                                            <button
                                                onClick={() => setSelectedImage({
                                                    url: vehicle.registrationImage || '',
                                                    type: vehicle.registrationImageName?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'
                                                })}
                                                className="text-blue-600 text-sm hover:underline flex items-center font-bold"
                                            >
                                                <FileText size={14} className="mr-1" />
                                                파일 보기 (팝업)
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Specs Section */}
                                <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                                    <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">제원 정보</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                                        <InfoItem label="형식" value={vehicle.format} />
                                        <InfoItem label="모델연도" value={vehicle.modelYear} />
                                        <InfoItem label="차대번호" value={vehicle.vin} />
                                        <InfoItem label="원동기형식" value={vehicle.motorType} />
                                        <InfoItem label="제원관리번호" value={vehicle.specMgmtNo} />
                                        <InfoItem label="제원(길이)" value={vehicle.length ? `${vehicle.length}mm` : undefined} />
                                        <InfoItem label="제원(너비)" value={vehicle.width ? `${vehicle.width}mm` : undefined} />
                                        <InfoItem label="제원(높이)" value={vehicle.height ? `${vehicle.height}mm` : undefined} />
                                        <InfoItem label="총중량" value={vehicle.totalWeight ? `${vehicle.totalWeight}kg` : undefined} />
                                        <InfoItem label="배기량" value={vehicle.displacement ? `${vehicle.displacement}cc` : undefined} />
                                        <InfoItem label="정격출력" value={vehicle.power} />
                                        <InfoItem label="승차정원" value={vehicle.capacity ? `${vehicle.capacity}명` : undefined} />
                                        <InfoItem label="최대적재량" value={vehicle.maxLoad ? `${vehicle.maxLoad}kg` : undefined} />
                                        <InfoItem label="기통수" value={vehicle.cylinders} />
                                        <InfoItem label="연료" value={vehicle.fuelType} />
                                        <InfoItem label="연비" value={vehicle.mpg ? `${vehicle.mpg}km/L` : undefined} />
                                    </div>
                                </div>

                                <div className="p-4 bg-blue-50 rounded-xl">
                                    <div className="flex justify-between items-center mb-3 border-b border-blue-200 pb-2">
                                        <h4 className="font-bold text-blue-800">보험 정보</h4>
                                        {vehicle.insurance?.fileUrl && vehicle.insurance.fileName && vehicle.insurance.fileUrl.length > 0 && (
                                            <button
                                                onClick={() => setSelectedImage({
                                                    url: vehicle.insurance.fileUrl || '',
                                                    type: vehicle.insurance.fileName?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'
                                                })}
                                                className="text-blue-600 text-xs hover:underline flex items-center bg-white px-2 py-1 rounded shadow-sm"
                                            >
                                                <FileText size={12} className="mr-1" />
                                                증권 보기 (팝업)
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                                        <InfoItem label="보험사" value={vehicle.insurance?.company} />
                                        <InfoItem label="증권번호" value={vehicle.insurance?.policyNumber} />
                                        <InfoItem label="연락처" value={vehicle.insurance?.contact} />
                                        <InfoItem label="담당자" value={vehicle.insurance?.manager} />
                                        <InfoItem label="보험기간" value={vehicle.insurance?.startDate && vehicle.insurance?.expiryDate ? `${vehicle.insurance.startDate} ~ ${vehicle.insurance.expiryDate}` : vehicle.insurance?.expiryDate} />

                                        <InfoItem label="보험료" value={vehicle.insurance?.premium ? `${vehicle.insurance.premium.toLocaleString()}원` : undefined} />
                                        <InfoItem label="차량가액" value={vehicle.insurance?.vehicleValue ? `${vehicle.insurance.vehicleValue.toLocaleString()}만원` : undefined} />
                                        <InfoItem label="할증기준" value={vehicle.insurance?.surchargeStandard} />

                                        <InfoItem label="운전자한정" value={vehicle.insurance?.driverLimit} />
                                        <InfoItem label="연령한정" value={vehicle.insurance?.ageLimit} />

                                        <InfoItem label="담보구분" value={vehicle.insurance?.coverageType} />
                                        <InfoItem label="가입금액" value={vehicle.insurance?.coverageAmount} />

                                        <InfoItem label="대물배상" value={vehicle.insurance?.propertyDamage} />
                                        <InfoItem label="자차기준" value={vehicle.insurance?.ownDamageType} />
                                        <InfoItem label="무보험차상해" value={vehicle.insurance?.uninsuredInjury} />

                                        <InfoItem label="긴급출동" value={vehicle.insurance?.emergencyDispatch ? `${vehicle.insurance.emergencyDispatch}회` : undefined} />
                                        <InfoItem label="비상급유" value={vehicle.insurance?.emergencyFuel ? `${vehicle.insurance.emergencyFuel}회` : undefined} />
                                        <InfoItem label="견인거리" value={vehicle.insurance?.towingDistance ? `${vehicle.insurance.towingDistance}km` : undefined} />
                                        <InfoItem label="긴급출동Tel" value={vehicle.insurance?.emergencyNumber} />

                                        <div className="md:col-span-2 pt-2 mt-2 border-t border-blue-200">
                                            <div className="flex justify-between items-start">
                                                <span className="text-blue-600 shrink-0 mr-4">기타 특약</span>
                                                <span className="font-bold text-blue-900 text-right break-words flex-1">
                                                    {vehicle.insurance?.otherClauses || (vehicle.insurance?.specialClauses?.length ? vehicle.insurance.specialClauses.join(', ') : '-')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
            {/* Image/PDF Viewer Modal */}
            {selectedImage && (
                <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
                    <div className="relative w-full h-full max-w-5xl max-h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                        <div className="absolute top-0 right-0 p-4 z-10 flex gap-2">
                            {/* Download button removed for security */}
                            <button
                                onClick={() => setSelectedImage(null)}
                                className="bg-white text-gray-800 p-2 rounded-full hover:bg-red-100 text-red-500 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {selectedImage.type === 'pdf' ? (
                            <iframe
                                src={selectedImage.url}
                                className="w-full h-full bg-white rounded-lg shadow-2xl"
                                title="Document Viewer"
                            />
                        ) : (
                            <img
                                src={selectedImage.url}
                                alt="Large view"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Alert Modal */}
            <AlertModal
                isOpen={alertModal.isOpen}
                title={alertModal.title}
                message={alertModal.message}
                type={alertModal.type}
                details={alertModal.details}
                onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
            />

            {/* Success Modal */}
            <SuccessModal
                isOpen={successModal.isOpen}
                message={successModal.message}
                onClose={() => setSuccessModal({ ...successModal, isOpen: false })}
            />

            {/* Reason Modal */}
            <ReasonModal
                isOpen={reasonModal.isOpen}
                title={reasonModal.title}
                message={reasonModal.type === 'update' ? "수정 요청 사유를 상세히 적어주세요." : "삭제하려는 사유를 적어주세요."}
                onSubmit={handleReasonSubmit}
                onClose={() => setReasonModal(prev => ({ ...prev, isOpen: false }))}
            />

            {/* My Requests List Modal */}
            <MyRequestsModal
                isOpen={myRequestsModalOpen}
                onClose={() => setMyRequestsModalOpen(false)}
                userEmail={user?.email || ''}
            />


        </div>
    );
};

export default DrivingLogPage;
