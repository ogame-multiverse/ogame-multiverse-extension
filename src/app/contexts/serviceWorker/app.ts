import browser from 'webextension-polyfill';
import { browserInfo } from '../../dom/browserInfos';
import { serviceWorkerLoggerFactory } from '../../logging/loggerFactory';
import { serviceWorkerProtocolRegistrar } from '../../messaging/serviceWorkerProtocol';
import { ExtensionLocalData } from '../../model/save/extensionLocalData';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { ContextMenusManager } from './contextMenusManager';
import { ExtensionStorageService, StorageArea } from './extensionStorageService';
import { KeyboardCommandsManager } from './keyboardCommandsManager';
import { SaveManager } from './saveManager';
import { SidePanelManager } from './sidePanelManager';
import { UniverseManager } from './universeManager';
import { UniverseTabsService } from './universeTabsManager';
import { Localizator } from '../../localization/localizator';

class ServiceWorkerContextApp {
  private readonly universeManager: UniverseManager;
  private readonly universeTabsService: UniverseTabsService;
  private readonly sidePanelManager: SidePanelManager;
  private readonly contextMenusManager: ContextMenusManager;
  private readonly keyboardCommandsManager: KeyboardCommandsManager
  private readonly saveManager: SaveManager;
  private readonly logger = serviceWorkerLoggerFactory.CreateLogger("ServiceWorkerContextApp");

  constructor() {
    this.saveManager = new SaveManager(new ExtensionStorageService<ExtensionLocalData>(serviceWorkerLoggerFactory.CreateLogger("ExtensionStorageService<ExtensionLocalData>"), StorageArea.Local));
    this.universeTabsService = new UniverseTabsService(serviceWorkerLoggerFactory.CreateLogger("UniverseTabsService"));
    this.sidePanelManager = new SidePanelManager(serviceWorkerLoggerFactory.CreateLogger("SidePanelManager"));
    this.universeManager = new UniverseManager(serviceWorkerLoggerFactory.CreateLogger("UniverseManager"), this.saveManager, this.universeTabsService);
    this.contextMenusManager = new ContextMenusManager(serviceWorkerLoggerFactory.CreateLogger("ContextMenusManager"), this.sidePanelManager);
    this.keyboardCommandsManager = new KeyboardCommandsManager(serviceWorkerLoggerFactory.CreateLogger("KeyboardCommandsManager"), this.sidePanelManager);

    this.RegisterServiceWorkerEvents();

    // Listen for extension installation or update events to reconnect open OGame tabs
    browser.runtime.onInstalled.addListener(this.OnExtensionInstallation);
  }

  private RegisterServiceWorkerEvents(): void {
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

    serviceWorkerProtocolRegistrar.OnToggleSidePanel(this.logger, (_, sender) =>
      this.sidePanelManager.ToggleSidePanel(sender)
    )
  }


  private readonly OnExtensionInstallation = (details: { reason: string }): void => {
    if (details.reason == 'install' || details.reason == 'update') {
      this.contextMenusManager.RegisterContextMenus();
      this.keyboardCommandsManager.RegisterKeyboardCommands();
      this.universeTabsService.ReconnectOpenOgameTabsAsync();
    }
  };

  public async StartAsync(): Promise<void> {
    await browserInfo.InitAsync();
    Localizator.Init(browserInfo.Language);
    await this.universeManager.InitializeAsync();
    this.universeTabsService.Start();
    this.sidePanelManager.Start();
    this.logger.info('OGame Multiverse ✅ Started.');
  }
}

const app = new ServiceWorkerContextApp();
app.StartAsync();