import { defineExtensionMessaging } from '@webext-core/messaging';
import browser from 'webextension-polyfill';
import { GlobalConstants } from '../globalConstants';
import { Logger } from '../logging/logger';
import { SidePanelUniverseCounters } from '../model/sidePanel/sidePanelUniverseCounters';
import { SidePanelUniverseStatus } from '../model/sidePanel/sidePanelUniverseStatus';
import { UniverseSidePanelOptions } from '../model/sidePanel/universeSidePanelOptions';

export interface ServiceWorkerProtocol {
  RegisterUniverse(data: { universeKey: string, universeDomain: string, lastRefreshDate: number }): Promise<void>
  UpdateUniverseStatus(data: { universeKey: string, universeName: string, universeCounters: SidePanelUniverseCounters }): Promise<void>
  GetUniversesStatuses(): Promise<SidePanelUniverseStatus[]>
  ActionOnUniverseTab(data: { universeKey: string, action: 'activate' | 'move' | 'close' | 'refresh', windowId: number }): Promise<void>
  RemoveUniverse(universeKey: string): Promise<void>
  GetUniverseSidePanelOptions(universeKey: string): Promise<UniverseSidePanelOptions>
  SaveUniverseSidePanelOptions(data: { universeKey: string, options: UniverseSidePanelOptions }): Promise<void>
  SaveUniverseOrder(order: string[]): Promise<string[]>
  ToggleSidePanel(): void
}

const serviceWorkerMessenger = defineExtensionMessaging<ServiceWorkerProtocol>()

export class ServiceWorkerProtocolClient {
  // internal type-safe helper: if 'key' does not exist in ServiceWorkerProtocol, TS refuses to compile
  private send<K extends keyof ServiceWorkerProtocol>(
    logger: Logger,
    key: K,
    ...args: Parameters<ServiceWorkerProtocol[K]>
  ): ReturnType<ServiceWorkerProtocol[K]> {
    if (GlobalConstants.PROTOCOL_LOGGING_ENABLED) logger.debug(`Sending message for ServiceWorkerProtocol.${key}`, args[0]);
    return serviceWorkerMessenger.sendMessage(key as any, args[0]) as any
  }

  public RegisterUniverseAsync(logger: Logger, universeKey: string, universeDomain: string, lastRefreshDate: number) {
    return this.send(logger, 'RegisterUniverse', { universeKey, universeDomain, lastRefreshDate })
  }

  public UpdateUniverseStatusAsync(logger: Logger, universeKey: string, universeName: string, universeCounters: SidePanelUniverseCounters) {
    return this.send(logger, 'UpdateUniverseStatus', { universeKey, universeName, universeCounters })
  }

  public GetUniversesStatusesAsync(logger: Logger) {
    return this.send(logger, 'GetUniversesStatuses')
  }

  public ActionOnUniverseTabAsync(logger: Logger, universeKey: string, action: 'activate' | 'move' | 'close' | 'refresh', windowId: number) {
    return this.send(logger, 'ActionOnUniverseTab', { universeKey, action, windowId })
  }

  public RemoveUniverseAsync(logger: Logger, universeKey: string) {
    return this.send(logger, 'RemoveUniverse', universeKey)
  }

  public GetUniverseSidePanelOptionsAsync(logger: Logger, universeKey: string) {
    return this.send(logger, 'GetUniverseSidePanelOptions', universeKey)
  }

  public SaveUniverseSidePanelOptionsAsync(logger: Logger, universeKey: string, options: UniverseSidePanelOptions) {
    return this.send(logger, 'SaveUniverseSidePanelOptions', { universeKey, options })
  }

  public SaveUniverseOrderAsync(logger: Logger, order: string[]) {
    return this.send(logger, 'SaveUniverseOrder', order)
  }

  public ToggleSidePanel(logger: Logger) {
    return this.send(logger, 'ToggleSidePanel');
  }
}
export class ServiceWorkerProtocolRegistrar {
  private listen(logger: Logger, key: string, handler: Function): void {
    serviceWorkerMessenger.onMessage(key as any, ({ data, sender }: any) => {
      if (GlobalConstants.PROTOCOL_LOGGING_ENABLED) logger.debug(`Received message for ServiceWorkerProtocol.${key}`, data);
      return handler(data, sender);
    });
  }

  public OnRegisterUniverse(logger: Logger, handler: ServiceWorkerProtocol['RegisterUniverse']): void {
    this.listen(logger, 'RegisterUniverse', handler);
  }

  public OnUpdateUniverseStatus(logger: Logger, handler: ServiceWorkerProtocol['UpdateUniverseStatus']): void {
    this.listen(logger, 'UpdateUniverseStatus', handler);
  }

  public OnGetUniversesStatuses(logger: Logger, handler: ServiceWorkerProtocol['GetUniversesStatuses']): void {
    this.listen(logger, 'GetUniversesStatuses', handler);
  }

  public OnActionOnUniverseTab(logger: Logger, handler: ServiceWorkerProtocol['ActionOnUniverseTab']): void {
    this.listen(logger, 'ActionOnUniverseTab', handler);
  }

  public OnRemoveUniverse(logger: Logger, handler: ServiceWorkerProtocol['RemoveUniverse']): void {
    this.listen(logger, 'RemoveUniverse', handler);
  }

  public OnGetUniverseSidePanelOptions(logger: Logger, handler: ServiceWorkerProtocol['GetUniverseSidePanelOptions']): void {
    this.listen(logger, 'GetUniverseSidePanelOptions', handler);
  }

  public OnSaveUniverseSidePanelOptions(logger: Logger, handler: ServiceWorkerProtocol['SaveUniverseSidePanelOptions']): void {
    this.listen(logger, 'SaveUniverseSidePanelOptions', handler);
  }

  public OnSaveUniverseOrder(logger: Logger, handler: ServiceWorkerProtocol['SaveUniverseOrder']): void {
    this.listen(logger, 'SaveUniverseOrder', handler);
  }

  public OnToggleSidePanel(logger: Logger, handler: (data: void, sender: browser.Runtime.MessageSender) => void): void {
    this.listen(logger, 'ToggleSidePanel', handler);
  }
}

export const serviceWorkerProtocolClient = new ServiceWorkerProtocolClient();
export const serviceWorkerProtocolRegistrar = new ServiceWorkerProtocolRegistrar();