import $ from 'jquery';
import { Delayer } from './delayer';

export class DomDelayer {
  /**
   * Wait until a DOM element matching the selector exists or times out.
   */
  public static WaitForQuerySelector(
    selector: string,
    checkIntervals = 10,
    timeout = 5000
  ): Promise<JQuery<HTMLElement> | null> {
    return Delayer.WaitFor(() => $(selector).length > 0, checkIntervals, timeout).then(() => {
      return $(selector) ?? null;
    });
  }

  /**
   * Wait until ALL DOM elements matching the given selectors exist or times out.
   */
  public static WaitForAllQuerySelectors(
    selectors: string[],
    checkIntervals = 10,
    timeout = 5000
  ): Promise<JQuery<HTMLElement>[]> {
    if (!selectors || selectors.length === 0) {
      return Promise.resolve([]);
    }

    return Delayer.WaitFor(
      () => selectors.every((selector) => $(selector).length > 0),
      checkIntervals,
      timeout
    ).then(() => selectors.map((selector) => $(selector)));
  }

  /**
   * Wait until AT LEAST ONE DOM element matching any of the given selectors exists or times out.
   * Returns the first matched element found.
   */
  public static WaitForAnyQuerySelector(
    selectors: string[],
    checkIntervals = 10,
    timeout = 5000
  ): Promise<JQuery<HTMLElement> | null> {
    if (!selectors || selectors.length === 0) {
      return Promise.resolve(null);
    }

    return Delayer.WaitFor(
      () => selectors.some((selector) => $(selector).length > 0),
      checkIntervals,
      timeout
    ).then(() => {
      const matchedSelector = selectors.find((selector) => $(selector).length > 0);
      return matchedSelector ? $(matchedSelector) : null;
    });
  }
}