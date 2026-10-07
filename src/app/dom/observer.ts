import $ from 'jquery';

export interface ObserveConfig {
  element: JQuery<HTMLElement>;
  options?: MutationObserverInit;
}

export class Observer {
  private static MutationObserverImpl: any = (window as any).MutationObserver || (window as any).WebKitMutationObserver;

  // Surcharge pour accepter un seul élément ou une liste de configurations
  public static Observe(
    configs: ObserveConfig | ObserveConfig[],
    callback: MutationCallback
  ): MutationObserver | undefined {
    if (!Observer.MutationObserverImpl) return undefined;

    const configList = Array.isArray(configs) ? configs : [configs];
    const defaultOpts: MutationObserverInit = { childList: true, subtree: true };

    const observer = new Observer.MutationObserverImpl(callback);
    let observedCount = 0;

    for (const item of configList) {
      const { element, options } = item;
      if (!element || !element.jquery || element.length === 0) continue;

      const opts: MutationObserverInit = {
        ...defaultOpts,
        ...options,
      };

      element.each((_, el) => {
        if (el && el.nodeType === 1) {
          observer.observe(el, opts);
          observedCount++;
        }
      });
    }

    return observedCount > 0 ? observer : undefined;
  }
}