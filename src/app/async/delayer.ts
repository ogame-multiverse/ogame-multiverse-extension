export class Delayer {
  /**
   * Wait until a predicate returns true or is aborted.
   * 
   * @param predicateCallback Synchronous or asynchronous condition check.
   * @param checkInterval Delay between checks in milliseconds (default: 50ms).
   * @param abortSignal AbortSignal for cancellation or timeout.
   */
  public static WaitFor(
    predicateCallback: () => boolean | Promise<boolean>,
    checkInterval = 50,
    abortSignal: AbortSignal
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (abortSignal.aborted) {
        return reject(abortSignal.reason);
      }

      let loopId: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        clearTimeout(loopId);
        abortSignal.removeEventListener('abort', onAbort);
      };

      const onAbort = () => {
        cleanup();
        reject(abortSignal.reason);
      };

      abortSignal.addEventListener('abort', onAbort);

      const check = async () => {
        try {
          if (await predicateCallback()) {
            cleanup();
            return resolve(true);
          }
        } catch (error) {
          cleanup();
          return reject(error);
        }
        loopId = setTimeout(check, checkInterval);
      };

      check();
    });
  }

  /**
   * Waits for a specified duration in milliseconds.
   */
  public static Delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Executes a synchronous or asynchronous method after a specified delay.
   */
  public static async ExecuteAfter<T>(
    callback: () => T | Promise<T>,
    delayMs: number
  ): Promise<T> {
    await Delayer.Delay(delayMs);
    return callback();
  }
}