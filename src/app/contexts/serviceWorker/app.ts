import { serviceWorkerProtocolRegistrar } from '../../messaging/serviceWorkerProtocol';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { SaveManager } from './saveManager';
import { SidePanelManager } from './sidePanelManager';
import { UniverseManager } from './universeManager';
import { UniverseTabsService } from './universeTabsManager';
import { serviceWorkerLoggerFactory } from '../../logging/loggerFactory';
import { ExtensionStorageService } from './extensionStorageService';
import { StorageArea } from './extensionStorageService';
import { ExtensionLocalData } from '../../model/save/extensionLocalData'

class ServiceWorkerContextApp {
  private readonly universeManager: UniverseManager;
  private readonly universeTabsService: UniverseTabsService;
  private readonly sidePanelManager: SidePanelManager;
  private readonly saveManager: SaveManager;
  private readonly logger = serviceWorkerLoggerFactory.CreateLogger("ServiceWorkerContextApp");

  constructor() {
    this.saveManager = new SaveManager(new ExtensionStorageService<ExtensionLocalData>(serviceWorkerLoggerFactory.CreateLogger("ExtensionStorageService<ExtensionLocalData>"), StorageArea.Local));
    this.universeTabsService = new UniverseTabsService(serviceWorkerLoggerFactory.CreateLogger("UniverseTabsService"));
    this.sidePanelManager = new SidePanelManager(serviceWorkerLoggerFactory.CreateLogger("SidePanelManager"));
    this.universeManager = new UniverseManager(serviceWorkerLoggerFactory.CreateLogger("UniverseManager"), this.saveManager, this.universeTabsService);

    serviceWorkerProtocolRegistrar.OnRegisterUniverse(this.logger, (data: { universeKey: string, universeDomain: string, lastRefreshDate: number }) =>
      this.universeManager.RegisterUniverseAsync(data.universeKey, data.universeDomain, data.lastRefreshDate)
    )

    serviceWorkerProtocolRegistrar.OnUpdateUniverseStatus(this.logger, (data: { universeKey: string, universeName: string, universeCounters: any }) =>
      this.universeManager.UpdateUniverseStatusAsync(data.universeKey, data.universeName, data.universeCounters)
    )

    serviceWorkerProtocolRegistrar.OnGetUniversesStatuses(this.logger, () =>
      this.universeManager.ListUniverseStatusesAsync()
    )

    serviceWorkerProtocolRegistrar.OnReloadUniverseTab(this.logger, (data: string) =>
      this.universeTabsService.ReloadUniverseTabAsync(data)
    )

    serviceWorkerProtocolRegistrar.OnRemoveUniverse(this.logger, (data: string) =>
      this.universeManager.RemoveUniverseAsync(data)
    )

    serviceWorkerProtocolRegistrar.OnGetUniverseSidePanelOptions(this.logger, (data: string) =>
      this.saveManager.GetUniverseSidePanelOptionsAsync(data)
    )

    serviceWorkerProtocolRegistrar.OnSaveUniverseSidePanelOptions(this.logger, (data: { universeKey: string, options: UniverseSidePanelOptions }) =>
      this.saveManager.SaveUniverseSidePanelOptionsAsync(data.universeKey, data.options)
    );
  }

  public async StartAsync(): Promise<void> {
    this.universeManager.InitializeAsync().then(() => {
      this.universeTabsService.Start();
      this.sidePanelManager.Start();
      this.logger.info('OGame Multiverse ✅ Started.');
    });
  }
}

const app = new ServiceWorkerContextApp();
app.StartAsync();