import { defineExtensionMessaging } from '@webext-core/messaging'
import { Logger } from '../logging/logger'
import { SidePanelUniverseCounters } from '../model/sidePanel/sidePanelUniverseCounters'
import { SidePanelUniverseStatus } from '../model/sidePanel/sidePanelUniverseStatus'
import { UniverseSidePanelOptions } from '../model/sidePanel/universeSidePanelOptions'

export interface ServiceWorkerProtocol {
  RegisterUniverse(data: { universeKey: string, universeDomain: string, lastRefreshDate: number }): Promise<void>
  UpdateUniverseStatus(data: { universeKey: string, universeName: string, universeCounters: SidePanelUniverseCounters }): Promise<void>
  GetUniversesStatuses(): Promise<SidePanelUniverseStatus[]>
  ReloadUniverseTab(universeKey: string): Promise<void>
  RemoveUniverse(universeKey: string): Promise<void>
  GetUniverseSidePanelOptions(universeKey: string): Promise<UniverseSidePanelOptions>
  SaveUniverseSidePanelOptions(data: { universeKey: string, options: UniverseSidePanelOptions }): Promise<void>
}

const serviceWorkerMessenger = defineExtensionMessaging<ServiceWorkerProtocol>()

export class ServiceWorkerProtocolClient {
  // internal type-safe helper: if 'key' does not exist in ServiceWorkerProtocol, TS refuses to compile
  private send<K extends keyof ServiceWorkerProtocol>(
    logger: Logger,
    key: K,
    ...args: Parameters<ServiceWorkerProtocol[K]>
  ): ReturnType<ServiceWorkerProtocol[K]> {
    logger.debug(`Sending message for ServiceWorkerProtocol.${key}`, args[0]);
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

  public ReloadUniverseTabAsync(logger: Logger, universeKey: string) {
    return this.send(logger, 'ReloadUniverseTab', universeKey)
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
}

export class ServiceWorkerProtocolRegistrar {
  // internal type-safe helper: if 'key' does not exist in ServiceWorkerProtocol, TS refuses to compile
  private listen<K extends keyof ServiceWorkerProtocol>(
    logger: Logger,
    key: K,
    handler: ServiceWorkerProtocol[K]
  ): void {
    serviceWorkerMessenger.onMessage(key as any, ({ data }: any) => {
      logger.debug(`Received message for ServiceWorkerProtocol.${key}`, data);
      return (handler as Function)(data);
    })
  }

  // directly expose the protocol methods with type safety
  public OnRegisterUniverse(logger: Logger, handler: ServiceWorkerProtocol['RegisterUniverse']): void {
    this.listen(logger, 'RegisterUniverse', handler)
  }

  public OnUpdateUniverseStatus(logger: Logger, handler: ServiceWorkerProtocol['UpdateUniverseStatus']): void {
    this.listen(logger, 'UpdateUniverseStatus', handler)
  }

  public OnGetUniversesStatuses(logger: Logger, handler: ServiceWorkerProtocol['GetUniversesStatuses']): void {
    this.listen(logger, 'GetUniversesStatuses', handler)
  }

  public OnReloadUniverseTab(logger: Logger, handler: ServiceWorkerProtocol['ReloadUniverseTab']): void {
    this.listen(logger, 'ReloadUniverseTab', handler)
  }

  public OnRemoveUniverse(logger: Logger, handler: ServiceWorkerProtocol['RemoveUniverse']): void {
    this.listen(logger, 'RemoveUniverse', handler)
  }

  public OnGetUniverseSidePanelOptions(logger: Logger, handler: ServiceWorkerProtocol['GetUniverseSidePanelOptions']): void {
    this.listen(logger, 'GetUniverseSidePanelOptions', handler)
  }

  public OnSaveUniverseSidePanelOptions(logger: Logger, handler: ServiceWorkerProtocol['SaveUniverseSidePanelOptions']): void {
    this.listen(logger, 'SaveUniverseSidePanelOptions', handler)
  }
}

export const serviceWorkerProtocolClient = new ServiceWorkerProtocolClient();
export const serviceWorkerProtocolRegistrar = new ServiceWorkerProtocolRegistrar();