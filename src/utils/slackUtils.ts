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
