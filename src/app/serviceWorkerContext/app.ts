import { UniverseTabsService } from './UniverseTabsService';
import { SidePanelService } from './SidePanelService';
import { ServiceWorkerMessageRegistrar } from './ServiceWorkerMessageRegistrar';
import { SaveManager } from '../shared/save/saveManager';
import { SidePanelUniverseStatus } from '../shared/messaging/messageContracts';
import { UniverseData } from '../shared/universeData';
import { UniverseRegisterData } from '../shared/UniverseRegisterData';
import { UniverseManager } from './UniverseManager';

class ServiceWorkerContextApp {
  private readonly universeManager: UniverseManager;
  private readonly universeTabsService: UniverseTabsService;
  private readonly sidePanelService: SidePanelService;
  private readonly messageRegistrar: ServiceWorkerMessageRegistrar;
  private readonly saveManager: SaveManager;

  constructor() {
    this.saveManager = new SaveManager();
    this.universeTabsService = new UniverseTabsService();
    this.sidePanelService = new SidePanelService();
    this.universeManager = new UniverseManager(this.saveManager, this.universeTabsService);

    this.messageRegistrar = new ServiceWorkerMessageRegistrar();
    this.messageRegistrar.Register({
      GET_EXTENSION_LOCAL_DATA: this.saveManager.GetExtensionLocalDataAsync.bind(this.saveManager),
      SAVE_EXTENSION_LOCAL_DATA: this.saveManager.SaveExtensionLocalDataAsync.bind(this.saveManager),
      REGISTER_UNIVERSE: this.RegisterUniverseAsync.bind(this),
      LIST_UNIVERSE_STATUSES: this.ListUniverseStatusesAsync.bind(this),
      RELOAD_UNIVERSE_TAB: this.RefreshUniverseTabAsync.bind(this),
      REMOVE_UNIVERSE: this.RemoveUniverseAsync.bind(this),
      UPDATE_UNIVERSE_STATUS: this.UpdateUniverseStatusAsync.bind(this),
    });
  }

  public async StartAsync(): Promise<void> {
    this.universeManager.InitializeAsync().then(() => {
      this.universeTabsService.Start();
      this.sidePanelService.Start();
      console.info('OGame Multiverse ✅ Started.');
    });
  }

  private async ListUniverseStatusesAsync(_: {}): Promise<SidePanelUniverseStatus[]> {
    return await this.universeManager.ListUniverseStatusesAsync();
  }


  public async RegisterUniverseAsync(payload: UniverseRegisterData): Promise<void> {
    await this.universeManager.RegisterUniverseAsync(payload);
  }

  private async RemoveUniverseAsync(payload: { universeKey: string }): Promise<{ removed: boolean }> {
    const universeKey = (payload?.universeKey || '').trim();
    if (!universeKey) return { removed: false };

    try {
      await this.universeManager.RemoveUniverseAsync(universeKey);
      return { removed: true };
    } catch (error) {
      return { removed: false };
    }
  }

  private async RefreshUniverseTabAsync(payload: {
    universeKey: string;
    openIfMissing?: boolean;
    openOnReloadTab?: boolean;
    ensureRefresh?: boolean;
  }): Promise<{ refreshed: boolean }> {
    const universeKey = (payload?.universeKey || '').trim();
    if (!universeKey) return { refreshed: false };

    return {
      refreshed: await this.universeTabsService.RefreshUniverseTabAsync(universeKey, {
        openIfMissing: !!payload?.openIfMissing,
        openOnReloadTab: !!payload?.openOnReloadTab,
        ensureRefresh: !!payload?.ensureRefresh,
      }),
    };
  }


  public async UpdateUniverseStatusAsync(payload: { universeKey: string; universeData: UniverseData }): Promise<void> {
    console.debug('Updating universe status', payload);
    const universeKey = (payload?.universeKey || '').trim();
    if (!universeKey) return;

    return this.universeManager.UpdateUniverseStatusAsync(universeKey, payload?.universeData);
  }


}

const app = new ServiceWorkerContextApp();
app.StartAsync();