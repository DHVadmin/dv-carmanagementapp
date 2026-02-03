
import { db } from '../firebase';
import { doc, deleteDoc, getDocs, query, collection, where, orderBy, limit, updateDoc, getDoc } from 'firebase/firestore';
import { sendToGoogleSheet } from './googleSheets';

interface LogData {
    id: string;
    type: string; // '운행' | '주유' | '정비'  OR  'driving' | 'fueling' | 'maintenance' (handled internally)
    vehicleId?: string;
    date?: string;
    startTime?: string;
    [key: string]: any;
}

export const unifiedDeleteLog = async (
    log: LogData,
    sheetUrl?: string,
    onSuccess?: (msg: string) => void,
    onError?: (error: any) => void
) => {
    let collectionName = '';
    // Normalize Type
    if (log.type === '운행' || log.type === 'driving') collectionName = 'drivingLogs';
    else if (log.type === '주유' || log.type === 'fueling') collectionName = 'fuelingLogs';
    else if (log.type === '정비' || log.type === 'maintenance') collectionName = 'maintenanceLogs';

    if (!collectionName) {
        throw new Error(`Unknown log type: ${log.type}`);
    }

    try {
        console.log(`[UnifiedDelete] Deleting ${log.id} from ${collectionName}`);

        // 1. Delete from Firestore
        await deleteDoc(doc(db, collectionName, log.id));

        // 2. Sync to Google Sheet
        try {
            await sendToGoogleSheet({ action: 'delete', id: log.id }, sheetUrl);
        } catch (sheetError) {
            console.error("Google Sheet Sync Failed (Non-fatal):", sheetError);
        }

        // 3. Revert Mileage (Only for Driving Logs)
        let mileageMsg = '';
        if (collectionName === 'drivingLogs' && log.vehicleId) {
            try {
                // Find the new latest log for this vehicle
                const q = query(
                    collection(db, 'drivingLogs'),
                    where('vehicleId', '==', log.vehicleId),
                    orderBy('date', 'desc'),
                    orderBy('startTime', 'desc'),
                    limit(1)
                );
                const snap = await getDocs(q);

                let newMileage = 0;

                if (!snap.empty) {
                    newMileage = snap.docs[0].data().endMileage || 0;
                } else {
                    // No logs left? revert to vehicle Initial Mileage
                    const vDoc = await getDoc(doc(db, 'vehicles', log.vehicleId));
                    if (vDoc.exists()) {
                        newMileage = vDoc.data().initialMileage || 0;
                    }
                }

                // Update Vehicle
                await updateDoc(doc(db, 'vehicles', log.vehicleId), {
                    lastMileage: newMileage
                });
                mileageMsg = ` 차량 누적거리가 ${newMileage.toLocaleString()}km 로 복구되었습니다.`;
            } catch (mileageError) {
                console.error("Mileage Revert Failed:", mileageError);
                mileageMsg = " (주행거리 복구 실패)";
            }
        }

        if (onSuccess) onSuccess(`삭제되었습니다.${mileageMsg}`);

    } catch (e) {
        console.error("Unified Delete Failed:", e);
        if (onError) onError(e);
        else throw e;
    }
};
