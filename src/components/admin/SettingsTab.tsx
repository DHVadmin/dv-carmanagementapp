import React, { useState } from 'react';
import { Settings, MapPin, Wrench, MessageSquare, FileText, Trash2, Plus, Fuel, Image, AlertTriangle } from 'lucide-react';
import { doc, setDoc, collection, query, where, getDocs, updateDoc, deleteField } from 'firebase/firestore';
import { db, storage } from '../../firebase';
import { ref, deleteObject } from 'firebase/storage';
import { getLocalDateString } from '../../utils/dateUtils';

interface SettingsTabProps {
    settings: any; // Using any for flexibility or SystemSettings
    onUpdate: () => void;
    onOpenSlackManual?: () => void;
    onOpenSheetManual?: () => void;
    onOpenBusinessTripManual?: () => void;
    onCheckConsumables?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onUpdate, onOpenSlackManual, onOpenSheetManual, onOpenBusinessTripManual, onCheckConsumables }) => {
    // Local state for inputs
    const [newItem, setNewItem] = useState<{ [key: string]: string }>({});

    // Config section states
    // Config section states
    const [slackWebhook, setSlackWebhook] = useState(settings.slackWebhook || '');
    const [btSlackWebhook, setBtSlackWebhook] = useState(settings.businessTripSlackWebhook || '');
    const [consumableWebhook, setConsumableWebhook] = useState(settings.consumableSlackWebhook || '');
    const [isSlackEditing, setIsSlackEditing] = useState(false);

    const [sheetUrl, setSheetUrl] = useState(settings.sheetConfig?.url || '');
    const [isSheetEditing, setIsSheetEditing] = useState(false);

    const [businessTripSheetUrl, setBusinessTripSheetUrl] = useState(settings.businessTripConfig?.url || '');
    const [isBusinessTripEditing, setIsBusinessTripEditing] = useState(false);

    // Generic Add Helper
    const handleAdd = async (field: string, value: string) => {
        if (!value?.trim()) return;
        const currentList = settings[field] || [];
        const updated = [...currentList, value.trim()];
        await updateSettings({ [field]: updated });
        setNewItem({ ...newItem, [field]: '' });
    };

    // Generic Delete Helper
    const handleDelete = async (field: string, value: string) => {
        if (!confirm(`'${value}' 항목을 삭제하시겠습니까?`)) return;
        const currentList = settings[field] || [];
        const updated = currentList.filter((item: string) => item !== value);
        await updateSettings({ [field]: updated });
    };

    // Update Firestore
    const updateSettings = async (data: any) => {
        try {
            await setDoc(doc(db, 'settings', 'global'), data, { merge: true });
            await onUpdate(); // Trigger refetch in parent and wait for completion
        } catch (e) {
            console.error(e);
            alert("설정 저장 실패");
        }
    };

    // Specific Handlers for detailed objects (Consumables)
    const [newConsumable, setNewConsumable] = useState({ label: '', distance: 0, months: 0 });
    const handleAddConsumable = async () => {
        if (!newConsumable.label) return alert("이름을 입력하세요.");
        const current = settings.consumableSettings || [];
        const updated = [...current, newConsumable];
        await updateSettings({ consumableSettings: updated });
        setNewConsumable({ label: '', distance: 0, months: 0 });
    };
    const handleDeleteConsumable = async (idx: number) => {
        const updated = settings.consumableSettings.filter((_: any, i: number) => i !== idx);
        await updateSettings({ consumableSettings: updated });
    };

    return (
        <div className="space-y-6">

            {/* 1. DRIVING: Purposes & Waypoints */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SimpleListCard
                    title="운행 목적"
                    icon={<Settings size={18} />}
                    items={settings.drivingPurposes || []}
                    onAdd={(v: string) => handleAdd('drivingPurposes', v)}
                    onDelete={(v: string) => handleDelete('drivingPurposes', v)}
                    placeholder="예: 출퇴근"
                />
                <SimpleListCard
                    title="자주 가는 경유지/목적지"
                    icon={<MapPin size={18} />}
                    items={settings.drivingDestinations || []} // Mapping to same field for now
                    onAdd={(v: string) => handleAdd('drivingDestinations', v)}
                    onDelete={(v: string) => handleDelete('drivingDestinations', v)}
                    placeholder="예: 서울 본사"
                />
            </div>

            {/* 2. MAINTENANCE: Shops & Gas Stations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SimpleListCard
                    title="자주 가는 정비소"
                    icon={<Wrench size={18} />}
                    items={settings.maintenanceShops || []}
                    onAdd={(v: string) => handleAdd('maintenanceShops', v)}
                    onDelete={(v: string) => handleDelete('maintenanceShops', v)}
                    placeholder="예: 블루핸즈 역삼점"
                />
                <SimpleListCard
                    title="자주 가는 주유소"
                    icon={<Fuel size={18} />}
                    items={settings.gasStations || []}
                    onAdd={(v: string) => handleAdd('gasStations', v)}
                    onDelete={(v: string) => handleDelete('gasStations', v)}
                    placeholder="예: SK엔크린"
                />
                <div className="md:col-span-2">
                    <SimpleListCard
                        title="정비 항목 관리"
                        icon={<Settings size={18} />}
                        items={settings.maintenanceItems || []}
                        onAdd={(v: string) => handleAdd('maintenanceItems', v)}
                        onDelete={(v: string) => handleDelete('maintenanceItems', v)}
                        placeholder="예: 엔진오일, 타이어, 배터리, 와이퍼 등"
                    />
                </div>
            </div>

            {/* 3. CONSUMABLES */}
            <div className="bg-white rounded-xl shadow p-6 border-t-4 border-orange-500">
                <h3 className="font-bold text-lg mb-4 flex items-end justify-between text-orange-700">
                    <div className="flex items-center">
                        <Wrench className="mr-2" size={20} /> 소모품 교체 주기 관리
                    </div>
                    <button
                        onClick={() => {
                            if (onCheckConsumables) onCheckConsumables();
                            else alert("알림 체크 함수가 연결되지 않았습니다.");
                        }}
                        className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded hover:bg-orange-200"
                    >
                        🔔 알림 강제 실행
                    </button>
                </h3>


                <div className="flex flex-wrap gap-2 mb-4 items-end bg-gray-50 p-3 rounded-lg">
                    <div className="flex-1 min-w-[120px]">
                        <label className="text-xs text-gray-500 block mb-1">항목명</label>
                        <input value={newConsumable.label} onChange={(e) => setNewConsumable({ ...newConsumable, label: e.target.value })} className="w-full p-2 border rounded" placeholder="예: 엔진오일" />
                    </div>
                    <div className="w-24">
                        <label className="text-xs text-gray-500 block mb-1">거리(km)</label>
                        <input type="number" value={newConsumable.distance} onChange={(e) => setNewConsumable({ ...newConsumable, distance: Number(e.target.value) })} className="w-full p-2 border rounded" />
                    </div>
                    <div className="w-24">
                        <label className="text-xs text-gray-500 block mb-1">기간(개월)</label>
                        <input type="number" value={newConsumable.months} onChange={(e) => setNewConsumable({ ...newConsumable, months: Number(e.target.value) })} className="w-full p-2 border rounded" />
                    </div>
                    <button onClick={handleAddConsumable} className="bg-slate-800 text-white px-4 py-2 rounded font-bold">추가</button>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {(settings.consumableSettings || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center border p-3 rounded hover:bg-gray-50">
                            <div>
                                <span className="font-bold mr-2">{item.label}</span>
                                <span className="text-sm text-gray-500">{item.distance}km / {item.months}개월</span>
                            </div>
                            <button onClick={() => handleDeleteConsumable(idx)} className="text-red-500"><Trash2 size={16} /></button>
                        </div>
                    ))}
                </div>
            </div>


            {/* 4. MAINTENANCE MODE Config */}
            <div className="bg-white rounded-xl shadow p-6 border-t-4 border-yellow-500">
                <h3 className="font-bold text-lg mb-4 flex items-center text-yellow-700">
                    <AlertTriangle className="mr-2" size={20} /> 앱 점검 모드 설정
                </h3>
                <MaintenanceConfigForm
                    settings={settings.maintenance}
                    onSave={async (newConfig: any) => await updateSettings({ maintenance: newConfig })}
                />
            </div>

            {/* 5. IMAGE RESIZING */}
            <div className="bg-white rounded-xl shadow p-6 border-t-4 border-cyan-500">
                <h3 className="font-bold text-lg mb-4 flex items-center text-cyan-700">
                    <Image className="mr-2" size={20} /> 이미지 업로드 설정 (리사이징)
                </h3>
                <ImageResizeConfigForm
                    settings={settings.imageResizeConfig}
                    onSave={async (newConfig: any) => await updateSettings({ imageResizeConfig: newConfig })}
                />
            </div>

            {/* Storage Management */}
            <div className="bg-white rounded-xl shadow p-6 border-t-4 border-red-500 mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <Trash2 className="w-5 h-5 text-red-600" />
                    <h2 className="text-lg font-bold text-red-700">저장소 용량 관리</h2>
                </div>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                    <p className="text-sm text-gray-700 mb-4 font-medium">
                        오래된 주유/정비 기록의 이미지를 삭제하여 저장소 용량을 확보할 수 있습니다.<br />
                        <span className="text-red-500 text-xs mt-1 block">⚠️ 저장된 기록 텍스트는 유지되지만, 이미지는 복구할 수 없습니다.</span>
                    </p>
                    <StorageCleanupButton />
                </div>
            </div>

            {/* 5. INTEGRATIONS: Slack & Sheets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Slack */}
                <div className="bg-white rounded-xl shadow p-6 border-t-4 border-purple-500">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold flex items-center text-purple-700"><MessageSquare className="mr-2" /> Slack 알림 설정</h3>
                        <button onClick={onOpenSlackManual} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold hover:bg-purple-200">매뉴얼</button>
                    </div>

                    {/* Webhook URL */}
                    <div className="mb-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">통합 알림 Webhook URL (기본)</label>
                            <input
                                disabled={!isSlackEditing}
                                value={slackWebhook}
                                onChange={(e) => setSlackWebhook(e.target.value)}
                                className={`w-full p-2 border rounded ${isSlackEditing ? 'bg-white' : 'bg-gray-100'}`}
                                placeholder="https://hooks.slack.com/services/..."
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">관내출장 전용 알림 Webhook URL</label>
                            <input
                                disabled={!isSlackEditing}
                                value={btSlackWebhook}
                                onChange={(e) => setBtSlackWebhook(e.target.value)}
                                className={`w-full p-2 border rounded ${isSlackEditing ? 'bg-white' : 'bg-gray-100'} border-purple-200`}
                                placeholder="관내출장 전용 (비워두면 기본값 사용)"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">소모품 알림 전용 Webhook URL</label>
                            <input
                                disabled={!isSlackEditing}
                                value={consumableWebhook}
                                onChange={(e) => setConsumableWebhook(e.target.value)}
                                className={`w-full p-2 border rounded ${isSlackEditing ? 'bg-white' : 'bg-gray-100'} border-purple-200`}
                                placeholder="소모품 알림 전용 (비워두면 기본값 사용)"
                            />
                        </div>

                        <div className="flex justify-end">
                            {isSlackEditing ? (
                                <div className="flex gap-1">
                                    <button onClick={() => {
                                        updateSettings({
                                            slackWebhook,
                                            businessTripSlackWebhook: btSlackWebhook,
                                            consumableSlackWebhook: consumableWebhook
                                        });
                                        setIsSlackEditing(false);
                                    }} className="px-3 py-1 bg-purple-600 text-white rounded font-bold text-sm">저장</button>
                                    <button onClick={() => setIsSlackEditing(false)} className="px-3 py-1 bg-gray-200 rounded font-bold text-sm">취소</button>
                                </div>
                            ) : (
                                <button onClick={() => setIsSlackEditing(true)} className="px-3 py-1 bg-gray-800 text-white rounded font-bold text-sm">수정</button>
                            )}
                        </div>
                    </div>

                    {/* Notification Config Details */}
                    <div className="bg-purple-50 p-4 rounded-lg">
                        <h4 className="font-bold text-sm text-purple-800 mb-3 flex justify-between items-center">
                            자동 알림 상세 설정
                            <div className="flex items-center space-x-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded ${settings.notificationSettings?.enabled ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-500'}`}>
                                    {settings.notificationSettings?.enabled ? 'ON' : 'OFF'}
                                </span>
                            </div>
                        </h4>

                        <NotificationConfigForm
                            settings={settings.notificationSettings}
                            onSave={async (newSettings: any) => await updateSettings({ notificationSettings: newSettings })}
                        />
                    </div>
                </div >

                {/* Google Sheets */}
                < div className="bg-white rounded-xl shadow p-6 border-t-4 border-green-500" >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold flex items-center text-green-700"><FileText className="mr-2" /> 구글 시트 연동</h3>
                        <button onClick={onOpenSheetManual} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold hover:bg-green-200">매뉴얼</button>
                    </div>
                    <div className="mb-4">
                        <input
                            disabled={!isSheetEditing}
                            value={sheetUrl}
                            onChange={(e) => setSheetUrl(e.target.value)}
                            className={`w-full p-2 border rounded ${isSheetEditing ? 'bg-white' : 'bg-gray-100'}`}
                            placeholder="Current Web App URL..."
                        />
                    </div>
                    <div>
                        {isSheetEditing ? (
                            <div className="space-x-2">
                                <button onClick={() => {
                                    updateSettings({ sheetConfig: { url: sheetUrl } });
                                    setIsSheetEditing(false);
                                }} className="px-3 py-1 bg-green-600 text-white rounded font-bold text-sm">저장</button>
                                <button onClick={() => setIsSheetEditing(false)} className="px-3 py-1 bg-gray-200 rounded font-bold text-sm">취소</button>
                            </div>
                        ) : (
                            <button onClick={() => setIsSheetEditing(true)} className="px-3 py-1 bg-gray-800 text-white rounded font-bold text-sm">URL 수정</button>
                        )}
                    </div>
                </div >

                {/* Business Trip Sheets */}
                < div className="bg-white rounded-xl shadow p-6 border-t-4 border-indigo-500" >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold flex items-center text-indigo-700"><FileText className="mr-2" /> 관내출장 연동</h3>
                        <button onClick={onOpenBusinessTripManual} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold hover:bg-indigo-200">매뉴얼</button>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-gray-500 mb-1">Web App URL (출장용)</label>
                        <input
                            disabled={!isBusinessTripEditing}
                            value={businessTripSheetUrl}
                            onChange={(e) => setBusinessTripSheetUrl(e.target.value)}
                            className={`w-full p-2 border rounded ${isBusinessTripEditing ? 'bg-white' : 'bg-gray-100'}`}
                            placeholder="스크립트 URL 입력..."
                        />
                    </div>
                    <div>
                        {isBusinessTripEditing ? (
                            <div className="space-x-2">
                                <button onClick={() => {
                                    updateSettings({ businessTripConfig: { url: businessTripSheetUrl } });
                                    setIsBusinessTripEditing(false);
                                }} className="px-3 py-1 bg-indigo-600 text-white rounded font-bold text-sm">저장</button>
                                <button onClick={() => setIsBusinessTripEditing(false)} className="px-3 py-1 bg-gray-200 rounded font-bold text-sm">취소</button>
                            </div>
                        ) : (
                            <button onClick={() => setIsBusinessTripEditing(true)} className="px-3 py-1 bg-gray-800 text-white rounded font-bold text-sm">URL 수정</button>
                        )}
                    </div>
                </div >
            </div >
        </div >
    );
};

