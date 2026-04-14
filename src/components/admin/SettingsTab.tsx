import React, { useState } from 'react';
import { Settings, MapPin, Wrench, MessageSquare, FileText, Trash2, Plus, Fuel, Image, AlertTriangle, CreditCard } from 'lucide-react';
import { doc, setDoc, collection, query, where, getDocs, updateDoc, deleteField } from 'firebase/firestore';
import { db, storage } from '../../firebase';
import { ref, deleteObject } from 'firebase/storage';
import { getLocalDateString } from '../../utils/dateUtils';
import type { NotificationSettings, IntegratedNotificationSettings } from '../../types';

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

    // Slack Bot State
    const [slackBotToken, setSlackBotToken] = useState(settings.slackBotToken || '');

    const syncSlackUsers = async (token: string) => {
        // Updated to use fetch calling onRequest function manually to bypass onCall CORS issues
        const response = await fetch('https://us-central1-dv-carmanagementapp.cloudfunctions.net/getSlackUsers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token }) // getSlackUsers onRequest handler expects { token: ... } or { data: { token: ... } }
        });

        const result = await response.json();

        // Check for success based on the new onRequest response format
        // The handler returns: { result: { success: true, users: [...] } } or { error: ... }
        if (response.ok && result.result && result.result.success) {
            await updateSettings({
                slackBotToken: token,
                slackUsers: result.result.users
            });
        } else {
            console.error("Sync Error Details:", result);
            throw new Error(result.error || result.data?.error || 'Unknown error');
        }
    };

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
                <div className="md:col-span-2">
                    <SimpleListCard
                        title="자금원천/결제수단 관리"
                        icon={<CreditCard size={18} />}
                        items={settings.paymentMethods || []}
                        onAdd={(v: string) => handleAdd('paymentMethods', v)}
                        onDelete={(v: string) => handleDelete('paymentMethods', v)}
                        placeholder="예: 법인전입금, 자부담, 보조금, 카드결제 등"
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
                            소모품 자동알림 상세설정
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

                    <div className="mt-4">
                        <IntegratedNotificationConfigForm
                            settings={settings.integratedNotificationSettings}
                            slackBotToken={slackBotToken}
                            onSave={async (newConfig: any, newToken: string) => {
                                setSlackBotToken(newToken);
                                await updateSettings({
                                    integratedNotificationSettings: newConfig,
                                    slackBotToken: newToken
                                });
                            }}
                            onSyncUsers={syncSlackUsers}
                        />
                    </div>
                </div >

                {/* Google Sheets */}
                < div className="bg-white rounded-xl shadow p-6 border-t-4 border-green-500" >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold flex items-center text-green-700"><FileText className="mr-2" /> 운행기록 연동</h3>
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
const NotificationConfigForm = ({ settings, onSave }: { settings: NotificationSettings | undefined; onSave: (s: NotificationSettings) => void }) => {
    const defaultSettings = {
        enabled: false,
        daysToSend: [1], // Monday
        sendHour: 9,     // 09:00
        insuranceAlertDays: 30,
        consumableAlertKm: 500,
        consumableAlertDays: 30,
        messageTitle: '📢 차량 관리 필요 알림',
        messageTemplate: '• [{항목}] {차량명}({차량번호}): {상태}',
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

    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const toggleDay = (dayIndex: number) => {
        const current = local.daysToSend || [];
        if (current.includes(dayIndex)) {
            setLocal({ ...local, daysToSend: current.filter(d => d !== dayIndex) });
        } else {
            setLocal({ ...local, daysToSend: [...current, dayIndex].sort() });
        }
    };

    const getPreview = (template: string) => {
        return (template || '')
            .replace(/{차량명}/g, '가전 1호차')
            .replace(/{차량번호}/g, '12가3456')
            .replace(/{항목}/g, '엔진오일')
            .replace(/{상태}/g, '점검 필요')
            .replace(/{잔여}/g, '500km')
            .replace(/{만료일}/g, '2024-12-31')
            .replace(/{남은기간}/g, '30');
    };

    if (!editing) {
        return (
            <div className="space-y-2">
                <div className="text-sm grid grid-cols-2 gap-2 text-gray-600">
                    <div className="col-span-2">
                        🔔 알림 시간: <span className="font-bold">
                            {(local.daysToSend || []).map((d: number) => days[d]).join(', ')} {local.sendHour?.toString().padStart(2, '0')}:00
                        </span>
                    </div>
                    <div>📅 보험 알림: <span className="font-bold">D-{local.insuranceAlertDays}</span></div>
                    <div>🔧 소모품 알림: <span className="font-bold">{local.consumableAlertKm}km / {local.consumableAlertDays || 30}일 전</span></div>
                    <div className="col-span-2 text-xs text-gray-400 mt-1 bg-gray-50 p-2 rounded">
                        <div className="font-bold mb-1">[메시지 미리보기]</div>
                        <div>{local.messageTitle}</div>
                        <div className="text-gray-600 my-1">
                            {getPreview(local.messageTemplate || defaultSettings.messageTemplate)}
                        </div>
                        <div className="text-gray-400 text-[10px]">{local.messageFooter}</div>
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

            {/* Schedule Section */}
            <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-500">알림 요일 및 시간</label>
                <div className="flex gap-1 mb-2">
                    {days.map((day, idx) => (
                        <button
                            key={day}
                            onClick={() => toggleDay(idx)}
                            className={`flex-1 py-1 text-xs rounded border ${(local.daysToSend || []).includes(idx)
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            {day}
                        </button>
                    ))}
                </div>
                <select
                    value={local.sendHour}
                    onChange={e => setLocal({ ...local, sendHour: Number(e.target.value) })}
                    className="w-full p-2 border rounded text-sm"
                >
                    {hours.map(h => (
                        <option key={h} value={h}>{h.toString().padStart(2, '0')}:00</option>
                    ))}
                </select>
            </div>

            {/* Thresholds Section */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-purple-100">
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">보험 만료 알림 (일)</label>
                    <input
                        type="number"
                        value={local.insuranceAlertDays}
                        onChange={e => setLocal({ ...local, insuranceAlertDays: Number(e.target.value) })}
                        className="w-full p-2 border rounded text-sm"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">소모품 (만료일/잔여거리)</label>
                    <div className="flex gap-1">
                        <input
                            type="number"
                            placeholder="일"
                            value={local.consumableAlertDays || 30}
                            onChange={e => setLocal({ ...local, consumableAlertDays: Number(e.target.value) })}
                            className="w-1/2 p-2 border rounded text-sm"
                        />
                        <input
                            type="number"
                            placeholder="km"
                            value={local.consumableAlertKm}
                            onChange={e => setLocal({ ...local, consumableAlertKm: Number(e.target.value) })}
                            className="w-1/2 p-2 border rounded text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Message Template Section */}
            <div className="pt-2 border-t border-purple-100 space-y-2">
                <label className="block text-xs font-bold text-gray-500">메시지 템플릿 설정</label>

                <input
                    value={local.messageTitle}
                    onChange={e => setLocal({ ...local, messageTitle: e.target.value })}
                    placeholder="메시지 제목"
                    className="w-full p-2 border rounded text-sm font-bold"
                />

                <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 flex flex-wrap gap-1">
                        <span>사용 가능 변수:</span>
                        {['{차량명}', '{차량번호}', '{항목}', '{상태}', '{잔여}', '{만료일}'].map(tag => (
                            <span key={tag} className="px-1 bg-gray-100 rounded cursor-pointer hover:bg-gray-200"
                                onClick={() => setLocal({ ...local, messageTemplate: (local.messageTemplate || '') + tag })}>
                                {tag}
                            </span>
                        ))}
                    </div>
                    <textarea
                        value={local.messageTemplate || defaultSettings.messageTemplate}
                        onChange={e => setLocal({ ...local, messageTemplate: e.target.value })}
                        placeholder="메시지 내용 템플릿 입력..."
                        className="w-full p-2 border rounded text-sm h-20"
                    />
                </div>

                <input
                    value={local.messageFooter}
                    onChange={e => setLocal({ ...local, messageFooter: e.target.value })}
                    placeholder="메시지 꼬리말"
                    className="w-full p-2 border rounded text-sm text-gray-500"
                />

                {/* Live Preview */}
                <div className="bg-gray-50 p-3 rounded border border-gray-200 text-sm">
                    <div className="font-bold text-xs text-gray-400 mb-1">미리보기</div>
                    <div className="font-bold text-gray-800">{local.messageTitle}</div>
                    <div className="my-2 text-gray-700 whitespace-pre-wrap">
                        {getPreview(local.messageTemplate || defaultSettings.messageTemplate)}
                    </div>
                    <div className="text-gray-400 text-xs">{local.messageFooter}</div>
                </div>
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

const IntegratedNotificationConfigForm = ({ settings, slackBotToken, onSave, onSyncUsers }: any) => {
    const defaultSettings: IntegratedNotificationSettings = {
        enabled: false,
        messageTemplate: '',
        tripMessageTemplate: ''
    };

    const [editing, setEditing] = useState(false);
    const [local, setLocal] = useState<IntegratedNotificationSettings>({ ...defaultSettings, ...(settings || {}) });
    const [localToken, setLocalToken] = useState(slackBotToken || '');
    const [syncing, setSyncing] = useState(false);

    React.useEffect(() => {
        if (!editing && settings) {
            setLocal({ ...defaultSettings, ...settings });
        }
        if (!editing) {
            setLocalToken(slackBotToken || '');
        }
    }, [settings, slackBotToken, editing]);

    const handleSync = async () => {
        if (!localToken) return alert('Slack Bot Token을 입력해주세요.');
        setSyncing(true);
        try {
            await onSyncUsers(localToken);
            alert('사용자 목록 동기화 성공!');
        } catch (e: any) {
            console.error(e);
            alert('동기화 실패: ' + e.message);
        } finally {
            setSyncing(false);
        }
    };

    const getPreview = (template: string) => {
        if (!template) return <span className="text-gray-400 italic">템플릿이 비어있습니다. 기본 메시지가 발송됩니다.</span>;

        let text = template;
        text = text.replace(/{요청자}/g, '홍길동');
        text = text.replace(/{멘션}/g, '<@U12345678>');
        text = text.replace(/{요청종류}/g, '수정');
        text = text.replace(/{사유}/g, '오타 수정 요청');
        text = text.replace(/{대상기록}/g, '[운행일지] 2024-02-06 / 12가3456\n출퇴근 / 15km');
        return text;
    };

    if (!editing) {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-bold ${local.enabled ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                            {local.enabled ? '커스텀 템플릿 (ON)' : '기본 템플릿 (OFF)'}
                        </span>
                        {local.enabled && <span className="text-xs text-green-600 font-bold">사용자 멘션 활성화됨</span>}
                    </div>
                </div>
                <div className="mt-2">
                    <button onClick={() => setEditing(true)} className="w-full py-2 border border-purple-200 text-purple-700 rounded-lg text-sm font-bold hover:bg-purple-50">
                        설정 변경
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in bg-purple-50 p-4 rounded-lg">
            <h4 className="font-bold text-sm text-purple-800 border-b border-purple-200 pb-2">통합 알림(수정 요청) 커스텀 설정</h4>

            {/* Bot Token Section */}
            <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Slack Bot User OAuth Token</label>
                <div className="flex gap-2">
                    <input
                        type="password"
                        value={localToken}
                        onChange={e => setLocalToken(e.target.value)}
                        className="flex-1 p-2 border rounded text-sm"
                        placeholder="xoxb-..."
                    />
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className={`text-xs px-3 py-1 rounded font-bold text-white ${syncing ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                        {syncing ? '동기화 중...' : '사용자 동기화'}
                    </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                    * 멘션 기능을 위해 필요합니다. 토큰 입력 후 동기화를 눌러주세요.
                </p>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-purple-200">
                <span className="text-sm font-bold text-gray-700">커스텀 템플릿 사용</span>
                <button
                    onClick={() => setLocal({ ...local, enabled: !local.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${local.enabled ? 'bg-purple-600' : 'bg-gray-300'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${local.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            {local.enabled && (
                <div className="space-y-6">
                    {/* Modification Request Template */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500">1. 기록 수정/삭제 요청 알림 템플릿</label>
                        <div className="text-[10px] text-gray-500 flex flex-wrap gap-1">
                            <span>변수:</span>
                            {['{요청자}', '{멘션}', '{요청종류}', '{사유}', '{대상기록}'].map(tag => (
                                <span key={tag} className="px-1 bg-gray-200 rounded cursor-pointer hover:bg-gray-300"
                                    onClick={() => setLocal({ ...local, messageTemplate: (local.messageTemplate || '') + tag })}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                        <textarea
                            value={local.messageTemplate}
                            onChange={e => setLocal({ ...local, messageTemplate: e.target.value })}
                            placeholder="수정 요청 알림 템플릿..."
                            className="w-full p-2 border rounded text-sm h-24 font-mono"
                        />
                        <div className="bg-white p-3 rounded border border-gray-200 text-sm">
                            <div className="font-bold text-xs text-gray-400 mb-1">미리보기 (수정 요청)</div>
                            <div className="text-gray-800 whitespace-pre-wrap">
                                {getPreview(local.messageTemplate)}
                            </div>
                        </div>
                    </div>

                    {/* Trip Approval Template */}
                    <div className="space-y-2 border-t border-purple-100 pt-4">
                        <label className="block text-xs font-bold text-gray-500">2. 관내출장 승인/반려 알림 템플릿</label>
                        <div className="text-[10px] text-gray-500 flex flex-wrap gap-1">
                            <span>변수:</span>
                            {['{이름}', '{멘션}', '{날짜}', '{출장지}', '{상태}', '{사유}'].map(tag => (
                                <span key={tag} className="px-1 bg-gray-200 rounded cursor-pointer hover:bg-gray-300"
                                    onClick={() => setLocal({ ...local, tripMessageTemplate: (local.tripMessageTemplate || '') + tag })}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                        <textarea
                            value={local.tripMessageTemplate || ''}
                            onChange={e => setLocal({ ...local, tripMessageTemplate: e.target.value })}
                            placeholder="예: [{상태}] {이름}님의 출장이 {상태}되었습니다."
                            className="w-full p-2 border rounded text-sm h-24 font-mono"
                        />
                        <div className="bg-white p-3 rounded border border-gray-200 text-sm">
                            <div className="font-bold text-xs text-gray-400 mb-1">미리보기 (관내출장 승인)</div>
                            <div className="text-gray-800 whitespace-pre-wrap">
                                {(local.tripMessageTemplate || '')
                                    .replace(/{이름}/g, '홍길동')
                                    .replace(/{멘션}/g, '<@U12345678>')
                                    .replace(/{날짜}/g, '2024-03-01')
                                    .replace(/{출장지}/g, '서울시청')
                                    .replace(/{상태}/g, '승인')
                                    .replace(/{사유}/g, '없음')}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex gap-2 pt-2">
                <button onClick={() => { onSave(local, localToken); setEditing(false); }} className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700">저장</button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg font-bold text-sm hover:bg-gray-300">취소</button>
            </div>
        </div>
    );
};
