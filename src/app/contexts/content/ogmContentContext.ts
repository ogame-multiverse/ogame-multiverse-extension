import { serviceWorkerProtocolClient } from '../../messaging/serviceWorkerProtocol';
import { SidePanelUniverseCounters } from '../../model/sidePanel/sidePanelUniverseCounters';
import { OgmSingleton } from '../../ogmSingleton';
import { UniverseDataNormalizer } from '../../universeDataNormalizer';
import { OgameMetadatas } from './ogameMetadatas';
import { OgmWindowUtils } from './ogmWindowUtils';
import { contentScriptLoggerFactory } from '../../logging/loggerFactory';
import { Logger } from '../../logging/logger';

export class OgmContentContext extends OgmSingleton {

  constructor(private readonly logger: Logger = contentScriptLoggerFactory.CreateLogger('OgmContentContext')) {
    super();
  }
  public static get Instance(): OgmContentContext {
    return super.GetInstance<OgmContentContext>();
  }

  public async InitializeAsync(): Promise<void> {
    await this.RegisterUniverseAsync();
  }

  private async RegisterUniverseAsync(): Promise<void> {
    const universeKey = UniverseDataNormalizer.NormalizeUniverseKey(OgmWindowUtils.UNIVERSE_KEY);
    if (universeKey !== '') {
      await serviceWorkerProtocolClient.RegisterUniverseAsync(this.logger, universeKey, OgmWindowUtils.DOMAIN, Date.now());
    }
  }

  public async UpdateUniverseStatusAsync(counters: SidePanelUniverseCounters) {
    const universeKey = UniverseDataNormalizer.NormalizeUniverseKey(OgmWindowUtils.UNIVERSE_KEY);
    if (universeKey !== '') {
      await serviceWorkerProtocolClient.UpdateUniverseStatusAsync(this.logger, universeKey, OgameMetadatas.UniverseName(), counters);
    }
  }
}
