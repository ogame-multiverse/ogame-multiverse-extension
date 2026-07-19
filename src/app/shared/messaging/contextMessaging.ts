import { InternalMessage } from './internalMessage';
import { InternalMessageHandlerMap } from './internalMessageHandlerMap';
import { MaybePayloadArg, PayloadOf, ResponseOf } from './messageContracts';
import { GlobalConstants } from "../../globalConstants";
import { EventNameUtil } from './utils/eventNameUtil';
import { TokenUtil } from './utils/tokenUtil';

declare var browser: typeof chrome;
const browserApi = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;

type DomChannelSuffix = 'CTP' | 'PTC';
type DomSenderOrigin = 'page' | 'content';
type DomHandler = (payload: unknown, sender: { origin: DomSenderOrigin }) => Promise<unknown> | unknown;
type DomHandlerMap = Record<string, DomHandler>;

interface DomChannelState {
  pending: Map<string, DomPendingEntry>;
  timeoutMs: number;
  handlerMap: DomHandlerMap;
  token?: string;
  listenerInitialized: boolean;
}

interface DomPendingEntry {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeoutId: number;
}

interface PageToServiceWorkerRelayPayload {
  message: InternalMessage;
  timeoutMs?: number;
}

/**
 * Single entry point for all extension messaging:
 * - Content -> Page (CTP)
 * - Page -> Content (PTC)
 * - Content/Popup -> ServiceWorker (runtime.sendMessage)
 */
export class ContextMessaging {
  private static readonly PAGE_TO_SW_RELAY_TYPE = '__CTX_PAGE_TO_SW_RELAY__';

  private static readonly domChannels: Record<DomChannelSuffix, DomChannelState> = {
    CTP: { pending: new Map(), timeoutMs: 10_000, handlerMap: {}, listenerInitialized: false },
    PTC: { pending: new Map(), timeoutMs: 10_000, handlerMap: {}, listenerInitialized: false },
  };

