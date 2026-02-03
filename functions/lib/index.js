"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNotificationCheck = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
// 오늘 날짜를 YYYY-MM-DD 형식으로 반환 (한국시간)
function getTodayString() {
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(now.getTime() + kstOffset);
    return kstDate.toISOString().split('T')[0];
}
// Slack 웹훅으로 메시지 발송
async function sendSlackMessage(webhookUrl, message) {
    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message })
    });
    if (!response.ok) {
        console.error('Failed to send Slack message:', response.statusText);
    }
}
// 알림 체크 로직
async function checkNotifications(skipDateCheck = false) {
    var _a, _b;
    const settingsDoc = await db.collection('settings').doc('global').get();
    if (!settingsDoc.exists) {
        console.log('❌ No settings found');
        return [];
    }
    const settings = settingsDoc.data();
    const noti = settings.notificationSettings;
    if (!noti || !noti.enabled) {
        console.log('⏸️ Notifications disabled');
        return [];
    }
    const webhookUrl = settings.consumableSlackWebhook || settings.slackWebhook;
    if (!webhookUrl) {
        console.log('❌ No webhook URL configured');
        return [];
    }
    const today = new Date();
    const todayStr = getTodayString();
    if (!skipDateCheck && noti.lastCheckedDate === todayStr) {
        console.log('✅ Already checked today');
        return [];
    }
    if (noti.frequency === 'weekly') {
        const dayOfWeek = today.getDay();
        if (dayOfWeek !== 1) {
            console.log('⏭️ Weekly mode: Not Monday, skipping');
            return [];
        }
    }
    const vehiclesSnap = await db.collection('vehicles').get();
    const vehicles = vehiclesSnap.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    const alertLines = [];
    for (const vehicle of vehicles) {
        if ((_a = vehicle.insurance) === null || _a === void 0 ? void 0 : _a.expiryDate) {
            const expiryDate = new Date(vehicle.insurance.expiryDate);
            const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            if (diffDays <= noti.insuranceAlertDays && diffDays >= 0) {
                alertLines.push(`• [보험] ${vehicle.plateNumber} (${vehicle.name}): 만료 ${diffDays}일 전 (${vehicle.insurance.expiryDate})`);
            }
            else if (diffDays < 0) {
                alertLines.push(`• [보험] ${vehicle.plateNumber} (${vehicle.name}): 🚨 만료됨 (${Math.abs(diffDays)}일 지남)`);
            }
        }
        for (const setting of settings.consumableSettings || []) {
            const lastLog = (_b = vehicle.consumables) === null || _b === void 0 ? void 0 : _b[setting.label];
            let distanceAlert = false;
            let remainingKm = 0;
            if (lastLog && lastLog.lastMileage) {
                const distSince = vehicle.lastMileage - lastLog.lastMileage;
                remainingKm = setting.distance - distSince;
                if (remainingKm <= noti.consumableAlertKm) {
                    distanceAlert = true;
                }
            }
            let timeAlert = false;
            let remainingDays = 0;
            if (setting.months > 0 && lastLog && lastLog.lastDate) {
                const lastDate = new Date(lastLog.lastDate);
                const nextDueDate = new Date(lastDate);
                nextDueDate.setMonth(nextDueDate.getMonth() + setting.months);
                remainingDays = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (remainingDays <= noti.consumableAlertDays) {
                    timeAlert = true;
                }
            }
            if (distanceAlert || timeAlert) {
                let msg = `• [소모품] ${vehicle.plateNumber} (${vehicle.name}): ${setting.label} 점검 필요`;
                if (distanceAlert)
                    msg += ` (잔여 ${remainingKm}km)`;
                if (timeAlert)
                    msg += ` (만료 ${remainingDays}일 전)`;
                alertLines.push(msg);
            }
        }
    }
    if (alertLines.length > 0) {
        const message = `${noti.messageTitle}\n\n${alertLines.join('\n')}\n\n${noti.messageFooter}`;
        await sendSlackMessage(webhookUrl, message);
        console.log(`✅ Sent ${alertLines.length} alerts`);
    }
    if (!skipDateCheck) {
        await db.collection('settings').doc('global').update({
            'notificationSettings.lastCheckedDate': todayStr
        });
    }
    return alertLines;
}
/**
 * 알림 체크 HTTP 함수 (Cloud Scheduler에서 호출)
 * 이 함수를 Google Cloud Scheduler에서 호출하면 스케줄 알림과 동일한 효과
 */
exports.runNotificationCheck = (0, https_1.onRequest)({
    region: 'us-central1',
    cors: true
}, async (req, res) => {
    console.log('📢 Notification check triggered');
    try {
        const isTest = req.query.test === 'true';
        const alerts = await checkNotifications(isTest);
        if (alerts.length > 0) {
            res.status(200).json({
                success: true,
                message: `Sent ${alerts.length} alerts`,
                alerts
            });
        }
        else {
            res.status(200).json({
                success: true,
                message: 'No alerts to send (or notifications disabled/already checked today)'
            });
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, error: errorMessage });
    }
});
//# sourceMappingURL=index.js.map