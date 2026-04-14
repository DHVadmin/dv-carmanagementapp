import { db } from '../firebase';
import { doc, deleteDoc, getDocs, query, collection, where, orderBy, updateDoc, getDoc } from 'firebase/firestore';
import { sendToGoogleSheet } from './googleSheets';

interface LogData {
    id: string;
    type: string; // '운행' | '주유' | '정비'  OR  'driving' | 'fueling' | 'maintenance'
    vehicleId?: string;
    date?: string;
    startDate?: string;
    startTime?: string;
    [key: string]: any;
}

/**
 * Recalculates mileage for all driving logs that occur AFTER the given date/time.
 * Also updates the vehicle's lastMileage.
 */
export const recalculateSubsequentLogs = async (
    vehicleId: string,
    baseDate: string,
    baseTime: string,
    diff: number
) => {
    if (diff === 0) return;
    
    try {
        console.log(`[Recalculate] vehicle: ${vehicleId}, after: ${baseDate} ${baseTime}, diff: ${diff}`);
        
        // Fetch all driving logs for this vehicle
        const q = query(
            collection(db, 'drivingLogs'),
            where('vehicleId', '==', vehicleId)
        );
        const snap = await getDocs(q);
        
        let logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        // Sort logs chronologically
        logs.sort((a, b) => {
            const dateA = a.startDate || a.date || '';
            const dateB = b.startDate || b.date || '';
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            
            const timeA = a.startTime || '';
            const timeB = b.startTime || '';
            return timeA.localeCompare(timeB);
        });

        // Find the index of the log that acts as the "base".
        // We only update logs strictly AFTER the base log.
        let highestEndMileage = 0;
        let foundAnyLogs = false;

        const updatePromises = [];

        for (const log of logs) {
            const logDate = log.startDate || log.date || '';
            const logTime = log.startTime || '';
            
            // Check if this log is AFTER the base log
            const isAfter = logDate > baseDate || (logDate === baseDate && logTime > baseTime);
            
            if (isAfter) {
                const newStart = (log.startMileage || 0) + diff;
                const newEnd = (log.endMileage || 0) + diff;
                
                updatePromises.push(
                    updateDoc(doc(db, 'drivingLogs', log.id), {
                        startMileage: newStart,
                        endMileage: newEnd
                    })
                );
                
                highestEndMileage = Math.max(highestEndMileage, newEnd);
            } else {
                highestEndMileage = Math.max(highestEndMileage, log.endMileage || 0);
            }
            foundAnyLogs = true;
        }

        await Promise.all(updatePromises);
        
        // Update the vehicle's lastMileage based on the absolute latest log
        if (foundAnyLogs) {
            await updateDoc(doc(db, 'vehicles', vehicleId), {
                lastMileage: highestEndMileage
            });
            console.log(`[Recalculate] Updated vehicle ${vehicleId} lastMileage to ${highestEndMileage}`);
        } else {
            // If no logs at all, revert to initialMileage
            const vDoc = await getDoc(doc(db, 'vehicles', vehicleId));
            if (vDoc.exists()) {
                await updateDoc(doc(db, 'vehicles', vehicleId), {
                    lastMileage: vDoc.data().initialMileage || 0
                });
            }
        }
    } catch (e) {
        console.error("[Recalculate] Failed:", e);
    }
};

