import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';



// Lazy Initialization to prevent Global Scope Crashes
let _db: FirebaseFirestore.Firestore | undefined;
function getDB() {
    if (!_db) {
        if (admin.apps.length === 0) {
            admin.initializeApp();
        }
        _db = admin.firestore();
    }
    return _db;
}

// const corsHandler = cors({ origin: true });

interface NotificationSettings {
    enabled: boolean;
    daysToSend: number[]; // 0=Sun, 1=Mon...
    sendHour: number; // 0-23
    messageTemplate: string;
    lastCheckedDate?: string;
    lastCheckedHour?: number;
    insuranceAlertDays: number;
    consumableAlertKm: number;
    consumableAlertDays: number;
    messageTitle: string;
    messageFooter: string;
}

interface ConsumableSetting {
    label: string;
    distance: number;
    months: number;
}

interface SystemSettings {
    slackWebhook?: string;
    consumableSlackWebhook?: string;
    notificationSettings?: NotificationSettings;
    consumableSettings: ConsumableSetting[];
}

interface Vehicle {
    id: string;
    name: string;
    plateNumber: string;
    lastMileage: number;
    insurance?: {
        expiryDate?: string;
    };
    consumables?: {
        [key: string]: {
            lastDate?: string;
            lastMileage?: number;
        };
    };
}

// 오늘 날짜를 YYYY-MM-DD 형식으로 반환 (한국시간)
function getKSTDate(): Date {
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    return new Date(now.getTime() + kstOffset);
}

function getTodayString(date: Date): string {
    return date.toISOString().split('T')[0];
}

// Slack 웹훅으로 메시지 발송
async function sendSlackMessage(webhookUrl: string, message: string): Promise<void> {
    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message })
    });
    if (!response.ok) {
        console.error('Failed to send Slack message:', response.statusText);
    }
}

// 메시지 템플릿 처리기
function formatMessage(template: string, data: any): string {
    return (template || '• [{항목}] {차량명}({차량번호}): {상태}')
        .replace(/{차량명}/g, data.vehicleName || '')
        .replace(/{차량번호}/g, data.plateNumber || '')
        .replace(/{항목}/g, data.item || '')
        .replace(/{상태}/g, data.status || '')
        .replace(/{잔여}/g, data.remaining || '')
        .replace(/{만료일}/g, data.expiryDate || '')
        .replace(/{남은기간}/g, data.daysLeft || '');
}