// Helper Component
const SimpleListCard = ({ title, icon, items, onAdd, onDelete, placeholder }: any) => {
    const [val, setVal] = useState('');
    return (
        <div className="bg-white rounded-xl shadow p-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">{icon} {title}</h3>
            <div className="flex gap-2 mb-4">
                <input
                    value={val}
                    onChange={e => setVal(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 p-2 border rounded"
                    onKeyDown={e => { if (e.key === 'Enter') { onAdd(val); setVal(''); } }}
                />
                <button onClick={() => { onAdd(val); setVal(''); }} className="bg-slate-800 text-white px-3 rounded font-bold"><Plus size={18} /></button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
                {items.length === 0 && <p className="text-gray-400 text-sm text-center">항목이 없습니다.</p>}
                {items.map((item: string, i: number) => (
                    <div key={i} className="flex justify-between items-center p-2 hover:bg-gray-50 border-b last:border-0 border-gray-100">
                        <span className="text-sm font-medium">{item}</span>
                        <button onClick={() => onDelete(item)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Helper: Notification Config Form
const NotificationConfigForm = ({ settings, onSave }: any) => {
    const defaultSettings = {
        enabled: false,
        frequency: 'weekly',
        insuranceAlertDays: 30,
        consumableAlertKm: 500,
        consumableAlertDays: 30,
        messageTitle: '📢 차량 관리 필요 알림',
        messageFooter: '관리자 페이지에서 확인 후 조치 바랍니다.'
    };

    const [editing, setEditing] = useState(false);
    const [local, setLocal] = useState({ ...defaultSettings, ...(settings || {}) });

    // Sync local state when prop changes (if not editing)
    React.useEffect(() => {
        if (!editing && settings) {
            setLocal({ ...defaultSettings, ...settings });
        }
    }, [settings, editing]);

    if (!editing) {
        return (
            <div className="space-y-2">
                <div className="text-sm grid grid-cols-2 gap-2 text-gray-600">
                    <div>🔔 주기: <span className="font-bold">{local.frequency === 'daily' ? '매일' : '매주(월)'}</span></div>
                    <div>📅 보험 알림: <span className="font-bold">D-{local.insuranceAlertDays}</span></div>
                    <div>🔧 소모품 알림: <span className="font-bold">{local.consumableAlertKm}km / {local.consumableAlertDays || 30}일 전</span></div>
                    <div className="col-span-2 text-xs text-gray-400 mt-1">
                        "{local.messageTitle}"
                    </div>
                </div>
                <div className="mt-3">
                    <button onClick={() => setEditing(true)} className="w-full py-2 border border-purple-200 text-purple-700 rounded-lg text-sm font-bold hover:bg-purple-50">
                        설정 변경
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                <span className="text-sm font-bold text-gray-700">활성화 여부</span>
                <button
                    onClick={() => setLocal({ ...local, enabled: !local.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${local.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${local.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">알림 주기</label>
                    <select
                        value={local.frequency}
                        onChange={e => setLocal({ ...local, frequency: e.target.value })}
                        className="w-full p-2 border rounded text-sm"
                    >
                        <option value="daily">매일 (09:00)</option>
                        <option value="weekly">매주 월요일</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">보험 만료 알림 (일)</label>
                    <input
                        type="number"
                        value={local.insuranceAlertDays}
                        onChange={e => setLocal({ ...local, insuranceAlertDays: Number(e.target.value) })}
                        className="w-full p-2 border rounded text-sm"
                    />
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">소모품 교체 알림 (잔여주행거리 km)</label>
                        <input
                            type="number"
                            value={local.consumableAlertKm}
                            onChange={e => setLocal({ ...local, consumableAlertKm: Number(e.target.value) })}
                            className="w-full p-2 border rounded text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">소모품 교체 알림 (만료 며칠 전)</label>
                        <input
                            type="number"
                            value={local.consumableAlertDays || 30}
                            onChange={e => setLocal({ ...local, consumableAlertDays: Number(e.target.value) })}
                            className="w-full p-2 border rounded text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="pt-2 border-t border-purple-100">
                <label className="block text-xs font-bold text-gray-500 mb-1">메시지 제목</label>
                <input
                    value={local.messageTitle}
                    onChange={e => setLocal({ ...local, messageTitle: e.target.value })}
                    className="w-full p-2 border rounded text-sm mb-2"
                />
                <label className="block text-xs font-bold text-gray-500 mb-1">메시지 꼬리말</label>
                <input
                    value={local.messageFooter}
                    onChange={e => setLocal({ ...local, messageFooter: e.target.value })}
                    className="w-full p-2 border rounded text-sm"
                />
            </div>

            <div className="flex gap-2 pt-2">
                <button onClick={() => { onSave(local); setEditing(false); }} className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700">설정 저장</button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg font-bold text-sm hover:bg-gray-300">취소</button>
            </div>
        </div>
    );
};

// Helper: Image Resize Config Form
const ImageResizeConfigForm = ({ settings, onSave }: any) => {
    const defaultSettings = {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.8
    };

    const [editing, setEditing] = useState(false);
    const [local, setLocal] = useState({ ...defaultSettings, ...(settings || {}) });

    React.useEffect(() => {
        if (!editing && settings) {
            setLocal({ ...defaultSettings, ...settings });
        }
    }, [settings, editing]);

    if (!editing) {
        return (
            <div className="space-y-2">
                <div className="text-sm text-gray-600">
                    <div>최대 해상도: <span className="font-bold">{local.maxWidth} x {local.maxHeight}</span></div>
                    <div>압축 화질: <span className="font-bold">{Math.round(local.quality * 100)}%</span></div>
                    <p className="text-xs text-gray-400 mt-1">
                        * 주유 및 정비 기록 사진 업로드 시 적용됩니다.
                    </p>
                </div>


                <div className="mt-3">
                    <button onClick={() => setEditing(true)} className="w-full py-2 border border-cyan-200 text-cyan-700 rounded-lg text-sm font-bold hover:bg-cyan-50">
                        설정 변경
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Max Width (px)</label>
                    <input
                        type="number"
                        value={local.maxWidth}
                        onChange={e => setLocal({ ...local, maxWidth: Number(e.target.value) })}
                        className="w-full p-2 border rounded text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Max Height (px)</label>
                    <input
                        type="number"
                        value={local.maxHeight}
                        onChange={e => setLocal({ ...local, maxHeight: Number(e.target.value) })}
                        className="w-full p-2 border rounded text-sm"
                    />
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 mb-1">화질 (0.1 ~ 1.0)</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.1"
                            value={local.quality}
                            onChange={e => setLocal({ ...local, quality: Number(e.target.value) })}
                            className="flex-1"
                        />
                        <span className="text-sm font-bold min-w-[3rem] text-right">{Math.round(local.quality * 100)}%</span>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 pt-2">
                <button onClick={() => { onSave(local); setEditing(false); }} className="flex-1 py-2 bg-cyan-600 text-white rounded-lg font-bold text-sm hover:bg-cyan-700">설정 저장</button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg font-bold text-sm hover:bg-gray-300">취소</button>
            </div>
        </div>
    );
};

const StorageCleanupButton = () => {
    const [cleaning, setCleaning] = useState(false);
    const [retentionMonths, setRetentionMonths] = useState(6);

    const handleCleanup = async () => {
        if (!confirm(`${retentionMonths}개월 이상 지난 주유/정비 이미지를 삭제하시겠습니까?\n이미지는 영구적으로 삭제됩니다.`)) return;

        setCleaning(true);
        try {
            const cutoffDateObj = new Date();
            cutoffDateObj.setMonth(cutoffDateObj.getMonth() - retentionMonths);
            const cutoffDate = getLocalDateString(cutoffDateObj);

            let deletedCount = 0;
            let errorCount = 0;

            // Helper to clean collection
            const cleanCollection = async (colName: string) => {
                const q = query(collection(db, colName), where('date', '<', cutoffDate));
                const snapshot = await getDocs(q);

                for (const docSnap of snapshot.docs) {
                    const data = docSnap.data();
                    if (data.imageUrl) {
                        try {
                            // Delete from Storage
                            // Extract path logic or just try to delete if we can get ref from URL
                            // Note: refFromURL is supported in SDK v9
                            const imageRef = ref(storage, data.imageUrl);
                            await deleteObject(imageRef);

                            // Update Firestore
                            await updateDoc(doc(db, colName, docSnap.id), {
                                imageUrl: deleteField()
                            });
                            deletedCount++;
                        } catch (e: any) {
                            console.error(`Failed to delete image for ${docSnap.id}:`, e);
                            if (e.code === 'storage/object-not-found') {
                                // If image not found in storage, still clear the field
                                await updateDoc(doc(db, colName, docSnap.id), {
                                    imageUrl: deleteField()
                                });
                            } else {
                                errorCount++;
                            }
                        }
                    }
                }
            };

            await cleanCollection('fuelingLogs');
            await cleanCollection('maintenanceLogs');

            alert(`정리 완료: ${deletedCount}개의 이미지가 삭제되었습니다.` + (errorCount > 0 ? `\n(실패: ${errorCount}건)` : ''));

        } catch (e) {
            console.error(e);
            alert('정리 작업 중 오류 발생');
        } finally {
            setCleaning(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                <span className="text-sm font-bold text-gray-700">보관 기간 설정</span>
                <select
                    value={retentionMonths}
                    onChange={(e) => setRetentionMonths(Number(e.target.value))}
                    className="p-2 border rounded-lg text-sm bg-gray-50 font-bold"
                >
                    <option value={1}>1개월</option>
                    <option value={3}>3개월</option>
                    <option value={6}>6개월 (기본)</option>
                    <option value={12}>1년</option>
                    <option value={24}>2년</option>
                    <option value={36}>3년</option>
                </select>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleCleanup}
                    disabled={cleaning}
                    className={`flex-1 px-4 py-3 rounded-lg font-bold text-white shadow-md transition-colors ${cleaning ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'}`}
                >
                    {cleaning ? '삭제 중...' : `${retentionMonths}개월 이상 된 이미지 삭제`}
                </button>
            </div>

            <div className="text-right">
                <a
                    href="https://console.firebase.google.com/u/0/project/dv-carmanagementapp/storage"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-gray-500 underline hover:text-blue-600 flex items-center justify-end gap-1"
                >
                    실시간 용량 확인 (Firebase Console) <Plus className="w-3 h-3 rotate-45" />
                </a>
            </div>
        </div>
    );
};

const MaintenanceConfigForm = ({ settings, onSave }: any) => {
    const defaultSettings = {
        enabled: false,
        message: '시스템 점검 중입니다. 잠시 후 다시 시도해주세요.',
        startTime: '',
        endTime: ''
    };

    const [editing, setEditing] = useState(false);
    const [local, setLocal] = useState({ ...defaultSettings, ...(settings || {}) });

    React.useEffect(() => {
        if (!editing && settings) {
            setLocal({ ...defaultSettings, ...settings });
        }
    }, [settings, editing]);

    if (!editing) {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${local.enabled ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                            {local.enabled ? '점검중 (ON)' : '정상운영 (OFF)'}
                        </span>
                    </div>
                </div>
                {local.enabled && (
                    <div className="text-sm bg-gray-50 p-3 rounded text-gray-700 border border-gray-200">
                        <p className="font-bold mb-1">표시 메시지:</p>
                        <p>{local.message}</p>
                    </div>
                )}
                <div className="mt-2">
                    <button onClick={() => setEditing(true)} className="w-full py-2 border border-yellow-200 text-yellow-700 rounded-lg text-sm font-bold hover:bg-yellow-50">
                        설정 변경
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3 animate-fade-in bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center justify-between pb-2 border-b border-yellow-200">
                <span className="text-sm font-bold text-gray-700">점검 모드 활성화</span>
                <button
                    onClick={() => setLocal({ ...local, enabled: !local.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${local.enabled ? 'bg-red-500' : 'bg-gray-300'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${local.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">안내 메시지</label>
                <textarea
                    rows={3}
                    value={local.message}
                    onChange={e => setLocal({ ...local, message: e.target.value })}
                    className="w-full p-2 border rounded text-sm"
                    placeholder="사용자에게 보여질 메시지를 입력하세요."
                />
            </div>

            <div className="flex gap-2 pt-2">
                <button onClick={() => { onSave(local); setEditing(false); }} className="flex-1 py-2 bg-yellow-600 text-white rounded-lg font-bold text-sm hover:bg-yellow-700">저장</button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg font-bold text-sm hover:bg-gray-300">취소</button>
            </div>
        </div>
    );
};
