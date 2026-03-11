
/**
 * Formats a number with specified decimal places.
 * Handles undefined/null/NaN gracefully.
 */
export const formatNumber = (value: number | undefined | null, decimals: number = 1): string => {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
};

/**
 * Formats a value as a percentage string.
 */
export const formatPercent = (value: number | undefined | null, decimals: number = 1): string => {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    return `${formatNumber(value, decimals)}%`;
};

/**
 * Formats a number as a Rank (e.g. 1,000). 
 * Ranks typically don't have decimals.
 */
export const formatRank = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0
    }).format(value);
};

/**
 * Formats duration in minutes to "Xh Ym" or "X min".
 */
export const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
};

/**
 * Formats a date string (YYYY-MM-DD) to a readable locale string (e.g., "Oct 15").
 */
export const formatDateShort = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
        return dateString;
    }
};

/**
 * Formats a date string to full readable format.
 */
export const formatDateFull = (dateString: string): string => {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return dateString;
    }
};