export const unifiedDeleteLog = async (
    log: LogData,
    sheetUrl?: string,
    onSuccess?: (msg: string) => void,
    onError?: (error: any) => void
) => {
    let collectionName = '';
    if (log.type === '운행' || log.type === 'driving') collectionName = 'drivingLogs';
    else if (log.type === '주유' || log.type === 'fueling') collectionName = 'fuelingLogs';
    else if (log.type === '정비' || log.type === 'maintenance') collectionName = 'maintenanceLogs';

    if (!collectionName) {
        throw new Error(`Unknown log type: ${log.type}`);
    }

    try {
        console.log(`[UnifiedDelete] Deleting ${log.id} from ${collectionName}`);

        // 1. Revert Mileage CHAIN (Only for Driving Logs)
        // Must be done BEFORE deleting the doc to know its precise diff
        let mileageMsg = '';
        if (collectionName === 'drivingLogs' && log.vehicleId) {
            const distanceDiff = -(log.totalDistance || 0);
            const baseDate = log.startDate || log.date || '';
            const baseTime = log.startTime || '';
            
            await recalculateSubsequentLogs(log.vehicleId, baseDate, baseTime, distanceDiff);
            mileageMsg = ` (주행거리 오차 보정 완료)`;
        }

        // 2. Delete from Firestore
        await deleteDoc(doc(db, collectionName, log.id));

        // 3. Sync to Google Sheet
        try {
            await sendToGoogleSheet({ action: 'delete', id: log.id }, sheetUrl);
        } catch (sheetError) {
            console.error("Google Sheet Sync Failed (Non-fatal):", sheetError);
        }

        if (onSuccess) onSuccess(`삭제되었습니다.${mileageMsg}`);

    } catch (e) {
        console.error("Unified Delete Failed:", e);
        if (onError) onError(e);
        else throw e;
    }
};

export const unifiedEditLog = async (
    originalLog: LogData,
    modifiedLog: LogData,
    sheetUrl?: string,
    onSuccess?: (msg: string) => void,
    onError?: (error: any) => void
) => {
    let collectionName = '';
    if (modifiedLog.type === '운행' || modifiedLog.type === 'driving') collectionName = 'drivingLogs';
    else if (modifiedLog.type === '주유' || modifiedLog.type === 'fueling') collectionName = 'fuelingLogs';
    else if (modifiedLog.type === '정비' || modifiedLog.type === 'maintenance') collectionName = 'maintenanceLogs';

    if (!collectionName) {
        throw new Error(`Unknown log type: ${modifiedLog.type}`);
    }

    // Normalize type to pure English for DB
    const finalLogData = { ...modifiedLog };
    if (collectionName === 'drivingLogs') finalLogData.type = 'driving';
    else if (collectionName === 'fuelingLogs') finalLogData.type = 'fueling';
    else if (collectionName === 'maintenanceLogs') finalLogData.type = 'maintenance';

    try {
        console.log(`[UnifiedEdit] Updating ${finalLogData.id} into ${collectionName}`);

        // 1. Mileage Chain Sync (For Driving Logs)
        let mileageMsg = '';
        if (collectionName === 'drivingLogs' && finalLogData.vehicleId) {
            const oldDistance = originalLog.totalDistance || 0;
            const newDistance = finalLogData.totalDistance || 0;
            const distanceDiff = newDistance - oldDistance;

            await updateDoc(doc(db, collectionName, finalLogData.id), finalLogData);

            if (distanceDiff !== 0) {
                const baseDate = finalLogData.startDate || finalLogData.date || '';
                const baseTime = finalLogData.startTime || '';
                await recalculateSubsequentLogs(finalLogData.vehicleId, baseDate, baseTime, distanceDiff);
                mileageMsg = ` (주행거리 오차 자동 보정 적용됨)`;
            } else {
                // Determine if we need to update lastMileage if ONLY endMileage changed without totalDistance changing? 
                // Normally totalDistance = end - start. If total changes, it affects subsequent logs.
            }
        } else {
            await updateDoc(doc(db, collectionName, finalLogData.id), finalLogData);
        }

        // 2. Google Sheet Sync
        try {
            const sheetPayload = {
                action: 'write',
                ...finalLogData,
                logId: finalLogData.id,
                distance: finalLogData.totalDistance,
                date: finalLogData.startDate || finalLogData.date
            };
            await sendToGoogleSheet(sheetPayload, sheetUrl);
        } catch (sheetError) {
            console.error("Google Sheet Sync Error:", sheetError);
        }

        if (onSuccess) onSuccess(`수정되었습니다.${mileageMsg}`);

    } catch (e) {
        console.error("Unified Edit Failed:", e);
        if (onError) onError(e);
        else throw e;
    }
};