  private static readonly runtimeState: {
    handlerMap: Record<string, (payload: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown> | unknown>;
    listenerInitialized: boolean;
  } = {
      handlerMap: {},
      listenerInitialized: false,
    };

  private static pageToSwRelayEnabled = false;

  // -------- Public API: Content -> Page --------
  public static OnContentToPage<TMap extends object, TType extends Extract<keyof TMap, string> = Extract<keyof TMap, string>>(
    type: TType,
    handler: (payload: PayloadOf<TMap, TType>, sender: { origin: 'page' }) => Promise<ResponseOf<TMap, TType>> | ResponseOf<TMap, TType>
  ): void;
  public static OnContentToPage(type: string, handler: (payload: unknown, sender: { origin: 'page' }) => Promise<unknown> | unknown): void;
  public static OnContentToPage(map: Record<string, (payload: unknown, sender: { origin: 'page' }) => Promise<unknown> | unknown>): void;
  public static OnContentToPage(
    typeOrMap: string | Record<string, (payload: unknown, sender: { origin: 'page' }) => Promise<unknown> | unknown>,
    handler?: (payload: unknown, sender: { origin: 'page' }) => Promise<unknown> | unknown
  ): void {
    this.OnDom('CTP', 'page', typeOrMap as string | DomHandlerMap, handler as DomHandler | undefined);
  }

  public static SendContentToPage<TMap extends object, TType extends Extract<keyof TMap, string> = Extract<keyof TMap, string>>(
    type: TType,
    ...payload: MaybePayloadArg<PayloadOf<TMap, TType>>
  ): Promise<ResponseOf<TMap, TType>>;
  public static SendContentToPage(type: string, payload?: unknown): Promise<unknown>;
  public static SendContentToPage(type: string, payload?: unknown): Promise<unknown> {
    return this.SendDom('CTP', type, payload);
  }

  public static OnC2P<TMap extends object, TType extends Extract<keyof TMap, string> = Extract<keyof TMap, string>>(
    type: TType,
    handler: (payload: PayloadOf<TMap, TType>, sender: { origin: 'page' }) => Promise<ResponseOf<TMap, TType>> | ResponseOf<TMap, TType>
  ): void;
  public static OnC2P(type: string, handler: (payload: unknown, sender: { origin: 'page' }) => Promise<unknown> | unknown): void;
  public static OnC2P(map: Record<string, (payload: unknown, sender: { origin: 'page' }) => Promise<unknown> | unknown>): void;
  public static OnC2P(
    typeOrMap: string | Record<string, (payload: unknown, sender: { origin: 'page' }) => Promise<unknown> | unknown>,
    handler?: (payload: unknown, sender: { origin: 'page' }) => Promise<unknown> | unknown
  ): void {
    this.OnContentToPage(typeOrMap as string, handler as (payload: unknown, sender: { origin: 'page' }) => Promise<unknown> | unknown);
  }

  public static SendC2P<TMap extends object, TType extends Extract<keyof TMap, string> = Extract<keyof TMap, string>>(
    type: TType,
    ...payload: MaybePayloadArg<PayloadOf<TMap, TType>>
  ): Promise<ResponseOf<TMap, TType>>;
  public static SendC2P(type: string, payload?: unknown): Promise<unknown>;
  public static SendC2P(type: string, payload?: unknown): Promise<unknown> {
    return this.SendContentToPage(type, payload);
  }

  // -------- Public API: Page -> Content --------
  public static OnPageToContent<TMap extends object, TType extends Extract<keyof TMap, string> = Extract<keyof TMap, string>>(
    type: TType,
    handler: (payload: PayloadOf<TMap, TType>, sender: { origin: 'content' }) => Promise<ResponseOf<TMap, TType>> | ResponseOf<TMap, TType>
  ): void;
  public static OnPageToContent(type: string, handler: (payload: unknown, sender: { origin: 'content' }) => Promise<unknown> | unknown): void;
  public static OnPageToContent(map: Record<string, (payload: unknown, sender: { origin: 'content' }) => Promise<unknown> | unknown>): void;
  public static OnPageToContent(
    typeOrMap: string | Record<string, (payload: unknown, sender: { origin: 'content' }) => Promise<unknown> | unknown>,
    handler?: (payload: unknown, sender: { origin: 'content' }) => Promise<unknown> | unknown
  ): void {
    this.OnDom('PTC', 'content', typeOrMap as string | DomHandlerMap, handler as DomHandler | undefined);
  }

  public static SendPageToContent<TMap extends object, TType extends Extract<keyof TMap, string> = Extract<keyof TMap, string>>(
    type: TType,
    ...payload: MaybePayloadArg<PayloadOf<TMap, TType>>
  ): Promise<ResponseOf<TMap, TType>>;
  public static SendPageToContent(type: string, payload?: unknown): Promise<unknown>;
  public static SendPageToContent(type: string, payload?: unknown): Promise<unknown> {
    return this.SendDom('PTC', type, payload);
  }

  public static OnP2Bridge<TMap extends object, TType extends Extract<keyof TMap, string> = Extract<keyof TMap, string>>(
    type: TType,
    handler: (payload: PayloadOf<TMap, TType>, sender: { origin: 'content' }) => Promise<ResponseOf<TMap, TType>> | ResponseOf<TMap, TType>
  ): void;
  public static OnP2Bridge(type: string, handler: (payload: unknown, sender: { origin: 'content' }) => Promise<unknown> | unknown): void;
  public static OnP2Bridge(map: Record<string, (payload: unknown, sender: { origin: 'content' }) => Promise<unknown> | unknown>): void;
  public static OnP2Bridge(
    typeOrMap: string | Record<string, (payload: unknown, sender: { origin: 'content' }) => Promise<unknown> | unknown>,
    handler?: (payload: unknown, sender: { origin: 'content' }) => Promise<unknown> | unknown
  ): void {
    this.OnPageToContent(typeOrMap as string, handler as (payload: unknown, sender: { origin: 'content' }) => Promise<unknown> | unknown);
  }

  public static SendP2Bridge<TMap extends object, TType extends Extract<keyof TMap, string> = Extract<keyof TMap, string>>(
    type: TType,
    ...payload: MaybePayloadArg<PayloadOf<TMap, TType>>
  ): Promise<ResponseOf<TMap, TType>>;
  public static SendP2Bridge(type: string, payload?: unknown): Promise<unknown>;
  public static SendP2Bridge(type: string, payload?: unknown): Promise<unknown> {
    return this.SendPageToContent(type, payload);
  }

  public static SetContentToPageTimeout(ms: number): void {
    this.domChannels.CTP.timeoutMs = ms;
  }

  public static SetPageToContentTimeout(ms: number): void {
    this.domChannels.PTC.timeoutMs = ms;
  }

  // -------- Public API: Content <-> ServiceWorker --------
  public static OnServiceWorker<TMap extends object, TType extends Extract<keyof TMap, string> = Extract<keyof TMap, string>>(
    type: TType,
    handler: (payload: PayloadOf<TMap, TType>, sender: chrome.runtime.MessageSender) => Promise<ResponseOf<TMap, TType>> | ResponseOf<TMap, TType>
  ): void;
  public static OnServiceWorker(type: string, handler: InternalMessageHandlerMap[string]): void;
  public static OnServiceWorker(map: InternalMessageHandlerMap): void;
  public static OnServiceWorker(typeOrMap: string | InternalMessageHandlerMap, handler?: InternalMessageHandlerMap[string]): void {
    if (typeof browserApi.runtime === 'undefined' || !browserApi.runtime.onMessage) {
      throw new Error('Invalid context: ContextMessaging.OnSW() must be called in Background/Service Worker context.');
    }

    if (!this.runtimeState.listenerInitialized) {
      this.SetupRuntimeListener();
      this.runtimeState.listenerInitialized = true;
    }

    if (typeof typeOrMap === 'string') {
      if (!handler) throw new Error('Handler missing for type ' + typeOrMap);
      this.runtimeState.handlerMap[typeOrMap] = handler;
      return;
    }

    for (const [type, mapHandler] of Object.entries(typeOrMap)) {
      this.runtimeState.handlerMap[type] = mapHandler;
    }
  }

  public static async SendToServiceWorker<TMap extends object, TType extends Extract<keyof TMap, string> = Extract<keyof TMap, string>>(
    message: InternalMessage<TType, PayloadOf<TMap, TType>>,
    timeoutMs?: number
  ): Promise<ResponseOf<TMap, TType>>;
  public static async SendToServiceWorker(message: InternalMessage, timeoutMs?: number): Promise<unknown>;
  public static async SendToServiceWorker(message: InternalMessage, timeoutMs: number = 10_000): Promise<unknown> {
    if (!this.HasExtensionRuntimeMessaging()) {
      throw new Error('Invalid context: Cannot send message outside an extension context.');
    }

    return Promise.race([
      (async () => {
        const response = await browserApi.runtime.sendMessage(message);
        if (response && response.error) {
          throw new Error(response.error);
        }
        return response;
      })(),
      new Promise<unknown>((_, reject) => setTimeout(() => reject(new Error('Request timed out (no response from Service Worker).')), timeoutMs)),
    ]);
  }

  public static OnSW<TMap extends object, TType extends Extract<keyof TMap, string> = Extract<keyof TMap, string>>(
    type: TType,
    handler: (payload: PayloadOf<TMap, TType>, sender: chrome.runtime.MessageSender) => Promise<ResponseOf<TMap, TType>> | ResponseOf<TMap, TType>
  ): void;
  public static OnSW(type: string, handler: InternalMessageHandlerMap[string]): void;
  public static OnSW(map: InternalMessageHandlerMap): void;
  public static OnSW(typeOrMap: string | InternalMessageHandlerMap, handler?: InternalMessageHandlerMap[string]): void {
    this.OnServiceWorker(typeOrMap as string, handler as InternalMessageHandlerMap[string]);
  }

  public static async SendSW<TMap extends object, TType extends Extract<keyof TMap, string> = Extract<keyof TMap, string>>(
    message: InternalMessage<TType, PayloadOf<TMap, TType>>,
    timeoutMs?: number
  ): Promise<ResponseOf<TMap, TType>>;
  public static async SendSW(message: InternalMessage, timeoutMs?: number): Promise<unknown>;
  public static async SendSW(message: InternalMessage, timeoutMs: number = 10_000): Promise<unknown> {
    return this.SendToServiceWorker(message, timeoutMs);
  }

  /**
   * Register a generic relay in Content context to forward Page requests to Service Worker.
   * Call once during Content app bootstrap.
   */
  public static EnableP2SWBridge(): void {
    if (this.pageToSwRelayEnabled) return;
    this.OnP2Bridge(this.PAGE_TO_SW_RELAY_TYPE, async (payload: unknown) => {
      const relayPayload = payload as PageToServiceWorkerRelayPayload;
      if (!relayPayload || typeof relayPayload !== 'object' || !relayPayload.message || typeof relayPayload.message.type !== 'string') {
        throw new Error('ContextMessaging: invalid page->service-worker relay payload.');
      }
      return this.SendSW(relayPayload.message, relayPayload.timeoutMs);
    });
    this.pageToSwRelayEnabled = true;
  }

  /**
   * Page-side helper to send directly to Service Worker.
   * - In extension contexts with runtime access: sends directly.
   * - In injected page context: transparently uses the Content relay bridge.
   */
  public static async SendP2SW<TMap extends object, TType extends Extract<keyof TMap, string> = Extract<keyof TMap, string>>(
    message: InternalMessage<TType, PayloadOf<TMap, TType>>,
    timeoutMs?: number
  ): Promise<ResponseOf<TMap, TType>>;
  public static async SendP2SW(message: InternalMessage, timeoutMs?: number): Promise<unknown>;
  public static async SendP2SW(message: InternalMessage, timeoutMs: number = 10_000): Promise<unknown> {
    if (this.HasExtensionRuntimeMessaging()) {
      return this.SendSW(message, timeoutMs);
    }
    return this.SendP2Bridge(this.PAGE_TO_SW_RELAY_TYPE, { message, timeoutMs });
  }

  private static HasExtensionRuntimeMessaging(): boolean {
    const runtime = browserApi.runtime;
    return !!runtime && typeof runtime.sendMessage === 'function' && typeof runtime.id === 'string' && runtime.id.length > 0;
  }

  private static OnDom(channel: DomChannelSuffix, senderOrigin: DomSenderOrigin, typeOrMap: string | DomHandlerMap, handler?: DomHandler): void {
    const state = this.domChannels[channel];

    if (!state.listenerInitialized) {
      state.token = this.EnsureToken();
      this.SetupDomListener(channel, senderOrigin);
      state.listenerInitialized = true;
      this.MarkChannelReady(channel);
    }

    if (typeof typeOrMap === 'string') {
      if (!handler) throw new Error('Handler missing for type ' + typeOrMap);
      state.handlerMap[typeOrMap] = handler;
      return;
    }

    for (const [type, mapHandler] of Object.entries(typeOrMap)) {
      state.handlerMap[type] = mapHandler;
    }
  }

  private static SetupDomListener(channel: DomChannelSuffix, senderOrigin: DomSenderOrigin): void {
    const state = this.domChannels[channel];
    const requestEventName = this.BuildRequestEventName(state.token!, channel);
    document.addEventListener(requestEventName, async (evt: Event) => {
      const custom = evt as CustomEvent<{ type: string; payload: unknown; referer: string }>;
      const msg = custom.detail;
      if (!msg || !msg.type || !msg.referer) return;

      const handler = state.handlerMap[msg.type];
      if (!handler) {
        this.DispatchDomResponse(channel, msg.referer, { error: `No handler for type ${msg.type}` });
        return;
      }

      try {
        const result = await handler(msg.payload, { origin: senderOrigin });
        this.DispatchDomResponse(channel, msg.referer, { success: true, response: result });
      } catch (err) {
        this.DispatchDomResponse(channel, msg.referer, { success: false, error: String(err) });
      }
    });
  }

  private static DispatchDomResponse(channel: DomChannelSuffix, referer: string, detail: unknown): void {
    const state = this.domChannels[channel];
    const responseEventName = this.BuildResponseEventName(state.token!, `${channel}-RESP`, referer);

    let safePayload: unknown;
    try {
      safePayload = { __json: JSON.stringify(detail) };
    } catch (serErr) {
      safePayload = { __jsonError: String(serErr), __stringified: String(detail) };
    }

    document.dispatchEvent(new CustomEvent(responseEventName, { detail: safePayload }));
  }

  private static SendDom(channel: DomChannelSuffix, type: string, payload?: unknown): Promise<unknown> {
    const state = this.domChannels[channel];
    const token = this.EnsureToken();
    const referer = this.GenerateReferer();
    const requestEventName = this.BuildRequestEventName(token, channel);
    const responseEventName = this.BuildResponseEventName(token, `${channel}-RESP`, referer);
    const timeoutMs = state.timeoutMs;

    return this.WaitForChannelReady(channel, timeoutMs).then(
      () =>
        new Promise((resolve, reject) => {
          const timeoutId = window.setTimeout(() => {
            document.removeEventListener(responseEventName, responseListener);
            state.pending.delete(referer);
            reject(new Error(`ContextMessaging: timeout waiting response for ${type}`));
          }, timeoutMs);

          function responseListener(evt: Event) {
            const rawDetail = (evt as CustomEvent<unknown>).detail;
            let detail: unknown = rawDetail;
            if (detail && typeof detail === 'object') {
              const detailObj = detail as {
                __json?: string;
                __jsonError?: string;
                __stringified?: string;
                error?: string;
                success?: boolean;
                response?: unknown;
              };
              if (typeof detailObj.__json === 'string') {
                try {
                  detail = JSON.parse(detailObj.__json);
                } catch (parseErr) {
                  detail = { success: false, error: `ContextMessaging: failed to parse response JSON: ${parseErr}` };
                }
              } else if (typeof detailObj.__jsonError === 'string') {
                detail = { success: false, error: detailObj.__jsonError, response: detailObj.__stringified };
              }
            }

            window.clearTimeout(timeoutId);
            document.removeEventListener(responseEventName, responseListener);
            state.pending.delete(referer);
            if (!detail) return reject(new Error(`ContextMessaging: missing response detail for event ${responseEventName}`));
            const safeDetail = detail as { error?: string; success?: boolean; response?: unknown };
            if (safeDetail.error && !safeDetail.success) return reject(new Error(safeDetail.error));
            resolve(safeDetail.response);
          }

          document.addEventListener(responseEventName, responseListener, { once: true });
          state.pending.set(referer, {
            resolve: (value: unknown) => resolve(value),
            reject: (reason: unknown) => reject(reason),
            timeoutId,
          });

          document.dispatchEvent(new CustomEvent(requestEventName, { detail: { type, payload, referer } }));
        })
    );
  }

  private static EnsureToken(): string {
    const existing = document.documentElement.dataset[GlobalConstants.DATASET_NAME];
    if (!existing || existing === '1') {
      const token = TokenUtil.CreateToken();
      document.documentElement.dataset[GlobalConstants.DATASET_NAME] = token;
      return token;
    }
    return existing;
  }

  private static BuildRequestEventName(token: string, channelSuffix: string): string {
    return EventNameUtil.BuildEventName(token, channelSuffix);
  }

  private static BuildReadyEventName(token: string, channelSuffix: string): string {
    return EventNameUtil.BuildEventName(token, `${channelSuffix}-READY`);
  }

  private static MarkChannelReady(channelSuffix: string): void {
    const token = this.EnsureToken();
    const key = `${GlobalConstants.DATASET_NAME}_${channelSuffix}`;
    document.documentElement.dataset[key] = token;
    const readyName = this.BuildReadyEventName(token, channelSuffix);
    document.dispatchEvent(new CustomEvent(readyName, { detail: { ready: true } }));
  }

  private static WaitForChannelReady(channelSuffix: string, timeoutMs = 5000): Promise<void> {
    const token = this.EnsureToken();
    const key = `${GlobalConstants.DATASET_NAME}_${channelSuffix}`;
    if (document.documentElement.dataset[key] === token) return Promise.resolve();

    const readyEventName = this.BuildReadyEventName(token, channelSuffix);
    return new Promise((resolve, reject) => {
      const tid = window.setTimeout(() => {
        document.removeEventListener(readyEventName, listener);
        reject(new Error(`ContextMessaging: channel ${channelSuffix} not ready (timeout ${timeoutMs}ms)`));
      }, timeoutMs);

      function listener(_: Event) {
        window.clearTimeout(tid);
        document.removeEventListener(readyEventName, listener);
        resolve();
      }

      document.addEventListener(readyEventName, listener, { once: true });
    });
  }

  private static BuildResponseEventName(token: string, refererPrefix: string, referer: string): string {
    return EventNameUtil.BuildEventName(token, `${refererPrefix}-${referer}`);
  }

  private static GenerateReferer(): string {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private static SetupRuntimeListener(): void {
    browserApi.runtime.onMessage.addListener((request: InternalMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => {
      this.ResolveRuntimeMessage(request, sender)
        .then(sendResponse)
        .catch((error) => {
          console.error('ContextMessaging Error:', error);
          sendResponse({ error: String(error) });
        });
      return true;
    });
  }

  private static async ResolveRuntimeMessage(request: InternalMessage, sender: chrome.runtime.MessageSender): Promise<unknown> {
    const handler = this.runtimeState.handlerMap[request.type];
    if (!handler) {
      throw new Error(`No handler registered for message type: ${request.type}`);
    }
    return handler(request.payload, sender);
  }
}