// 알림 체크 로직
async function checkNotifications(isTest: boolean = false): Promise<string[]> {
    const db = getDB();
    const settingsDoc = await db.collection('settings').doc('global').get();
    if (!settingsDoc.exists) {
        console.log('❌ No settings found');
        return [];
    }

    const settings = settingsDoc.data() as SystemSettings;
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

    const kstNow = getKSTDate();
    const todayStr = getTodayString(kstNow);
    const currentDay = kstNow.getUTCDay();
    const currentHour = kstNow.getUTCHours();

    console.log(`🕒 Checking time (KST): Day=${currentDay}, Hour=${currentHour}, Today=${todayStr}`);

    // Schedule Check (Skip if Test)
    if (!isTest) {
        // 1. Hour Check
        if (currentHour !== (noti.sendHour ?? 9)) {
            console.log(`⏳ Not scheduled hour (Current: ${currentHour}, Setting: ${noti.sendHour ?? 9})`);
            return [];
        }

        // 2. Day Check
        const targetDays = noti.daysToSend ?? [1]; // Default Mon
        if (!targetDays.includes(currentDay)) {
            console.log(`📅 Not scheduled day (Current: ${currentDay}, Setting: ${targetDays})`);
            return [];
        }

        // 3. Prevent Double Send (Check if already sent today)
        if (noti.lastCheckedDate === todayStr) {
            console.log('✅ Already checked today');
            return [];
        }
    }

    const vehiclesSnap = await db.collection('vehicles').get();
    const vehicles = vehiclesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Vehicle));

    const alertLines: string[] = [];
    const template = noti.messageTemplate || '• [{항목}] {차량명}({차량번호}): {상태}';

    for (const vehicle of vehicles) {
        // Insurance Check
        if (vehicle.insurance?.expiryDate) {
            const expiryDate = new Date(vehicle.insurance.expiryDate);
            const today = new Date(todayStr); // Compare date-only
            const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

            if (diffDays <= noti.insuranceAlertDays) {
                const status = diffDays < 0 ? `만료됨 (${Math.abs(diffDays)}일 지남)` : `만료 ${diffDays}일 전`;
                alertLines.push(formatMessage(template, {
                    vehicleName: vehicle.name,
                    plateNumber: vehicle.plateNumber,
                    item: '보험',
                    status: status,
                    remaining: '-',
                    expiryDate: vehicle.insurance.expiryDate,
                    daysLeft: diffDays.toString()
                }));
            }
        }

        // Consumables Check
        for (const setting of settings.consumableSettings || []) {
            const lastLog = vehicle.consumables?.[setting.label];

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
            let nextDueDateStr = '-';

            if (setting.months > 0 && lastLog && lastLog.lastDate) {
                const lastDate = new Date(lastLog.lastDate);
                const nextDueDate = new Date(lastDate);
                nextDueDate.setMonth(nextDueDate.getMonth() + setting.months);
                nextDueDateStr = nextDueDate.toISOString().split('T')[0];

                const today = new Date(todayStr); // Safe comparison
                remainingDays = Math.ceil((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                if (remainingDays <= noti.consumableAlertDays) {
                    timeAlert = true;
                }
            }

            if (distanceAlert || timeAlert) {
                let statusParts = [];
                if (distanceAlert) statusParts.push(`잔여 ${remainingKm}km`);
                if (timeAlert) statusParts.push(`만료 ${remainingDays}일 전`);

                alertLines.push(formatMessage(template, {
                    vehicleName: vehicle.name,
                    plateNumber: vehicle.plateNumber,
                    item: setting.label,
                    status: `${statusParts.join(', ')} 점검 필요`,
                    remaining: `${remainingKm}km`,
                    expiryDate: nextDueDateStr,
                    daysLeft: remainingDays.toString()
                }));
            }
        }
    }

    if (alertLines.length > 0) {
        const message = `${noti.messageTitle}\n\n${alertLines.join('\n')}\n\n${noti.messageFooter}`;
        await sendSlackMessage(webhookUrl, message);
        console.log(`✅ Sent ${alertLines.length} alerts`);
    } else {
        console.log('✨ No alerts to send');
    }

    if (!isTest) {
        await db.collection('settings').doc('global').update({
            'notificationSettings.lastCheckedDate': todayStr
        });
    }

    return alertLines;
}

/**
 * 매 시간 실행되는 스케줄러 (한국 시간 기준)
 */
export const scheduledNotificationCheck = functions.pubsub.schedule('every 1 hours').timeZone('Asia/Seoul').onRun(async (context) => {
    console.log('⏰ Hourly Schedule Triggered');
    await checkNotifications(false);
});

/**
 * 테스트용 HTTP 트리거 (V1 HTTP Request)
 * Uses V1 to guarantee the URL matches: 
 * https://us-central1-[project].cloudfunctions.net/runNotificationCheck
 */
export const runNotificationCheck = functions.https.onRequest(async (req, res) => {
    // Manually handle CORS using the middleware
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    // return corsHandler(req, res, async () => { // Removed usage
    { // Enclose in block to keep variable scope if needed or just execute

        console.log('📢 Manual Notification check triggered (V1 HTTP)');

        try {
            getDB(); // Lazy init
            // Simple connectivity check
            console.log('✅ DB Initialized');

            const isTest = req.query.test === 'true' || req.body.data?.test === true || req.body.test === true;

            let alerts: string[] = [];
            try {
                alerts = await checkNotifications(isTest);
            } catch (innerError: any) {
                console.error("Logic Error:", innerError);
                res.status(200).json({
                    success: false,
                    error: `Logic Failed: ${innerError.message}`,
                    stack: innerError.stack
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: `Check completed`,
                alertCount: alerts.length,
                alerts
            });
        } catch (error: any) {
            console.error('❌ Critical Error:', error);
            res.status(500).json({
                success: false,
                error: `Critical: ${error.message}`,
                stack: error.stack
            });
        }
    }
});


// import * as https from 'https'; // Already removed/commented or verified top level presence elsewhere? 
// No, I need to make sure https is available or re-imported locally if global scope is messy.
import * as https from 'https';

/**
 * Slack 사용자 목록 가져오기 (HTTPS Request - Manual CORS)
 * onRequest로 변경하여 CORS를 직접 제어하고 안정성을 확보합니다.
 */
export const getSlackUsers = functions.region('us-central1').https.onRequest((req, res) => {
    // 1. Manually Handle CORS
    res.set('Access-Control-Allow-Origin', '*'); // Or specifically req.headers.origin if needed, but * is easiest for broad client support
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // 2. Handle OPTIONS Preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    console.log("getSlackUsers (onRequest Manual CORS) called.");

    // 3. Method Check for Logics
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    // 4. Body & Token Check
    const token = req.body.data ? req.body.data.token : req.body.token;
    if (!token) {
        console.warn("Token missing in request body");
        res.status(400).json({ error: 'Slack Bot Token is required.' });
        return;
    }

    // 5. Execute Logic
    fetchSlackUsers(token)
        .then(users => {
            console.log(`Successfully fetched ${users.length} users.`);
            res.status(200).json({ result: { success: true, users } });
        })
        .catch(error => {
            console.error("Handler Error:", error);
            res.status(500).json({ error: error.message });
        });
});

// Helper function to keep main handler clean
function fetchSlackUsers(token: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'slack.com',
            path: '/api/users.list',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (!json.ok) {
                        reject(new Error(`Slack API Error: ${json.error}`));
                        return;
                    }
                    const users = json.members
                        .filter((m: any) => !m.deleted && !m.is_bot && m.profile?.email)
                        .map((m: any) => ({
                            id: m.id,
                            email: m.profile?.email,
                            name: m.name,
                            real_name: m.real_name,
                            display_name: m.profile?.display_name
                        }));
                    resolve(users);
                } catch (e: any) {
                    reject(new Error('Failed to parse Slack response'));
                }
            });
        });

        req.on('error', (e) => reject(new Error(e.message)));
        req.end();
    });
}
