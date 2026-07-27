import { OgameCookies } from './ogameCookies';
import { LocalizationStrings } from '../types/LocalizationStrings';

export class NumberUtils {
  // Overloads: allow calling with (value), (value, min) or (value, min, max)
  // Accept string arrays too (from jQuery .val()) and use the first element.
  public static Normalise(value: number | string | string[] | undefined): number;
  public static Normalise(value: number | string | string[] | undefined, min: number): number;
  public static Normalise(value: number | string | string[] | undefined, min: number, max: number): number;
  // asInt: when true, parse as integer (handle thousand separators and sign)
  public static Normalise(value: number | string | string[] | undefined, min?: number, max?: number, asInt?: boolean): number;
  public static Normalise(value: number | string | string[] | undefined, min?: number, max?: number, asInt?: boolean): number {
    // If value is an array (e.g., from jQuery .val()), take the first element
    const raw = Array.isArray(value) ? value[0] : value;
    if (typeof raw === 'undefined') {
      // no value provided: treat as invalid number
      return typeof min === 'number' ? min : 0;
    }
    let n: number;
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (asInt) {
        // integer parsing: accept signs and strip thousand separators
        const m = s.match(/-?[\d][\d.,\s]*/);
        if (!m) {
          n = NaN;
        } else {
          const cleaned = m[0].replace(/[.,\s]/g, '').replace(/\+/g, '');
          n = parseInt(cleaned === '' ? '0' : cleaned, 10);
        }
      } else {
        n = parseFloat(s);
      }
    } else {
      n = raw as number;
      if (asInt) n = Math.trunc(n);
    }

    if (Number.isNaN(n)) {
      // If invalid and a min is provided, return min; otherwise return 0
      return typeof min === 'number' ? min : 0;
    }
    if (typeof min === 'number' && typeof max === 'number') {
      if (n < min) return min;
      if (n > max) return max;
      return n;
    }
    if (typeof min === 'number') {
      // only lower bound
      return n < min ? min : n;
    }
    if (typeof max === 'number') {
      // only upper bound
      return n > max ? max : n;
    }
    return n;
  }

  public static ToLocalisedFormattedString(
    localizationStrings: LocalizationStrings | undefined,
    value: number,
    precision: number | undefined = undefined,
    displayUnit = false
  ): string {
    if (value == 0) return '0';
    const commaSeparator = ['us', 'en', 'ro', 'zh'];
    const locale = commaSeparator.includes(OgameCookies.PlayerLanguage) ? 'en-US' : 'de-DE';

    if (isNaN(value) || value === undefined || value == null) return '';

    if (displayUnit) {
      let neg = false;
      if (value < 0) {
        neg = true;
        value *= -1;
      }

      const abbrev = [
        '',
        localizationStrings?.unitKilo ?? 'K',
        (localizationStrings?.unitMega ?? OgameCookies.PlayerLanguage === 'fr') ? 'M' : 'Mn', // if localizationStrings is undefined, fall back to "M" or "Mn"
        OgameCookies.PlayerLanguage === 'fr' ? 'G' : (localizationStrings?.unitMilliard ?? 'Bn'), // if localizationStrings is undefined, fall back to "Bn"
        'T',
      ];
      const unrangifiedOrder = Math.floor(Math.log10(Math.abs(value)) / 3);
      const order = Math.max(0, Math.min(unrangifiedOrder, abbrev.length - 1));
      const suffix = abbrev[order];

      if (precision == null) {
        let significantDigits = 3;
        let maxPrecision = String(value / Math.pow(10, order * 3)).split('.')[1] ? String(value / Math.pow(10, order * 3)).split('.')[1].length : 0;
        let prevPrecision = Math.max(significantDigits - String(value / Math.pow(10, order * 3)).split('.')[0].length);
        for (let p = Math.min(maxPrecision, prevPrecision); p > 0; p--) {
          if (
            (value / Math.pow(10, order * 3))
              .toLocaleString(locale, {
                minimumFractionDigits: p,
                maximumFractionDigits: p,
              })
              .slice(-1) !== '0'
          ) {
            precision = p;
            break;
          }
        }
      }
      return (
        (neg ? '-' : '') +
        (value / Math.pow(10, order * 3)).toLocaleString(locale, {
          minimumFractionDigits: 0,
          maximumFractionDigits: Array.isArray(precision) && precision[1] != null ? precision[1] : Array.isArray(precision) && precision[0] != null ? precision[0] : precision,
        }) +
        suffix
      );
    } else {
      return value.toLocaleString(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: precision ? precision : 2,
      });
    }
  }

  public static FromLocalisedFormattedString(localizationStrings: LocalizationStrings, value: string | any, int = false, noGroup = false): number {
    if (!value) return 0;
    if (typeof value !== 'string') {
      value = String(value);
    }

    const decimalSeparator = localizationStrings.decimalPoint;
    const groupSeparator = localizationStrings.thousandSeperator;
    let order = 1;

    // Handle unit suffixes
    if (value.includes('T')) {
      order = 1e12;
      value = value.replace('T', '');
    } else if (value.includes(localizationStrings.unitMilliard)) {
      order = 1e9;
      value = value.replace(localizationStrings.unitMilliard, '');
    } else if (value.includes(localizationStrings.unitMega)) {
      order = 1e6;
      value = value.replace(localizationStrings.unitMega, '');
    } else if (value.includes(localizationStrings.unitKilo) || value.includes('k')) {
      order = 1e3;
      value = value.replace(localizationStrings.unitKilo, '').replace('k', '');
    }

    // Remove group separators first (thousands separators)
    if (!noGroup && groupSeparator) {
      // Use a more robust regex to avoid issues with special characters
      const escapedGroupSeparator = groupSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      value = value.replace(new RegExp(escapedGroupSeparator, 'g'), '');
    }

    // Special case: if user types "3.000" but thousandSeparator is "," and decimalSeparator is "."
    // This means they're probably using "." as thousands separator incorrectly
    // Convert patterns like "3.000" to "3000" (remove the dot, keep all digits)
    if (!noGroup && groupSeparator !== '.' && decimalSeparator === '.') {
      // Replace ALL dots with nothing (treat them as thousands separators)
      value = value.replace(/\./g, '');
    }

    // Replace decimal separator with standard dot for Number parsing
    if (decimalSeparator && decimalSeparator !== '.') {
      value = value.replace(decimalSeparator, '.');
    }

    let num = Number(value);
    if (isNaN(num)) {
      num = 0;
    }

    num *= order;
    return int ? Math.trunc(num) : num;
  }
}
