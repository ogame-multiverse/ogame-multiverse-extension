export class Debouncer {
  /**
   * Internal timers for keyed debounces.
   */
  private static debounceTimers: Map<string, number> = new Map<string, number>();
  private static debounceCounter: number = 0;

  /**
   * Wrapper Variant: Wraps a function to delay its execution until after `wait` milliseconds 
   * have elapsed since the last time it was invoked.
   * 
   * @usecase Best for event listeners (e.g., input, scroll, window resize) or component/instance 
   * methods stored in a variable. Guarantees zero risk of key collisions across different modules.
   * 
   * @param func The function to debounce.
   * @param wait The delay in milliseconds.
   * @param immediate If true, triggers the function on the leading edge instead of the trailing.
   * @returns A debounced function wrapper with an attached `.cancel()` method.
   */
  public static Debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate?: boolean
  ): ((...args: Parameters<T>) => void) & { cancel: () => void };

  /**
   * Keyed Variant: Debounces a callback imperatively based on a unique string identifier.
   * 
   * @usecase Best for inline calls or dynamic entity-based debouncing (e.g., auto-saving per item ID:
   * `Debounce(`save-planet-${id}`, callback, 500)`), without having to store or maintain a wrapper reference.
   * 
   * @param key Unique string identifier for tracking this debounced execution.
   * @param callback The action or async task to execute after the delay.
   * @param wait The delay in milliseconds.
   * @param immediate If true, triggers the callback on the leading edge instead of the trailing.
   */
  public static Debounce(
    key: string,
    callback: () => void | Promise<void>,
    wait: number,
    immediate?: boolean
  ): void;

  // Implementation
  public static Debounce(
    arg1: string | ((...args: any[]) => any),
    arg2: number | (() => void | Promise<void>),
    arg3?: number | boolean,
    arg4?: boolean
  ): (((...args: any[]) => void) & { cancel: () => void }) | void {

    // Keyed variant: Debounce(key, callback, wait, immediate?)
    if (typeof arg1 === 'string') {
      const key = arg1;
      const callback = arg2 as () => void | Promise<void>;
      const wait = arg3 as number;
      const immediate = arg4 ?? false;

      Debouncer.RunDebounce(key, callback, wait, immediate);
      return;
    }

    // Wrapper variant: Debounce(func, wait, immediate?)
    const func = arg1;
    const wait = arg2 as number;
    const immediate = (arg3 as boolean) ?? false;
    const key = `debounce-func-${++Debouncer.debounceCounter}`;

    const debounced = function (this: unknown, ...args: unknown[]): void {
      const context = this;
      Debouncer.RunDebounce(
        key,
        () => {
          func.apply(context, args);
        },
        wait,
        immediate
      );
    };

    const typedDebounced = debounced as ((...args: unknown[]) => void) & { cancel: () => void };

    typedDebounced.cancel = () => {
      Debouncer.CancelDebounceKey(key);
    };

    return typedDebounced;
  }

  /**
   * Shared core for both keyed scheduling and wrapper-based debounce.
   * - If `immediate` is true: invoke on leading edge, no trailing call.
   * - If `immediate` is false: invoke after `wait` ms of inactivity.
   */
  private static RunDebounce(key: string, callback: () => void | Promise<void>, wait: number, immediate: boolean): void {
    const existing = Debouncer.debounceTimers.get(key);
    const callNow = immediate && existing === undefined;

    if (existing !== undefined) {
      clearTimeout(existing);
    }

    if (callNow) {
      try {
        const result = callback();
        if (result instanceof Promise) {
          result.catch(() => { });
        }
      } catch { }
    }

    const timeoutId = setTimeout(async () => {
      Debouncer.debounceTimers.delete(key);
      if (!immediate) {
        try {
          await callback();
        } catch { }
      }
    }, wait) as unknown as number;

    Debouncer.debounceTimers.set(key, timeoutId);
  }

  /**
   * Cancel a pending debounced callback for the given key (if any).
   */
  public static CancelDebounceKey(key: string): void {
    const existing = Debouncer.debounceTimers.get(key);
    if (existing !== undefined) {
      clearTimeout(existing);
      Debouncer.debounceTimers.delete(key);
    }
  }

  /**
   * Cancel all pending debounced callbacks across the application.
   */
  public static CancelAll(): void {
    for (const [key, timerId] of Debouncer.debounceTimers.entries()) {
      clearTimeout(timerId);
    }
    Debouncer.debounceTimers.clear();
  }
}