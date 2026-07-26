import { defineExtensionMessaging } from '@webext-core/messaging';
import { Logger } from '../logging/logger';
import { SidePanelUniverseCounters } from '../model/sidePanel/sidePanelUniverseCounters';

export interface SidePanelBroadcastProtocol {
  RegisterUniverse(data: { universeKey: string, universeDomain: string, lastRefreshDate: number }): Promise<void>
  UpdateUniverseStatus(data: { universeKey: string, universeName: string, universeCounters: SidePanelUniverseCounters }): Promise<void>
  UpdateUniverseSidePanelOptions(data: { universeKey: string }): Promise<void>
  RemoveUniverse(universeKey: string): Promise<void>
}

const sidePanelBroadcastMessenger = defineExtensionMessaging<SidePanelBroadcastProtocol>()

export class SidePanelBroadcastProtocolClient {
  // internal type-safe helper: if 'key' does not exist in SidePanelBroadcastProtocol, TS refuses to compile
  private send<K extends keyof SidePanelBroadcastProtocol>(
    logger: Logger,
    key: K,
    ...args: Parameters<SidePanelBroadcastProtocol[K]>
  ): ReturnType<SidePanelBroadcastProtocol[K]> {
    logger.debug(`Sending message for SidePanelBroadcastProtocol.${key}`, args[0]);
    return sidePanelBroadcastMessenger.sendMessage(key as any, args[0]) as any
  }

  public RegisterUniverseAsync(logger: Logger, universeKey: string, universeDomain: string, lastRefreshDate: number) {
    return this.send(logger, 'RegisterUniverse', { universeKey, universeDomain, lastRefreshDate })
  }

  public UpdateUniverseStatusAsync(logger: Logger, universeKey: string, universeName: string, universeCounters: SidePanelUniverseCounters) {
    return this.send(logger, 'UpdateUniverseStatus', { universeKey, universeName, universeCounters })
  }
  public UpdateUniverseSidePanelOptionsAsync(logger: Logger, universeKey: string) {
    return this.send(logger, 'UpdateUniverseSidePanelOptions', { universeKey })
  }
  public RemoveUniverseAsync(logger: Logger, universeKey: string) {
    return this.send(logger, 'RemoveUniverse', universeKey)
  }
}
export class SidePanelBroadcastProtocolRegistrar {
  private listen(logger: Logger, key: string, handler: Function): void {
    sidePanelBroadcastMessenger.onMessage(key as any, ({ data, sender }: any) => {
      logger.debug(`Received message for SidePanelBroadcastProtocol.${key}`, data);
      return handler(data, sender);
    });
  }

  public OnRegisterUniverse(logger: Logger, handler: SidePanelBroadcastProtocol['RegisterUniverse']): void {
    this.listen(logger, 'RegisterUniverse', handler);
  }

  public OnUpdateUniverseStatus(logger: Logger, handler: SidePanelBroadcastProtocol['UpdateUniverseStatus']): void {
    this.listen(logger, 'UpdateUniverseStatus', handler);
  }

  public OnUpdateUniverseSidePanelOptions(logger: Logger, handler: SidePanelBroadcastProtocol['UpdateUniverseSidePanelOptions']): void {
    this.listen(logger, 'UpdateUniverseSidePanelOptions', handler);
  }

  public OnRemoveUniverse(logger: Logger, handler: SidePanelBroadcastProtocol['RemoveUniverse']): void {
    this.listen(logger, 'RemoveUniverse', handler);
  }
}

export const sidePanelBroadcastProtocolClient = new SidePanelBroadcastProtocolClient();
export const sidePanelBroadcastProtocolRegistrar = new SidePanelBroadcastProtocolRegistrar();
