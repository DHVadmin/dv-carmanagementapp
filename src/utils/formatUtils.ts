/**
 * Formats a number or string with thousands separators.
 * @param value - The number or string to format.
 * @returns The formatted string (e.g., "1,234"). Returns empty string if invalid.
 */
export const formatNumberWithComma = (value: number | string | undefined | null): string => {
    if (value === undefined || value === null || value === '') return '';
    const num = Number(value);
    if (isNaN(num)) return '';
    return num.toLocaleString();
};
