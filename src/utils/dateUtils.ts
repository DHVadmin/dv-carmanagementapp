/**
 * Returns the current date as a YYYY-MM-DD string based on the user's local timezone.
 * This fixes issues where toISOString() returns the previous day during early morning hours in +GMT timezones (like KST).
 */
export const getTodayString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Returns a YYYY-MM-DD string for a given Date object based on local time.
 */
export const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Combines a YYYY-MM-DD date string with the time from a Date object.
 * Returns a new Date object.
 */
export const combineDateAndTime = (dateStr: string, timeObj: Date): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const combined = new Date(timeObj);
    combined.setFullYear(year);
    combined.setMonth(month - 1);
    combined.setDate(day);
    return combined;
};
