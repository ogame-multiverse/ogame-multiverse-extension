export class Delayer {
  /**
   * Wait until a predicate returns true or times out.
   * 
   * @param predicateCallback Synchronous or asynchronous condition check.
   * @param checkInterval Delay between checks in milliseconds (default: 50ms).
   * @param timeout Maximum wait time in milliseconds (default: 5000ms).
   * @returns Promise resolving to true when predicate passes.
   */
  public static WaitFor(
    predicateCallback: () => boolean | Promise<boolean>,
    checkInterval = 50,
    timeout = 5000
  ): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      // Fast path: initial check
      try {
        if (await predicateCallback()) {
          return resolve(true);
        }
      } catch (error) {
        return reject(error);
      }

      let timeoutId: number;
      let intervalId: number;

      const cleanup = () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };

      intervalId = setTimeout(async function check() {
        try {
          if (await predicateCallback()) {
            cleanup();
            resolve(true);
            return;
          }
        } catch (error) {
          cleanup();
          reject(error);
          return;
        }

        // Schedule next check
        intervalId = setTimeout(check, checkInterval) as unknown as number;
      }, checkInterval) as unknown as number;

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`waitFor timed out after ${timeout}ms`));
      }, timeout) as unknown as number;
    });
  }
}