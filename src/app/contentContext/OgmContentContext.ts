import { ContextMessaging } from '../shared/messaging/contextMessaging';
import { OgmWindowUtils } from './OgmWindowUtils';
import { OgmSingleton } from './OgmSingleton';
import { ExtensionLocalData } from '../shared/save/extensionLocalData'
import { ServiceWorkerMessageMap } from '../shared/messaging/messageContracts';
import { OgameMetadatas } from './OgameMetadatas';
import { UniverseData } from '../shared/universeData';
import { UniverseRegisterData } from '../shared/UniverseRegisterData';

export class OgmContentContext extends OgmSingleton {
  public Data: ExtensionLocalData;
  public static get Instance(): OgmContentContext {
    return super.GetInstance<OgmContentContext>();
  }

  public async InitializeAsync(): Promise<void> {
    await this.RegisterUniverseAsync();
  }

  private async RegisterUniverseAsync(): Promise<void> {
    await ContextMessaging.SendSW<ServiceWorkerMessageMap, 'REGISTER_UNIVERSE'>({
      type: 'REGISTER_UNIVERSE',
      payload: new UniverseRegisterData({
        UniverseKey: OgmWindowUtils.UNIVERSE_KEY,
        UniverseName: OgameMetadatas.UniverseName(),
        UniverseDomain: OgmWindowUtils.DOMAIN,
        LastRefreshDate: Date.now()
      })
    });
  }

  public async UpdateUniverseStatusAsync(fleetCounters: { hostile: number, friendly: number, own: number },
    messagesCounters: { messages: number, chat: number }) {

    const universeData = new UniverseData(
      {
        UniverseName: OgameMetadatas.UniverseName(),
        HostileFleetCount: fleetCounters.hostile,
        FriendlyFleetCount: fleetCounters.friendly,
        OwnFleetCount: fleetCounters.own,
        MessagesCount: messagesCounters.messages,
        ChatMessagesCount: messagesCounters.chat,
      });

    await ContextMessaging.SendSW<ServiceWorkerMessageMap, 'UPDATE_UNIVERSE_STATUS'>({
      type: 'UPDATE_UNIVERSE_STATUS',
      payload: { universeKey: OgmWindowUtils.UNIVERSE_KEY, universeData }
    });
  }
}
