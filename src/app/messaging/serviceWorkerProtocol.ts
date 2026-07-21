import { defineExtensionMessaging } from '@webext-core/messaging'
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
    key: K,
    ...args: Parameters<ServiceWorkerProtocol[K]>
  ): ReturnType<ServiceWorkerProtocol[K]> {
    return serviceWorkerMessenger.sendMessage(key as any, args[0]) as any
  }

  public RegisterUniverseAsync(universeKey: string, universeDomain: string, lastRefreshDate: number) {
    return this.send('RegisterUniverse', { universeKey, universeDomain, lastRefreshDate })
  }

  public UpdateUniverseStatusAsync(universeKey: string, universeName: string, universeCounters: SidePanelUniverseCounters) {
    return this.send('UpdateUniverseStatus', { universeKey, universeName, universeCounters })
  }

  public GetUniversesStatusesAsync() {
    return this.send('GetUniversesStatuses')
  }

  public ReloadUniverseTabAsync(universeKey: string) {
    return this.send('ReloadUniverseTab', universeKey)
  }

  public RemoveUniverseAsync(universeKey: string) {
    return this.send('RemoveUniverse', universeKey)
  }

  public GetUniverseSidePanelOptionsAsync(universeKey: string) {
    return this.send('GetUniverseSidePanelOptions', universeKey)
  }

  public SaveUniverseSidePanelOptionsAsync(universeKey: string, options: UniverseSidePanelOptions) {
    return this.send('SaveUniverseSidePanelOptions', { universeKey, options })
  }
}

export class ServiceWorkerProtocolRegistrar {
  // internal type-safe helper: if 'key' does not exist in ServiceWorkerProtocol, TS refuses to compile
  private listen<K extends keyof ServiceWorkerProtocol>(
    key: K,
    handler: ServiceWorkerProtocol[K]
  ): void {
    serviceWorkerMessenger.onMessage(key as any, ({ data }: any) => {
      console.info(`ServiceWorkerProtocolRegistrar: Received message for ${key}`, data);
      return (handler as Function)(data);
    })
  }

  // directly expose the protocol methods with type safety
  public OnRegisterUniverse(handler: ServiceWorkerProtocol['RegisterUniverse']): void {
    this.listen('RegisterUniverse', handler)
  }

  public OnUpdateUniverseStatus(handler: ServiceWorkerProtocol['UpdateUniverseStatus']): void {
    this.listen('UpdateUniverseStatus', handler)
  }

  public OnGetUniversesStatuses(handler: ServiceWorkerProtocol['GetUniversesStatuses']): void {
    this.listen('GetUniversesStatuses', handler)
  }

  public OnReloadUniverseTab(handler: ServiceWorkerProtocol['ReloadUniverseTab']): void {
    this.listen('ReloadUniverseTab', handler)
  }

  public OnRemoveUniverse(handler: ServiceWorkerProtocol['RemoveUniverse']): void {
    this.listen('RemoveUniverse', handler)
  }

  public OnGetUniverseSidePanelOptions(handler: ServiceWorkerProtocol['GetUniverseSidePanelOptions']): void {
    this.listen('GetUniverseSidePanelOptions', handler)
  }

  public OnSaveUniverseSidePanelOptions(handler: ServiceWorkerProtocol['SaveUniverseSidePanelOptions']): void {
    this.listen('SaveUniverseSidePanelOptions', handler)
  }
}

export const serviceWorkerProtocolClient = new ServiceWorkerProtocolClient()
export const serviceWorkerProtocolRegistrar = new ServiceWorkerProtocolRegistrar()