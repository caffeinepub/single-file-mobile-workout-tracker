/**
 * Utility functions for handling timestamps from the backend
 * Backend stores timestamps in nanoseconds, frontend needs milliseconds
 */

/**
 * Detects if a timestamp is in nanoseconds or milliseconds and converts to milliseconds
 * @param timestamp - BigInt timestamp from backend
 * @returns number - Timestamp in milliseconds
 */
export function convertTimestamp(timestamp: bigint): number {
  if (!timestamp || timestamp === 0n) {
    return 0;
  }
  
  const numTimestamp = Number(timestamp);
  
  // Detect nanosecond timestamps (≥1e12 threshold)
  // Nanosecond timestamps are typically 19 digits, millisecond timestamps are 13 digits
  // This threshold works because:
  // - 1e12 milliseconds = ~31,688 years from epoch (way in the future)
  // - 1e12 nanoseconds = ~16.67 minutes from epoch (recent past)
  if (numTimestamp >= 1e12) {
    // Convert nanoseconds to milliseconds
    return numTimestamp / 1_000_000;
  }
  
  // Already in milliseconds
  return numTimestamp;
}

/**
 * Validates if a timestamp is within a reasonable range
 * @param milliseconds - Timestamp in milliseconds
 * @returns boolean - True if valid
 */
export function isValidTimestamp(milliseconds: number): boolean {
  if (milliseconds <= 0) return false;
  
  // Check if timestamp is not too far in the future (allow 1 day buffer)
  const maxTimestamp = Date.now() + 86400000; // 24 hours from now
  if (milliseconds > maxTimestamp) return false;
  
  // Check if timestamp is not too far in the past (after year 2000)
  const minTimestamp = 946684800000; // Jan 1, 2000
  if (milliseconds < minTimestamp) return false;
  
  return true;
}

/**
 * Safely converts a backend timestamp to a Date object
 * @param timestamp - BigInt timestamp from backend
 * @returns Date | null - Date object or null if invalid
 */
export function timestampToDate(timestamp: bigint): Date | null {
  try {
    const milliseconds = convertTimestamp(timestamp);
    
    if (!isValidTimestamp(milliseconds)) {
      return null;
    }
    
    const date = new Date(milliseconds);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  } catch (error) {
    console.error('Error converting timestamp to date:', error);
    return null;
  }
}

/**
 * Formats a backend timestamp to a human-readable string
 * @param timestamp - BigInt timestamp from backend
 * @param options - Intl.DateTimeFormatOptions
 * @returns string - Formatted date string or 'Invalid date'
 */
export function formatTimestamp(
  timestamp: bigint,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = timestampToDate(timestamp);
  
  if (!date) {
    return 'Invalid date';
  }
  
  try {
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return 'Invalid date';
  }
}

/**
 * Formats a backend timestamp to include time
 * @param timestamp - BigInt timestamp from backend
 * @returns string - Formatted date and time string
 */
export function formatTimestampWithTime(timestamp: bigint): string {
  const date = timestampToDate(timestamp);
  
  if (!date) {
    return 'Invalid date';
  }
  
  try {
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    
    return `${timeStr}, ${dateStr}`;
  } catch (error) {
    console.error('Error formatting timestamp with time:', error);
    return 'Invalid date';
  }
}
