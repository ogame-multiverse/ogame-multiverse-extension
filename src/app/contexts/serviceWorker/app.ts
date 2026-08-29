import browser from 'webextension-polyfill';
import { browserInfo } from '../../dom/browserInfos';
import { Localizator } from '../../localization/localizator';
import { serviceWorkerLoggerFactory } from '../../logging/loggerFactory';
import { serviceWorkerProtocolRegistrar } from '../../messaging/serviceWorkerProtocol';
import { sidePanelBroadcastProtocolClient } from '../../messaging/sidePanelBroadcastProtocol';
import { ExtensionLocalData } from '../../model/save/extensionLocalData';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { ContextMenusManager } from './contextMenusManager';
import { ExtensionStorageService, StorageArea } from './extensionStorageService';
import { KeyboardCommandsManager } from './keyboardCommandsManager';
import { SaveManager } from './saveManager';
import { SidePanelManager } from './sidePanelManager';
import { UniverseManager } from './universeManager';
import { UniverseTabsManager } from './universeTabsManager';

class ServiceWorkerContextApp {
  private readonly universeManager: UniverseManager;
  private readonly universeTabsManager: UniverseTabsManager;
  private readonly sidePanelManager: SidePanelManager;
  private readonly contextMenusManager: ContextMenusManager;
  private readonly keyboardCommandsManager: KeyboardCommandsManager
  private readonly saveManager: SaveManager;
  private readonly logger = serviceWorkerLoggerFactory.CreateLogger("ServiceWorkerContextApp");

  constructor() {
    this.saveManager = new SaveManager(new ExtensionStorageService(serviceWorkerLoggerFactory.CreateLogger("ExtensionStorageService<ExtensionLocalData>"), StorageArea.Local));
    this.universeTabsManager = new UniverseTabsManager(serviceWorkerLoggerFactory.CreateLogger("UniverseTabsService"));
    this.sidePanelManager = new SidePanelManager(serviceWorkerLoggerFactory.CreateLogger("SidePanelManager"));
    this.universeManager = new UniverseManager(serviceWorkerLoggerFactory.CreateLogger("UniverseManager"), this.saveManager, this.universeTabsManager);
    this.contextMenusManager = new ContextMenusManager(serviceWorkerLoggerFactory.CreateLogger("ContextMenusManager"), this.sidePanelManager);
    this.keyboardCommandsManager = new KeyboardCommandsManager(serviceWorkerLoggerFactory.CreateLogger("KeyboardCommandsManager"), this.sidePanelManager);

    this.RegisterServiceWorkerEvents();

    // Listen for extension installation or update events to reconnect open OGame tabs
    browser.runtime.onInstalled.addListener(this.OnExtensionInstallation);
  }

  private RegisterServiceWorkerEvents(): void {
    serviceWorkerProtocolRegistrar.OnRegisterUniverse(this.logger, async (data: { universeKey: string, universeDomain: string, lastRefreshDate: number }) => {
      await this.universeManager.RegisterUniverseAsync(data.universeKey, data.universeDomain, data.lastRefreshDate);
      sidePanelBroadcastProtocolClient.RegisterUniverse(this.logger, data.universeKey, data.universeDomain, data.lastRefreshDate);
    });

    serviceWorkerProtocolRegistrar.OnUpdateUniverseStatus(this.logger, async (data: { universeKey: string, universeName: string, universeCounters: any }) => {
      await this.universeManager.UpdateUniverseStatusAsync(data.universeKey, data.universeName, data.universeCounters);
      const isOpen = this.universeTabsManager.HasOpenTabForUniverse(data.universeKey);
      sidePanelBroadcastProtocolClient.UpdateUniverseStatus(this.logger, data.universeKey, data.universeName, data.universeCounters, isOpen);
    });

    serviceWorkerProtocolRegistrar.OnGetUniversesStatuses(this.logger, () =>
      this.universeManager.ListUniverseStatusesAsync()
    );

    serviceWorkerProtocolRegistrar.OnActionOnUniverseTab(this.logger, async (data) => {
      await this.universeTabsManager.ActionOnUniverseTabAsync(data.universeKey, data.action, data.windowId);
    });

    serviceWorkerProtocolRegistrar.OnRemoveUniverse(this.logger, async (data: string) => {
      await this.universeManager.RemoveUniverseAsync(data);
      sidePanelBroadcastProtocolClient.RemoveUniverse(this.logger, data);
    });

    serviceWorkerProtocolRegistrar.OnGetUniverseSidePanelOptions(this.logger, (data: string) =>
      this.saveManager.GetUniverseSidePanelOptionsAsync(data)
    );

    serviceWorkerProtocolRegistrar.OnSaveUniverseSidePanelOptions(this.logger, async (data: { universeKey: string, options: UniverseSidePanelOptions }) => {
      this.saveManager.SaveUniverseSidePanelOptionsAsync(data.universeKey, data.options);
      sidePanelBroadcastProtocolClient.UpdateUniverseSidePanelOptions(this.logger, data.universeKey, data.options);
    });

    serviceWorkerProtocolRegistrar.OnSaveUniverseOrder(this.logger, async (order: string[]) => {
      const normalized = await this.universeManager.SetUniverseOrderAsync(order);
      sidePanelBroadcastProtocolClient.UpdateUniverseOrder(this.logger, normalized);
      return normalized;
    });

    serviceWorkerProtocolRegistrar.OnToggleSidePanel(this.logger, (_, sender) =>
      this.sidePanelManager.ToggleSidePanel(sender)
    );
  }


  private readonly OnExtensionInstallation = (details: { reason: string }): void => {
    if (details.reason === 'install' || details.reason === 'update') {
      void this.universeTabsManager.RebuildOpenTabsStateAsync();
    }
  };

  public async StartAsync(): Promise<void> {
    await browserInfo.InitAsync();
    Localizator.Init(browserInfo.Language);


    await this.universeManager.InitializeAsync();
    this.universeTabsManager.Start();
    this.sidePanelManager.Start();

    await this.contextMenusManager.RegisterContextMenusAsync();
    this.keyboardCommandsManager.RegisterKeyboardCommands();
    this.logger.info('OGame Multiverse ✅ Started.');
  }
}

const app = new ServiceWorkerContextApp();
app.StartAsync();