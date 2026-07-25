import $ from 'jquery';
import { contentScriptLoggerFactory } from '../../logging/loggerFactory';
import { serviceWorkerProtocolClient } from '../../messaging/serviceWorkerProtocol';
import { UniverseDataNormalizer } from '../../universeDataNormalizer';
import { OgameEventsScanner } from './ogameEventsScanner';
import { OgmWindowUtils } from './ogmWindowUtils';
import { SidebarManager } from './sidebarManager';





// Entry point for the content context. Initializes into an IFE to avoid polluting global scope. 
(() => {
  class ContentContextApp {
    private readonly logger = contentScriptLoggerFactory.CreateLogger("ContentContextApp");
    private readonly ogameEventsScanner = new OgameEventsScanner(contentScriptLoggerFactory.CreateLogger("OgameEventsScanner"));
    private readonly sidebarManager = new SidebarManager(contentScriptLoggerFactory.CreateLogger("SidebarManager"));

    public async StartAsync(): Promise<void> {

      await Promise.all([this.sidebarManager.RenderSidebarAsync(),
      this.RegisterUniverseAsync()]);

      $(() => {
        // Start the header scanner after the DOM is ready
        this.ogameEventsScanner.StartAsync();
      });

    }


    private async RegisterUniverseAsync(): Promise<void> {
      const universeKey = UniverseDataNormalizer.NormalizeUniverseKey(OgmWindowUtils.UNIVERSE_KEY);
      if (universeKey !== '') {
        await serviceWorkerProtocolClient.RegisterUniverseAsync(this.logger, universeKey, OgmWindowUtils.DOMAIN, Date.now());
      }
    }

  }



  const app = new ContentContextApp();
  app.StartAsync();

})();