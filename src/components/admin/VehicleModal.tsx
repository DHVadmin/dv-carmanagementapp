import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, History, Camera, Trash2 } from 'lucide-react';
import type { Vehicle, InsuranceRecord, SystemSettings } from '../../types';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../firebase';
import ConfirmModal from '../common/ConfirmModal';


interface VehicleModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle: Partial<Vehicle>;
    onSave: (vehicle: Partial<Vehicle>, imageFile: File | null) => Promise<void>;
    settings?: SystemSettings; // For consumables warnings if needed
    consumableSettings?: any[];
}

export const VehicleModal: React.FC<VehicleModalProps> = ({ isOpen, onClose, vehicle, onSave, consumableSettings = [] }) => {


    const [activeTab, setActiveTab] = useState<'basic' | 'specs' | 'insurance' | 'consumables'>('basic');
    const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle>>({ ...vehicle });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
    const [registrationFile, setRegistrationFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // 3. Image View Popup State
    const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

    // 4. Confirm Modal State
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDestructive?: boolean;
        confirmText?: string;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        // Ensure insurance object exists to prevent errors
        setEditingVehicle({
            ...vehicle,
            insurance: vehicle.insurance || {
                company: '',
                contact: '',
                method: '',
                policyNumber: '',
                manager: '',
                emergencyNumber: '',
                startDate: '',
                expiryDate: '',
                premium: 0,
                vehicleValue: 0,
                propertyDamage: '',
                uninsuredInjury: '',
                ownDamageType: '',
                coverageType: '',
                coverageAmount: '',
                ageLimit: '',
                driverLimit: '',
                emergencyDispatch: 0,
                emergencyFuel: 0,
                towingDistance: 0,
                otherClauses: ''
            }
        });
        setImageFile(null);
        setInsuranceFile(null);
        setRegistrationFile(null);
    }, [vehicle, isOpen]);

    // --- Handlers ---
    const handleSave = async () => {
        setUploading(true);
        try {
            // Upload Insurance File if exists
            let insuranceFileUrl = editingVehicle.insurance?.fileUrl;
            let insuranceFileName = editingVehicle.insurance?.fileName;

            if (insuranceFile) {
                // Delete old file if exists
                if (editingVehicle.insurance?.fileUrl) {
                    try {
                        const oldRef = ref(storage, editingVehicle.insurance.fileUrl);
                        await deleteObject(oldRef);
                    } catch (e) {
                        console.warn("Failed to delete old insurance file", e);
                    }
                }
                const storageRef = ref(storage, `insurance/${editingVehicle.id || 'new'}/${Date.now()}_${insuranceFile.name}`);
                await uploadBytes(storageRef, insuranceFile);
                insuranceFileUrl = await getDownloadURL(storageRef);
                insuranceFileName = insuranceFile.name;
            }

            // Upload Registration File if exists
            let registrationFileUrl = editingVehicle.registrationImage;
            let registrationFileName = editingVehicle.registrationImageName;

            if (registrationFile) {
                // Delete old file if exists
                if (editingVehicle.registrationImage) {
                    try {
                        const oldRef = ref(storage, editingVehicle.registrationImage);
                        await deleteObject(oldRef);
                    } catch (e) {
                        console.warn("Failed to delete old registration file", e);
                    }
                }
                const storageRef = ref(storage, `registration/${editingVehicle.id || 'new'}/${Date.now()}_${registrationFile.name}`);
                await uploadBytes(storageRef, registrationFile);
                registrationFileUrl = await getDownloadURL(storageRef);
                registrationFileName = registrationFile.name;
            } else if (!editingVehicle.registrationImage && vehicle.registrationImage) {
                // Case: User deleted the file (state is null, but original had it)
                try {
                    const oldRef = ref(storage, vehicle.registrationImage);
                    await deleteObject(oldRef);
                } catch (e) {
                    console.warn("Failed to delete removed registration file", e);
                }
                registrationFileUrl = null;
                registrationFileName = null;
            }

            // Handle Insurance File Deletion (Manual removal)
            if (!insuranceFile && !editingVehicle.insurance?.fileUrl && vehicle.insurance?.fileUrl) {
                try {
                    const oldRef = ref(storage, vehicle.insurance.fileUrl);
                    await deleteObject(oldRef);
                } catch (e) {
                    console.warn("Failed to delete removed insurance file", e);
                }
                insuranceFileUrl = null;
                insuranceFileName = null;
            }

            // Update Vehicle object with new file info
            const updatedVehicle = {
                ...editingVehicle,
                insurance: {
                    ...(editingVehicle.insurance || {} as InsuranceRecord),
                    fileUrl: insuranceFileUrl,
                    fileName: insuranceFileName
                },
                registrationImage: registrationFileUrl,
                registrationImageName: registrationFileName
            };

            await onSave(updatedVehicle, imageFile);
        } catch (error: any) {
            console.error("Save Error:", error);
            alert(`저장 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleRenewInsurance = () => {
        setConfirmModal({
            isOpen: true,
            title: '보험 갱신',
            message: "현재 보험 정보를 '보험 이력'으로 이동하고, 새로운 갱신을 시작하시겠습니까?",
            confirmText: '갱신 시작',
            isDestructive: false,
            onConfirm: () => {
                // Ensure insurance object exists (even if empty)
                const currentInsurance = editingVehicle.insurance || {} as InsuranceRecord;

                const history = editingVehicle.insuranceHistory || [];
                // Only archive if there is meaningful data (e.g. company or expiry date set)
                let updatedHistory = history;
                if (currentInsurance.company || currentInsurance.expiryDate) {
                    updatedHistory = [...history, { ...currentInsurance, expiryDate: currentInsurance.expiryDate || 'Unknown' }];
                }

                setEditingVehicle({
                    ...editingVehicle,
                    insuranceHistory: updatedHistory,
                    insurance: {
                        ...currentInsurance, // Keep basic info structure
                        startDate: '',
                        expiryDate: '',
                        premium: 0,
                        fileUrl: null, // Clear file
                        fileName: null
                    }
                });
                setConfirmModal({ ...confirmModal, isOpen: false });
                alert("이전 보험 정보가 이력에 저장(또는 초기화)되었습니다. 새 정보를 입력하세요.");
            }
        });
    };






    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b flex justify-between items-center bg-slate-800 text-white">
                    <h2 className="text-xl font-bold flex items-center">
                        {editingVehicle.id ? '차량 정보 수정' : '신규 차량 등록'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition"><X size={24} /></button>
                </div>

                {/* Tabs */}
                <div className="flex bg-gray-100 border-b">
                    {['basic', 'specs', 'insurance', 'consumables'].map(t => (
                        <button
                            key={t}
                            className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === t ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:bg-gray-200'}`}
                            onClick={() => setActiveTab(t as any)}
                        >
                            {t === 'basic' && '기본 정보'}
                            {t === 'specs' && '제원 정보'}
                            {t === 'insurance' && '보험 정보'}
                            {t === 'consumables' && '소모품 관리'}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">

                    {/* --- BASIC TAB --- */}
                    {activeTab === 'basic' && (
                        <div className="space-y-6">
                            <div className="flex justify-center">
                                <div className="relative w-40 h-40 bg-gray-200 rounded-full flex items-center justify-center border-4 border-white shadow overflow-hidden group">
                                    {imageFile ? (
                                        <img src={URL.createObjectURL(imageFile)} className="w-full h-full object-cover" />
                                    ) : editingVehicle.imageUrl ? (
                                        <img src={editingVehicle.imageUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <Camera className="text-gray-400 w-12 h-12" />
                                    )}
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all cursor-pointer">
                                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                                        <span className="text-white opacity-0 group-hover:opacity-100 font-bold text-sm">사진 변경</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="차량명 (필수)" value={editingVehicle.name} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, name: v })} required />
                                <Input label="차량번호 (필수)" value={editingVehicle.plateNumber} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, plateNumber: v })} required />
                                <Input label="최초등록일" type="date" value={editingVehicle.initialRegistrationDate} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, initialRegistrationDate: v })} />
                                <Input label="최초등록 누적거리 (km)" type="number" value={editingVehicle.initialMileage} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, initialMileage: Number(v) })} placeholder="0" />
                                <Input label="현재 누적주행거리 (km)" type="number" value={editingVehicle.lastMileage} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, lastMileage: Number(v) })} placeholder="0" />
                                <Input label="차종" value={editingVehicle.vehicleType} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, vehicleType: v })} />
                                <Input label="용도" value={editingVehicle.usage} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, usage: v })} />
                                <Input label="소유자 명칭" value={editingVehicle.ownerName} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, ownerName: v })} />
                                <Input label="법인등록번호" value={editingVehicle.corporateRegNo} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, corporateRegNo: v })} />
                                <Input label="주소" value={editingVehicle.ownerAddress} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, ownerAddress: v })} className="md:col-span-2" />
                            </div>
                        </div>
                    )}

                    {/* --- SPECS TAB --- */}
                    {activeTab === 'specs' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <Input label="형식" value={editingVehicle.format} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, format: v })} />
                                <Input label="모델연도" value={editingVehicle.modelYear} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, modelYear: v })} />
                                <Input label="차대번호" value={editingVehicle.vin} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, vin: v })} />
                                <Input label="원동기형식" value={editingVehicle.motorType} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, motorType: v })} />
                                <Input label="제원관리번호" value={editingVehicle.specMgmtNo} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, specMgmtNo: v })} />
                                <Input label="길이(mm)" type="number" value={editingVehicle.length} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, length: Number(v) })} />
                                <Input label="너비(mm)" type="number" value={editingVehicle.width} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, width: Number(v) })} />
                                <Input label="높이(mm)" type="number" value={editingVehicle.height} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, height: Number(v) })} />
                                <Input label="총중량(kg)" type="number" value={editingVehicle.totalWeight} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, totalWeight: Number(v) })} />
                                <Input label="배기량(cc)" type="number" value={editingVehicle.displacement} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, displacement: Number(v) })} />
                                <Input label="정격출력" value={editingVehicle.power} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, power: v })} />
                                <Input label="승차정원" type="number" value={editingVehicle.capacity} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, capacity: Number(v) })} />
                                <Input label="최대적재량" type="number" value={editingVehicle.maxLoad} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, maxLoad: Number(v) })} />
                                <Input label="기통수" type="number" value={editingVehicle.cylinders} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, cylinders: Number(v) })} />
                                <Select label="연료" value={editingVehicle.fuelType || '휘발유'} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, fuelType: v })} options={['휘발유', '경유', 'LPG', '전기', '하이브리드', '수소']} />
                                <Input label="연비 (km/L)" type="number" value={editingVehicle.mpg} onChange={(v: string) => setEditingVehicle({ ...editingVehicle, mpg: Number(v) })} />
                            </div>

                            <div className="bg-gray-50 p-4 rounded-lg border">
                                <h4 className="font-bold text-gray-700 mb-2">차량등록증 파일</h4>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <label className="cursor-pointer bg-white border px-3 py-2 rounded text-sm font-bold hover:bg-gray-50 flex items-center">
                                            <Upload size={16} className="mr-2" />
                                            파일 선택
                                            <input type="file" accept="image/jpeg, image/png, image/jpg" className="hidden" onChange={e => {
                                                setRegistrationFile(e.target.files?.[0] || null);
                                                // Clear existing URL if new file picked (visual feedback)
                                                // Actually logic prefers keeping it until save, but we can show name
                                            }} />
                                        </label>
                                        <div className="flex flex-col">
                                            <span className="text-sm text-gray-600">
                                                {registrationFile ? registrationFile.name : editingVehicle.registrationImageName || "선택된 파일 없음"}
                                            </span>
                                            {/* Preview Button */}
                                            {(editingVehicle.registrationImage || registrationFile) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (registrationFile) {
                                                            setPreviewImage({ url: URL.createObjectURL(registrationFile), title: '차량등록증 (미리보기)' });
                                                        } else if (editingVehicle.registrationImage) {
                                                            setPreviewImage({ url: editingVehicle.registrationImage, title: '차량등록증' });
                                                        }
                                                    }}
                                                    className="text-blue-600 text-xs hover:underline flex items-center mt-1"
                                                >
                                                    <FileText size={12} className="mr-1" />
                                                    이미지 보기
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Delete Button */}
                                    {(editingVehicle.registrationImage || registrationFile) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setConfirmModal({
                                                    isOpen: true,
                                                    title: '파일 삭제',
                                                    message: "등록된 파일을 삭제하시겠습니까? (저장 시 반영됩니다)",
                                                    confirmText: '삭제',
                                                    isDestructive: true,
                                                    onConfirm: () => {
                                                        setRegistrationFile(null);
                                                        setEditingVehicle({ ...editingVehicle, registrationImage: null as any, registrationImageName: null as any });
                                                        setConfirmModal({ ...confirmModal, isOpen: false });
                                                    }
                                                });
                                            }}
                                            className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50"
                                            title="파일 삭제"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- INSURANCE TAB --- */}
                    {activeTab === 'insurance' && (
                        <div className="space-y-6">
                            {/* Actions */}
                            {/* File Upload & Preview */}
                            <div className="bg-gray-50 p-4 rounded-lg flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="font-bold text-sm text-gray-700">보험 증권 파일</div>
                                    <div className="text-xs text-gray-500">{insuranceFile ? insuranceFile.name : editingVehicle.insurance?.fileName || '업로드된 파일 없음'}</div>
                                    {(editingVehicle.insurance?.fileUrl && editingVehicle.insurance.fileName && editingVehicle.insurance.fileUrl.length > 0) || insuranceFile ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (insuranceFile) {
                                                    setPreviewImage({ url: URL.createObjectURL(insuranceFile), title: '보험 증권 (미리보기)' });
                                                } else if (editingVehicle.insurance?.fileUrl) {
                                                    setPreviewImage({ url: editingVehicle.insurance.fileUrl, title: '보험 증권' });
                                                }
                                            }}
                                            className="text-blue-600 text-xs hover:underline flex items-center"
                                        >
                                            <FileText size={12} className="mr-1" />
                                            이미지 보기
                                        </button>
                                    ) : null}
                                </div>
                                <div className="flex items-center space-x-2">
                                    <label className="bg-white border text-gray-700 px-3 py-2 rounded-lg text-sm font-bold cursor-pointer hover:bg-gray-100 flex items-center shadow-sm">
                                        <Upload size={16} className="mr-2" />
                                        파일 선택
                                        <input type="file" accept="image/jpeg, image/png, image/jpg" className="hidden" onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) setInsuranceFile(f);
                                        }} />
                                    </label>

                                    {/* Delete Button - Only show if fileUrl is valid string AND fileName exists */}
                                    {((editingVehicle.insurance?.fileUrl && editingVehicle.insurance.fileName && editingVehicle.insurance.fileUrl.length > 0) || insuranceFile) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                console.log('Delete Button Clicked (Insurance)');
                                                setConfirmModal({
                                                    isOpen: true,
                                                    title: '파일 삭제',
                                                    message: "증권 파일을 삭제하시겠습니까? (저장 시 반영됩니다)",
                                                    confirmText: '삭제',
                                                    isDestructive: true,
                                                    onConfirm: () => {
                                                        setInsuranceFile(null);
                                                        updateInsurance('fileUrl', null);
                                                        updateInsurance('fileName', null);
                                                        setConfirmModal({ ...confirmModal, isOpen: false });
                                                    }
                                                });
                                            }}
                                            className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50"
                                            title="파일 삭제"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation(); // Prevent bubbling
                                            e.preventDefault();
                                            setShowHistory(true);
                                        }}
                                        className="text-gray-500 hover:text-gray-700 p-2 border rounded hover:bg-white"
                                        title="보험 이력 보기"
                                    >
                                        <History />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="보험사" value={editingVehicle.insurance?.company} onChange={(v: string) => updateInsurance('company', v)} />
                                <Input label="연락처" value={editingVehicle.insurance?.contact} onChange={(v: string) => updateInsurance('contact', v)} />
                                <Input label="상품명/가입방법" value={editingVehicle.insurance?.method} onChange={(v: string) => updateInsurance('method', v)} />
                                <Input label="증권번호" value={editingVehicle.insurance?.policyNumber} onChange={(v: string) => updateInsurance('policyNumber', v)} />
                                <Input label="담당자" value={editingVehicle.insurance?.manager} onChange={(v: string) => updateInsurance('manager', v)} />
                                <Input label="긴급출동 번호" value={editingVehicle.insurance?.emergencyNumber} onChange={(v: string) => updateInsurance('emergencyNumber', v)} placeholder="예: 1588-0000" />

                                <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                                    <Input type="date" label="보험 시작일" value={editingVehicle.insurance?.startDate} onChange={(v: string) => updateInsurance('startDate', v)} />
                                    <Input type="date" label="보험 만기일" value={editingVehicle.insurance?.expiryDate} onChange={(v: string) => updateInsurance('expiryDate', v)} />
                                </div>

                                <div className="md:col-span-2 border-t pt-4 mt-2">
                                    <h4 className="font-bold text-gray-700 mb-3">담보 및 보장 내용</h4>
                                </div>

                                <Input label="보험료 (원)" type="number" value={editingVehicle.insurance?.premium} onChange={(v: string) => updateInsurance('premium', Number(v))} />
                                <Input label="차량가액 (만원)" type="number" value={editingVehicle.insurance?.vehicleValue} onChange={(v: string) => updateInsurance('vehicleValue', Number(v))} />

                                <Input label="대물배상 (억)" value={editingVehicle.insurance?.propertyDamage} onChange={(v: string) => updateInsurance('propertyDamage', v)} placeholder="예: 10억" />
                                <Input label="무보험차상해 (억)" value={editingVehicle.insurance?.uninsuredInjury} onChange={(v: string) => updateInsurance('uninsuredInjury', v)} placeholder="예: 2억" />
                                <Input label="자차기준 (만원)" value={editingVehicle.insurance?.ownDamageType} onChange={(v: string) => updateInsurance('ownDamageType', v)} placeholder="단독/포함" />
                                <Input label="담보구분" value={editingVehicle.insurance?.coverageType} onChange={(v: string) => updateInsurance('coverageType', v)} placeholder="종합/책임" />
                                <Input label="가입액" value={editingVehicle.insurance?.coverageAmount} onChange={(v: string) => updateInsurance('coverageAmount', v)} placeholder="무한" />

                                <Input label="연령한정 (만)" value={editingVehicle.insurance?.ageLimit} onChange={(v: string) => updateInsurance('ageLimit', v)} placeholder="만 30세 이상" />
                                <Input label="운전자한정" value={editingVehicle.insurance?.driverLimit} onChange={(v: string) => updateInsurance('driverLimit', v)} placeholder="부부한정, 임직원 등" />

                                <div className="md:col-span-2 grid grid-cols-3 gap-4">
                                    <Input label="긴급출동 (회)" type="number" value={editingVehicle.insurance?.emergencyDispatch} onChange={(v: string) => updateInsurance('emergencyDispatch', Number(v))} />
                                    <Input label="비상급유 (회)" type="number" value={editingVehicle.insurance?.emergencyFuel} onChange={(v: string) => updateInsurance('emergencyFuel', Number(v))} />
                                    <Input label="견인거리 (KM)" type="number" value={editingVehicle.insurance?.towingDistance} onChange={(v: string) => updateInsurance('towingDistance', Number(v))} />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 mb-1">기타 특약</label>
                                    <textarea
                                        className="w-full p-2 border rounded-lg text-sm h-20"
                                        value={editingVehicle.insurance?.otherClauses || ''}
                                        onChange={e => updateInsurance('otherClauses', e.target.value)}
                                        placeholder="추가 특약 사항을 입력하세요."
                                    />
                                </div>
                            </div>

                            <button type="button" onClick={handleRenewInsurance} className="w-full py-3 bg-gray-800 text-white rounded-lg font-bold hover:bg-black transition">
                                보험 갱신 (이력 저장)
                            </button>
                        </div>
                    )}


                    {/* --- CONSUMABLES TAB --- */}
                    {activeTab === 'consumables' && (
                        <div className="space-y-4">
                            {consumableSettings.length === 0 && <p className="text-gray-400 text-center py-8">설정된 소모품 관리 항목이 없습니다.</p>}
                            {consumableSettings.map((setting, idx) => {
                                const currentStatus = editingVehicle.consumables?.[setting.label];
                                const lastMileage = currentStatus?.lastMileage || 0;
                                const currentMileage = editingVehicle.lastMileage || 0;
                                const distDriven = Math.max(0, currentMileage - lastMileage);
                                const distRatio = setting.distance > 0 ? Math.min(distDriven / setting.distance, 1) : 0;

                                // Time Check Logic
                                let isTimeWarning = false;
                                let remainingDaysText = '';

                                if (setting.months > 0 && currentStatus?.lastDate) {
                                    const lastDate = new Date(currentStatus.lastDate);
                                    const nextDueDate = new Date(lastDate);
                                    nextDueDate.setMonth(nextDueDate.getMonth() + setting.months);

                                    const today = new Date();
                                    // const totalDays = setting.months * 30; // Approx
                                    const diffTime = nextDueDate.getTime() - today.getTime();
                                    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                    remainingDaysText = remainingDays > 0 ? `${remainingDays}일 남음` : `${Math.abs(remainingDays)}일 지남`;

                                    // Warning if less than 30 days (or 1 month worth of ratio)
                                    // Using 0.9 ratio as approx trigger or fixed 30 days
                                    // const daysPassed = (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
                                    // timeRatio = Math.min(daysPassed / totalDays, 1);

                                    if (remainingDays <= 30) isTimeWarning = true;
                                }

                                const isWarning = distRatio >= 0.9 || isTimeWarning;

                                return (
                                    <div key={idx} className="bg-gray-50 p-4 rounded-lg border">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-gray-700">
                                                {setting.label}
                                                <span className="text-xs font-normal text-gray-500 ml-2">
                                                    ({setting.distance}km / {setting.months}개월)
                                                </span>
                                            </h4>
                                            <span className={`text-xs font-bold px-2 py-1 rounded ${isWarning ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                {isWarning ? '점검 필요' : '정상'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-2">
                                            <div>
                                                <Input label={`마지막 교체일 ${remainingDaysText ? `(${remainingDaysText})` : ''}`}
                                                    type="date"
                                                    value={currentStatus?.lastDate}
                                                    onChange={(v: string) => {
                                                        const updated = { ...editingVehicle.consumables, [setting.label]: { ...currentStatus, lastDate: v } };
                                                        setEditingVehicle({ ...editingVehicle, consumables: updated });
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <Input label={`교체 주행거리 (${setting.distance}km 주기)`}
                                                    type="number"
                                                    value={currentStatus?.lastMileage}
                                                    onChange={(v: string) => {
                                                        const updated = { ...editingVehicle.consumables, [setting.label]: { ...currentStatus, lastMileage: Number(v) } };
                                                        setEditingVehicle({ ...editingVehicle, consumables: updated });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t flex justify-end space-x-3">
                    <button onClick={onClose} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200">취소</button>
                    <button onClick={handleSave} disabled={uploading} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg disabled:bg-blue-300">
                        {uploading ? '저장 중...' : '저장하기'}
                    </button>
                </div>
            </div>

            {/* History Modal (Nested) */}
            {showHistory && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between mb-4">
                            <h3 className="font-bold text-lg">보험 갱신 이력</h3>
                            <button onClick={() => setShowHistory(false)}><X /></button>
                        </div>
                        <div className="space-y-3">
                            {(!editingVehicle.insuranceHistory || editingVehicle.insuranceHistory.length === 0) && <p className="text-gray-400">이력이 없습니다.</p>}
                            {editingVehicle.insuranceHistory?.map((h, i) => (
                                <div key={i} className="border p-3 rounded bg-gray-50 text-sm">
                                    <div className="font-bold">{h.company} ({h.expiryDate} 만기)</div>
                                    <div className="text-gray-500">보험료: {h.premium?.toLocaleString()}원</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[70] p-4" onClick={() => setPreviewImage(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] bg-transparent flex flex-col items-center">
                        <div className="absolute top-4 right-4 z-10">
                            <button onClick={() => setPreviewImage(null)} className="text-white hover:text-gray-300 p-2 bg-black bg-opacity-50 rounded-full">
                                <X size={24} />
                            </button>
                        </div>
                        <img src={previewImage.url} alt={previewImage.title} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
                        <p className="text-white mt-4 font-bold text-lg">{previewImage.title}</p>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                confirmText={confirmModal.confirmText}
                isDestructive={confirmModal.isDestructive}
                onConfirm={confirmModal.onConfirm}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            />
        </div>
    );

    // Helper Functions
    function updateInsurance(field: keyof InsuranceRecord, value: any) {
        setEditingVehicle({
            ...editingVehicle,
            insurance: {
                ...(editingVehicle.insurance || {} as InsuranceRecord),
                [field]: value
            }
        });
    }
};

// UI Components
const Input = ({ label, value, onChange, type = 'text', required = false, placeholder, className }: any) => (
    <div className={className}>
        <label className="block text-xs font-bold text-gray-500 mb-1">{label} {required && '*'}</label>
        <input
            type={type}
            value={value === undefined || value === null ? '' : value}
            onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder={placeholder}
        />
    </div>
);

const Select = ({ label, value, onChange, options }: any) => (
    <div>
        <label className="block text-xs font-bold text-gray-500 mb-1">{label}</label>
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        >
            {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
    </div>
);
