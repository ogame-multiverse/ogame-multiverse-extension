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

import { sidePanelBroadcastProtocolClient } from '../../messaging/sidePanelBroadcastProtocol';
import { sidePanelProtocolClient } from '../../messaging/sidePanelProtocol';

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
    serviceWorkerProtocolRegistrar.OnRegisterUniverse(this.logger, async (data: { universeKey: string, universeDomain: string, lastRefreshDate: number }) => {
      await this.universeManager.RegisterUniverseAsync(data.universeKey, data.universeDomain, data.lastRefreshDate);
      if (sidePanelProtocolClient.HasAnyActivePort()) {
        try {
          sidePanelBroadcastProtocolClient.RegisterUniverse(this.logger, data.universeKey, data.universeDomain, data.lastRefreshDate);
        }
        catch (error) {
          this.logger.error(`Failed to broadcast RegisterUniverse for universeKey ${data.universeKey}`, error);
        }
      }
      else this.logger.warn(`No active side panel ports to broadcast RegisterUniverse for universeKey ${data.universeKey}`);
    });

    serviceWorkerProtocolRegistrar.OnUpdateUniverseStatus(this.logger, async (data: { universeKey: string, universeName: string, universeCounters: any }) => {
      await this.universeManager.UpdateUniverseStatusAsync(data.universeKey, data.universeName, data.universeCounters);
      if (sidePanelProtocolClient.HasAnyActivePort()) {
        try {
          sidePanelBroadcastProtocolClient.UpdateUniverseStatus(this.logger, data.universeKey, data.universeName, data.universeCounters);
        }
        catch (error) {
          this.logger.error(`Failed to broadcast UpdateUniverseStatus for universeKey ${data.universeKey}`, error);
        }
      }
      else this.logger.warn(`No active side panel ports to broadcast UpdateUniverseStatus for universeKey ${data.universeKey}`);
    });

    serviceWorkerProtocolRegistrar.OnGetUniversesStatuses(this.logger, () =>
      this.universeManager.ListUniverseStatusesAsync()
    );

    serviceWorkerProtocolRegistrar.OnReloadUniverseTab(this.logger, (data: string) =>
      this.universeTabsService.ReloadUniverseTabAsync(data)
    );

    serviceWorkerProtocolRegistrar.OnRemoveUniverse(this.logger, async (data: string) => {
      await this.universeManager.RemoveUniverseAsync(data);

      if (sidePanelProtocolClient.HasAnyActivePort()) {
        try {
          sidePanelBroadcastProtocolClient.RemoveUniverse(this.logger, data);
        }
        catch (error) {
          this.logger.error(`Failed to broadcast RemoveUniverse for universeKey ${data}`, error);
        }
      }
      else this.logger.warn(`No active side panel ports to broadcast RemoveUniverse for universeKey ${data}`);
    });

    serviceWorkerProtocolRegistrar.OnGetUniverseSidePanelOptions(this.logger, (data: string) =>
      this.saveManager.GetUniverseSidePanelOptionsAsync(data)
    );

    serviceWorkerProtocolRegistrar.OnSaveUniverseSidePanelOptions(this.logger, async (data: { universeKey: string, options: UniverseSidePanelOptions }) => {
      this.saveManager.SaveUniverseSidePanelOptionsAsync(data.universeKey, data.options)
      if (sidePanelProtocolClient.HasAnyActivePort()) {
        try {
          sidePanelBroadcastProtocolClient.UpdateUniverseSidePanelOptions(this.logger, data.universeKey, data.options);
        }
        catch (error) {
          this.logger.error(`Failed to broadcast UpdateUniverseSidePanelOptions for universeKey ${data.universeKey}`, error);
        }
      }
      else this.logger.warn(`No active side panel ports to broadcast UpdateUniverseSidePanelOptions for universeKey ${data.universeKey}`);
    });

    serviceWorkerProtocolRegistrar.OnToggleSidePanel(this.logger, (_, sender) =>
      this.sidePanelManager.ToggleSidePanel(sender)
    );
  }


  private readonly OnExtensionInstallation = (details: { reason: string }): void => {
    if (details.reason == 'install' || details.reason == 'update') {

      this.universeTabsService.ReconnectOpenOgameTabsAsync();
    }
  };

  public async StartAsync(): Promise<void> {
    await browserInfo.InitAsync();
    Localizator.Init(browserInfo.Language);


    await this.universeManager.InitializeAsync();
    this.universeTabsService.Start();
    this.sidePanelManager.Start();

    await this.contextMenusManager.RegisterContextMenusAsync();
    this.keyboardCommandsManager.RegisterKeyboardCommands();
    this.logger.info('OGame Multiverse ✅ Started.');
  }
}

const app = new ServiceWorkerContextApp();
app.StartAsync();