import type { SystemSettings } from '../types';

/**
 * Sends a message to a Slack channel via Webhook URL.
 * @param webhookUrl The Slack Webhook URL.
 * @param text The message text to send.
 * @param blocks Optional Slack blocks for rich formatting.
 */
export const sendSlackNotification = async (webhookUrl: string, text: string, blocks?: any[]) => {
    if (!webhookUrl) {
        console.warn('Slack webhook URL is not configured.');
        return;
    }

    try {
        const payload = {
            text,
            blocks
        };

        // Note: Calling Slack Webhook from client-side might fail due to CORS depending on browser/webhook config.
        // using 'no-cors' mode allows the request to be sent, but we won't get a readable response.
        // This is a "fire and forget" approach suitable for this environemnt.
        await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        console.log('Slack notification sent (fire-and-forget).');
    } catch (error) {
        console.error('Failed to send Slack notification:', error);
    }
};

/**
 * Formats a log object into a readable summary string for Slack messages.
 * @param log The log data object.
 * @param collectionName The name of the collection (e.g., 'drivingLogs').
 * @returns A formatted string summary.
 */
export const getLogSummary = (log: any, collectionName?: string) => {
    if (!log) return '정보 없음';

    const typeMap: Record<string, string> = {
        'drivingLogs': '운행일지', 'fuelingLogs': '주유일지', 'maintenanceLogs': '정비일지',
        'driving': '운행일지', 'fueling': '주유일지', 'maintenance': '정비일지'
    };
    const type = collectionName ? (typeMap[collectionName] || collectionName) : (typeMap[log.type] || log.type);

    const date = log.date || '날짜미상';
    const vehicle = log.vehicleName ? `${log.vehicleName}(${log.vehicleNumber})` : (log.plateNumber ? `${log.vehicleName}(${log.plateNumber})` : '차량미상');

    let details = '';
    if (type === '운행일지') details = `${log.purpose} / ${(log.distance || 0).toLocaleString()}km`;
    else if (type === '주유일지') details = `${log.amount}L / ${parseInt(log.cost || '0').toLocaleString()}원`;
    else if (type === '정비일지') details = `${log.item} / ${parseInt(log.cost || '0').toLocaleString()}원`;

    return `[${type}] ${date} / ${vehicle}\n${details}`;
};

/**
 * Sends a modification request notification using the configured template.
 */
export const sendModificationNotification = async (settings: SystemSettings, request: any) => { // Use specific type if possible
    const webhookUrl = settings.slackWebhook;
    const notiSettings = settings.integratedNotificationSettings;

    if (!webhookUrl) return; // No webhook, nothing to do.

    // Check if integrated settings exist and are enabled. 
    // If not, fall back to default hardcoded message for backward compatibility or stop?
    // User asked for "Integrated Notification" template. 
    // If enabled, use template. If not, use legacy format?
    // Let's assume if 'integratedNotificationSettings' is present, we try to use it.

    const requestType = request.changeType === 'update' ? '수정' : '삭제';
    const requesterName = request.requesterName || '사용자';
    const reason = request.reason || '사유 없음';
    const logSummary = getLogSummary(request.originalData, request.targetCollection);

    let message = '';

    if (notiSettings && notiSettings.enabled && notiSettings.messageTemplate) {
        // Template Mode
        let template = notiSettings.messageTemplate;

        // 1. Resolve Mention
        let mention = requesterName;
        if (settings.slackUsers && request.requester) {
            const matchedUser = settings.slackUsers.find(u => u.email === request.requester);
            if (matchedUser) {
                mention = `<@${matchedUser.id}>`;
            }
        }

        // 2. Replace Variables
        const originalLog = request.originalData || {};
        const vehicleName = originalLog.vehicleName || '차량명 미상';
        const vehiclePlate = originalLog.vehiclePlate || originalLog.vehicleNumber || originalLog.plateNumber || '번호 미상';
        const logDate = originalLog.date || originalLog.startDate || '날짜 미상';
        const logPurpose = originalLog.purpose || originalLog.item || '';
        const logDestination = originalLog.destination || '';
        const logItem = originalLog.item || '';
        const logDistance = originalLog.distance ? `${originalLog.distance}km` : '';

        message = template
            .replace(/{요청자}/g, requesterName)
            .replace(/{멘션}/g, mention)
            .replace(/{요청종류}/g, requestType)
            .replace(/{사유}/g, reason)
            .replace(/{대상기록}/g, logSummary)
            .replace(/{차량명}/g, vehicleName)
            .replace(/{차량번호}/g, vehiclePlate)
            .replace(/{날짜}/g, logDate)
            .replace(/{목적}/g, logPurpose)
            .replace(/{목적지}/g, logDestination)
            .replace(/{항목}/g, logItem)
            .replace(/{상태}/g, requestType)
            .replace(/{잔여}/g, logDistance)
            .replace(/{만료일}/g, logDate);

    } else {
        // Legacy Default Format (Fallback)
        message = `📢 [${requestType} 요청] ${requesterName} 님이 ${requestType}을 요청했습니다.\n\n` +
            `💬 *사유*: ${reason}\n` +
            `📋 *대상 기록*\n${logSummary}`;
    }

    await sendSlackNotification(webhookUrl, message);
};

/**
 * Sends a trip approval/rejection notification using the configured template.
 */
export const sendTripStatusNotification = async (settings: SystemSettings, trip: any, status: '승인' | '반려', reason: string = '') => {
    const webhookUrl = settings.slackWebhook;
    const notiSettings = settings.integratedNotificationSettings;

    if (!webhookUrl) return;

    let message = '';

    if (notiSettings && notiSettings.enabled && notiSettings.tripMessageTemplate) {
        // Template Mode
        let template = notiSettings.tripMessageTemplate;

        // 1. Resolve Mention
        let mention = trip.userName || '사용자';
        if (settings.slackUsers && trip.userId) {
            const matchedUser = settings.slackUsers.find(u => u.email === trip.userId);
            if (matchedUser) {
                mention = `<@${matchedUser.id}>`;
            }
        }

        // 2. Resolve Variables
        const formattedDate = trip.startDate === trip.endDate ? trip.startDate : `${trip.startDate}~${trip.endDate}`;

        message = template
            .replace(/{이름}/g, trip.userName || '사용자')
            .replace(/{멘션}/g, mention)
            .replace(/{날짜}/g, formattedDate)
            .replace(/{출장지}/g, trip.destination || '')
            .replace(/{상태}/g, status)
            .replace(/{사유}/g, reason || '없음');

    } else {
        // Legacy Default Format (Fallback)
        if (status === '승인') {
            message = `✅ [관내출장 승인] *${trip.userName}* 님의 출장이 승인되었습니다.\n📅 ${trip.date} ${trip.destination}\n🔗 구글 출장대장에 기록됨.`;
        } else {
            message = `🚫 [관내출장 반려] ${trip.userName} 님의 출장이 반려되었습니다.\n💬 사유: ${reason}`;
        }
    }

    await sendSlackNotification(webhookUrl, message);
};

