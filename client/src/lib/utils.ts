import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isValid } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely format a date value, returning a fallback if the date is invalid
 */
export function safeFormatDate(
  dateValue: string | Date | null | undefined,
  formatString: string = "MMM d, yyyy",
  fallback: string = "No date"
): string {
  if (!dateValue) return fallback;
  
  try {
    const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
    if (!isValid(date) || isNaN(date.getTime())) {
      return fallback;
    }
    return format(date, formatString);
  } catch {
    return fallback;
  }
}
