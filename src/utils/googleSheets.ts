export const sendToGoogleSheet = async (data: Record<string, unknown>, sheetUrl?: string) => {
    // The user will provide this URL later. For now we check if it exists in localStorage or hardcoded.
    // Ideally, we store this in 'settings' collection in Firestore, but for simplicity/speed, we can ask user to put it in a specific file or just use a placeholder they replace.
    // Let's use a function that tries to find it.

    // For this environment, we might default to a placeholder or check window.
    const WEBHOOK_URL = sheetUrl || localStorage.getItem('GOOGLE_SHEET_WEBHOOK_URL');

    if (!WEBHOOK_URL) {
        console.warn("Google Sheet Webhook URL not set. Data not synced.");
        return;
    }

    if (!WEBHOOK_URL.endsWith('/exec')) {
        console.warn("⚠️ Warning: Google Sheet URL does NOT end with '/exec'. This usually means it is not a deployed Web App URL.", WEBHOOK_URL);
    }

    console.log("🚀 Sending to Google Sheet...", { url: WEBHOOK_URL, payload: data });

    try {
        await fetch(WEBHOOK_URL, {
            method: 'POST',
            mode: 'no-cors', // Important for GAS Web Apps
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        console.log("✅ Request sent to Google Sheet (opaque response due to no-cors). Check Sheet for data.");
    } catch (error) {
        console.error("❌ Failed to sync with Google Sheet:", error);
    }
};
