export type DateInput = Date | string | number;

export class DateUtils {

  public static TwelveHoursInMilliseconds = 12 * 60 * 60 * 1000;
  public static SixHoursInMilliseconds = 6 * 60 * 60 * 1000;
  public static OneHourInMilliseconds = 60 * 60 * 1000;
  public static ThirtyMinutesInMilliseconds = 30 * 60 * 1000;
  public static FifteenMinutesInMilliseconds = 15 * 60 * 1000;
  public static TenMinutesInMilliseconds = 10 * 60 * 1000;
  public static FiveMinutesInMilliseconds = 5 * 60 * 1000;
  public static OneMinuteInMilliseconds = 60 * 1000;
  public static FiveSecondsInMilliseconds = 5 * 1000;

  /**
   * Returns the current date and time as an ISO string.
   * @returns The current date and time in ISO 8601 format.
   */
  public static NowAsIsoString(): string {
    return new Date().toISOString();
  }

  /**
   * Normalizes the input into a valid Date object.
   */
  private static ToDate(date: DateInput): Date {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }
    return d;
  }

  /**
   * Checks if date1 is strictly before date2.
   */
  public static IsBefore(date1: DateInput, date2: DateInput): boolean {
    return this.ToDate(date1).getTime() < this.ToDate(date2).getTime();
  }

  /**
   * Checks if date1 is strictly after date2.
   */
  public static IsAfter(date1: DateInput, date2: DateInput): boolean {
    return this.ToDate(date1).getTime() > this.ToDate(date2).getTime();
  }

  /**
   * Checks if two dates refer to the exact same millisecond.
   */
  public static AreEquals(date1: DateInput, date2: DateInput): boolean {
    return this.ToDate(date1).getTime() === this.ToDate(date2).getTime();
  }

  /**
   * Checks if two dates fall on the same calendar day (Year / Month / Day).
   */
  public static AreSameDay(date1: DateInput, date2: DateInput): boolean {
    const d1 = this.ToDate(date1);
    const d2 = this.ToDate(date2);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  /**
   * Checks if a date falls within a given range.
   */
  public static IsBetween(
    date: DateInput,
    start: DateInput,
    end: DateInput,
    inclusive = true
  ): boolean {
    const target = this.ToDate(date).getTime();
    const min = Math.min(this.ToDate(start).getTime(), this.ToDate(end).getTime());
    const max = Math.max(this.ToDate(start).getTime(), this.ToDate(end).getTime());

    return inclusive ? target >= min && target <= max : target > min && target < max;
  }

  /**
   * Calculates the difference in milliseconds between two dates.
   */
  public static DiffInMs(date1: DateInput, date2: DateInput, absolute = false): number {
    const diff = this.ToDate(date1).getTime() - this.ToDate(date2).getTime();
    return absolute ? Math.abs(diff) : diff;
  }

  /**
   * Calculates the difference in full seconds between two dates.
   */
  public static DiffInSeconds(date1: DateInput, date2: DateInput, absolute = false): number {
    const diffMs = this.DiffInMs(date1, date2, absolute);
    return Math.trunc(diffMs / 1000);
  }

  /**
   * Calculates the difference in full minutes between two dates.
   */
  public static DiffInMinutes(date1: DateInput, date2: DateInput, absolute = false): number {
    const diffMs = this.DiffInMs(date1, date2, absolute);
    return Math.trunc(diffMs / (1000 * 60));
  }

  /**
   * Calculates the difference in full hours between two dates.
   */
  public static DiffInHours(date1: DateInput, date2: DateInput, absolute = false): number {
    const diffMs = this.DiffInMs(date1, date2, absolute);
    return Math.trunc(diffMs / (1000 * 60 * 60));
  }

  /**
   * Calculates the difference in full days between two dates.
   */
  public static DiffInDays(date1: DateInput, date2: DateInput, absolute = false): number {
    const diffMs = this.DiffInMs(date1, date2, absolute);
    return Math.trunc(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Converts a timestamp (in seconds or milliseconds) to an ISO string.
   * Automatically converts seconds to milliseconds if needed.
   */
  public static TimestampToIsoString(timestamp: number | string): string {
    let ms = typeof timestamp === 'string' ? Number(timestamp) : timestamp;

    if (!ms || isNaN(ms)) {
      ms = Date.now();
    } else if (ms < 1_000_000_000_000) {
      ms *= 1000; // Convert seconds to milliseconds
    }

    return this.ToDate(ms).toISOString();
  }

    public static DateIsObsolete(
    dateInput: DateInput | null | undefined,
    thresholdMilliseconds: number
  ): boolean {
    if (!dateInput) return true;

    const timestamp = dateInput instanceof Date ? dateInput.getTime() : new Date(dateInput).getTime();

    // If the timestamp is NaN, it means the dateInput was invalid, so we consider it obsolete.
    if (Number.isNaN(timestamp)) return true;

    return Date.now() - timestamp > thresholdMilliseconds;
  }
}