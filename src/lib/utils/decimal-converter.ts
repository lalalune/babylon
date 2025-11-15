/**
 * Decimal Converter Utilities
 * 
 * Handles safe conversion of Prisma Decimal values to strings,
 * accounting for serialization from cache (Redis) where Decimal
 * objects may be converted to strings, numbers, or plain objects.
 */

/**
 * Safely convert a value (Decimal, number, string, or unknown) to string
 * 
 * @param value - Value that might be a Prisma Decimal, number, string, or serialized object
 * @param defaultValue - Default value if conversion fails (default: '0')
 * @returns String representation of the value
 * 
 * @example
 * ```typescript
 * // Direct from database (Decimal object)
 * const balance = toSafeString(user.virtualBalance); // "1000.50"
 * 
 * // From cache (might be string, number, or object)
 * const cachedBalance = toSafeString(cachedUser.virtualBalance); // "1000.50"
 * 
 * // Handle null/undefined
 * const emptyBalance = toSafeString(null); // "0"
 * ```
 */
export function toSafeString(value: unknown, defaultValue = '0'): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return defaultValue;
  }

  // Already a string - return as-is
  if (typeof value === 'string') {
    return value;
  }

  // Number - convert to string
  if (typeof value === 'number') {
    return value.toString();
  }

  // Object with toString method (like Prisma Decimal)
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    try {
      return (value as { toString: () => string }).toString();
    } catch {
      // If toString fails, fall through to default handling
    }
  }

  // Fallback: coerce to string
  try {
    return String(value);
  } catch {
    return defaultValue;
  }
}

/**
 * Safely convert a value to number
 * 
 * @param value - Value that might be a Prisma Decimal, number, string, or serialized object
 * @param defaultValue - Default value if conversion fails (default: 0)
 * @returns Numeric representation of the value
 * 
 * @example
 * ```typescript
 * const balance = toSafeNumber(user.virtualBalance); // 1000.5
 * const invalid = toSafeNumber(null); // 0
 * const custom = toSafeNumber(undefined, 100); // 100
 * ```
 */
export function toSafeNumber(value: unknown, defaultValue = 0): number {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return defaultValue;
  }

  // Already a number - return as-is
  if (typeof value === 'number') {
    return value;
  }

  // String - parse as float
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  // Object with toString method - convert to string then parse
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    try {
      const str = (value as { toString: () => string }).toString();
      const parsed = parseFloat(str);
      return isNaN(parsed) ? defaultValue : parsed;
    } catch {
      // If conversion fails, fall through to default handling
    }
  }

  // Fallback: try to coerce to number
  try {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  } catch {
    return defaultValue;
  }
}

/**
 * Convert multiple balance-related fields to strings safely
 * 
 * @param balanceData - Object containing balance fields
 * @returns Object with all balance fields as strings
 * 
 * @example
 * ```typescript
 * const balanceStrings = convertBalanceToStrings({
 *   virtualBalance: user.virtualBalance,
 *   totalDeposited: user.totalDeposited,
 *   totalWithdrawn: user.totalWithdrawn,
 *   lifetimePnL: user.lifetimePnL,
 * });
 * // Returns: { virtualBalance: "1000.50", totalDeposited: "5000.00", ... }
 * ```
 */
export function convertBalanceToStrings(balanceData: {
  virtualBalance?: unknown;
  totalDeposited?: unknown;
  totalWithdrawn?: unknown;
  lifetimePnL?: unknown;
}): {
  virtualBalance: string;
  totalDeposited: string;
  totalWithdrawn: string;
  lifetimePnL: string;
} {
  return {
    virtualBalance: toSafeString(balanceData.virtualBalance),
    totalDeposited: toSafeString(balanceData.totalDeposited),
    totalWithdrawn: toSafeString(balanceData.totalWithdrawn),
    lifetimePnL: toSafeString(balanceData.lifetimePnL),
  };
}


