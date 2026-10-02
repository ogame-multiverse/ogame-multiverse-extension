// Global declarations for variables/functions injected by the game environment
// and legacy script helpers. This file prevents TS from complaining about
// those names in editor/compile-time.

import type { LocalizationStrings } from './LocalizationStrings';

declare global {
  /** serverTime provided by the page: ISO string, timestamp (ms) or Date */
  const serverTime: Date;

  /** ogame strings provided by the page */
  var LocalizationStrings: LocalizationStrings;

  /** jQuery XHR object for the last AJAX request made by the page */
  var xhr: JQueryXHR | undefined;
}

export {};
