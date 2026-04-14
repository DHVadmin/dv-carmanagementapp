import type { SystemSettings } from '../types';

export interface NotificationResult {
    sent: boolean;
    count: number;
    reason?: string;
}

export const checkAndSendNotificationsUtil = async (_settings: SystemSettings, isManual: boolean = false): Promise<NotificationResult> => {
    try {
        // Cloud Function URL (HTTP)
        const FUNCTION_URL = 'https://us-central1-dv-carmanagementapp.cloudfunctions.net/runNotificationCheck';
        const url = `${FUNCTION_URL}?test=${isManual}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ test: isManual })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Server Response: ${response.status} ${response.statusText} - ${text}`);
        }

        const data = await response.json();

        if (!data.success) {
            console.error("Server Error:", data.error, data.stack);
            return {
                sent: false,
                count: 0,
                reason: `Server Error: ${data.error}`
            };
        }

        return {
            sent: data.alertCount > 0,
            count: data.alertCount || 0,
            reason: data.alertCount === 0 ? (data.message || '알림 대상 없음') : undefined
        };

    } catch (error) {
        console.error("Notification Check Error:", error);
        return { sent: false, count: 0, reason: error instanceof Error ? error.message : 'Unknown error' };
    }
};
