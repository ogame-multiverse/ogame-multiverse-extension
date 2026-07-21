import { serviceWorkerProtocolRegistrar } from '../../messaging/serviceWorkerProtocol';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { SaveManager } from './saveManager';
import { SidePanelManager } from './sidePanelManager';
import { UniverseManager } from './universeManager';
import { UniverseTabsService } from './universeTabsManager';

class ServiceWorkerContextApp {
  private readonly universeManager: UniverseManager;
  private readonly universeTabsService: UniverseTabsService;
  private readonly sidePanelManager: SidePanelManager;
  private readonly saveManager: SaveManager;

  constructor() {
    this.saveManager = new SaveManager();
    this.universeTabsService = new UniverseTabsService();
    this.sidePanelManager = new SidePanelManager();
    this.universeManager = new UniverseManager(this.saveManager, this.universeTabsService);

    serviceWorkerProtocolRegistrar.OnRegisterUniverse((data: { universeKey: string, universeDomain: string, lastRefreshDate: number }) =>
      this.universeManager.RegisterUniverseAsync(data.universeKey, data.universeDomain, data.lastRefreshDate)
    )

    serviceWorkerProtocolRegistrar.OnUpdateUniverseStatus((data: { universeKey: string, universeName: string, universeCounters: any }) =>
      this.universeManager.UpdateUniverseStatusAsync(data.universeKey, data.universeName, data.universeCounters)
    )

    serviceWorkerProtocolRegistrar.OnGetUniversesStatuses(() =>
      this.universeManager.ListUniverseStatusesAsync()
    )

    serviceWorkerProtocolRegistrar.OnReloadUniverseTab((data: string) =>
      this.universeTabsService.ReloadUniverseTabAsync(data)
    )

    serviceWorkerProtocolRegistrar.OnRemoveUniverse((data: string) =>
      this.universeManager.RemoveUniverseAsync(data)
    )

    serviceWorkerProtocolRegistrar.OnGetUniverseSidePanelOptions((data: string) =>
      this.saveManager.GetUniverseSidePanelOptionsAsync(data)
    )

    serviceWorkerProtocolRegistrar.OnSaveUniverseSidePanelOptions((data: { universeKey: string, options: UniverseSidePanelOptions }) =>
      this.saveManager.SaveUniverseSidePanelOptionsAsync(data.universeKey, data.options)
    );
  }

  public async StartAsync(): Promise<void> {
    this.universeManager.InitializeAsync().then(() => {
      this.universeTabsService.Start();
      this.sidePanelManager.Start();
      console.info('OGame Multiverse ✅ Started.');
    });
  }
}

const app = new ServiceWorkerContextApp();
app.StartAsync();