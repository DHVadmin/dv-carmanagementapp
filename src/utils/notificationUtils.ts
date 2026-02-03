import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { sendSlackNotification } from './slackUtils';
import type { SystemSettings } from '../types';

export interface NotificationResult {
    sent: boolean;
    count: number;
    reason?: string;
}

export const checkAndSendNotificationsUtil = async (settings: SystemSettings, isManual: boolean = false): Promise<NotificationResult> => {
    if (!settings.slackWebhook) {
        return { sent: false, count: 0, reason: 'Slack Webhook이 설정되지 않았습니다.' };
    }

    try {
        const vehiclesSnap = await getDocs(collection(db, 'vehicles'));
        const vehicles = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

        let alertCount = 0;
        const alerts: string[] = [];

        vehicles.forEach(vehicle => {
            const consumables = vehicle.consumables || {};
            const vehicleName = `${vehicle.name} (${vehicle.plateNumber})`;
            const currentMileage = vehicle.lastMileage || 0;

            const vehicleAlerts: string[] = [];

            (settings.consumableSettings || []).forEach(setting => {
                const item = consumables[setting.label];
                if (!item) return; // No record for this item

                let isDanger = false;
                let isWarning = false;
                let msg = '';

                // Check Mileage
                if (setting.distance > 0 && item.lastMileage !== undefined) {
                    const diff = currentMileage - item.lastMileage;
                    if (diff >= setting.distance) {
                        isDanger = true;
                        msg = `주행거리 초과 (${diff.toLocaleString()}/${setting.distance.toLocaleString()}km)`;
                    } else if (diff >= setting.distance * 0.9) {
                        isWarning = true;
                        msg = `주행거리 임박 (${diff.toLocaleString()}/${setting.distance.toLocaleString()}km)`;
                    }
                }

                // Check Date
                if (!isDanger && setting.months > 0 && item.lastDate) {
                    const lastDate = new Date(item.lastDate);
                    const now = new Date();
                    const monthsDiff = (now.getFullYear() - lastDate.getFullYear()) * 12 + (now.getMonth() - lastDate.getMonth());

                    if (monthsDiff >= setting.months) {
                        isDanger = true;
                        msg = `기간 초과 (${monthsDiff}/${setting.months}개월)`;
                    } else if (monthsDiff >= setting.months * 0.9) {
                        isWarning = true;
                        msg = `기간 임박 (${monthsDiff}/${setting.months}개월)`;
                    }
                }

                if (isDanger || isWarning) {
                    vehicleAlerts.push(`- ${setting.label}: ${msg}`);
                }
            });

            if (vehicleAlerts.length > 0) {
                alertCount++;
                alerts.push(`🚗 *${vehicleName}*\n${vehicleAlerts.join('\n')}`);
            }
        });

        if (alertCount > 0) {
            const title = isManual ? "📢 [관리자 요청] 소모품 점검 알림" : "📢 [자동] 소모품 점검 알림";
            const message = `${title}\n\n총 ${alertCount}대 차량의 정비가 필요합니다.\n\n${alerts.join('\n\n')}`;

            await sendSlackNotification(settings.slackWebhook, message);
            return { sent: true, count: alertCount };
        } else {
            if (isManual) {
                return { sent: false, count: 0, reason: '점검이 필요한 차량이 없습니다.' };
            }
            return { sent: false, count: 0, reason: 'No alerts needed' };
        }

    } catch (error) {
        console.error("Notification Check Error:", error);
        return { sent: false, count: 0, reason: error instanceof Error ? error.message : 'Unknown error' };
    }
};
