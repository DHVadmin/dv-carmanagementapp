import type { SystemSettings } from '../types';

export interface NotificationResult {
    sent: boolean;
    count: number;
    reason?: string;
}

export const checkAndSendNotificationsUtil = async (settings: SystemSettings, isManual: boolean = false): Promise<NotificationResult> => {
    try {
        // GAS Web App URL (from Firestore settings)
        const GAS_URL = settings.sheetConfig?.url;

        if (!GAS_URL) {
            return {
                sent: false,
                count: 0,
                reason: '구글 시트(Apps Script) URL이 설정되지 않았습니다. 관리자 설정에서 구글 시트 URL을 입력해주세요.'
            };
        }

        console.log('🔔 Sending notification check to GAS...', { url: GAS_URL, isManual });

        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'runNotificationCheck',
                test: isManual
            })
        });

        // GAS web apps may redirect (302), fetch follows automatically
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Server Response: ${response.status} ${response.statusText} - ${text}`);
        }

        const data = await response.json();

        if (data.result === 'error') {
            console.error("GAS Error:", data.message);
            return {
                sent: false,
                count: 0,
                reason: `서버 오류: ${data.message}`
            };
        }

        return {
            sent: (data.alertCount || 0) > 0,
            count: data.alertCount || 0,
            reason: (data.alertCount || 0) === 0 ? (data.message || '알림 대상 없음') : undefined
        };

    } catch (error) {
        console.error("Notification Check Error:", error);
        return { sent: false, count: 0, reason: error instanceof Error ? error.message : 'Unknown error' };
    }
};
