import { ExtensionLocalData } from "../../model/save/extensionLocalData";
import { SidePanelUniverseCounters } from "../../model/sidePanel/sidePanelUniverseCounters";
import { SidePanelUniverseStatus } from "../../model/sidePanel/sidePanelUniverseStatus";
import { UniverseSidePanelOptions } from "../../model/sidePanel/universeSidePanelOptions";
import { UniverseDataNormalizer } from "../../universeDataNormalizer";
import { SaveManager } from "./saveManager";
import { UniverseTabsManager } from "./universeTabsManager";
import { Logger } from "../../logging/logger";
export class UniverseManager {

  private readonly universeDataByUniverse = new Map<string, { universeName: string, universeCounters: SidePanelUniverseCounters }>();
  private readonly savesByUniverse = new Map<string, ExtensionLocalData>();

  constructor(private readonly logger: Logger,
    private readonly saveManager: SaveManager,
    private readonly universeTabsManager: UniverseTabsManager) { }

  public async InitializeAsync(): Promise<void> {
    try {
      const universes = await this.saveManager.GetAllExtensionLocalDataAsync();

      // On vide proprement la Map actuelle sans détruire sa référence en mémoire
      this.savesByUniverse.clear();

      if (universes) {
        for (const [key, value] of Object.entries(universes)) {
          this.savesByUniverse.set(key, value);
        }
      }

      this.logger.info('Initialization complete. Loaded universes:', Array.from(this.savesByUniverse.keys()));
    } catch (error) {
      this.logger.error('Error during initialization:', error);
    }
  }

  public async RegisterUniverseAsync(universeKey: string, universeDomain: string, lastRefreshDate: number): Promise<void> {
    const localSave = await this.saveManager.RegisterUniverseAsync(universeKey, universeDomain, lastRefreshDate);
    this.savesByUniverse.set(universeKey, localSave);
  }

  public async RemoveUniverseAsync(universeKey: string): Promise<void> {
    //remove the universe from the local save and update the in-memory map
    await this.saveManager.RemoveUniverseAsync(universeKey);
    this.savesByUniverse.delete(universeKey);
    this.universeDataByUniverse.delete(universeKey);
  }

  public async UpdateUniverseStatusAsync(universeKey: string, universeName: string, universeCounters: SidePanelUniverseCounters): Promise<void> {
    // Update the in-memory universe data
    this.universeDataByUniverse.set(universeKey, { universeName, universeCounters });

    // Update the local save with the new universe name if it has changed
    const localSave = this.savesByUniverse.get(universeKey);
    if (localSave && localSave.UniverseName !== universeName) {
      localSave.UniverseName = universeName;
      await this.saveManager.SaveExtensionLocalDataAsync(universeKey, localSave);
    }
  }


  public async ListUniverseStatusesAsync(): Promise<SidePanelUniverseStatus[]> {
    const allUniverseKeys = Array.from(this.savesByUniverse.keys());
    await this.universeTabsManager.RebuildOpenTabsStateAsync();
    const openTabsCountByUniverse = this.universeTabsManager.GetOpenTabsCountByUniverse(allUniverseKeys);

    // Add universe keys from the tabs map that are not already in the savesByUniverse map
    const tabsMapByUniverse = this.universeTabsManager.GetTabsMapByUniverse();
    // This ensures that we include universes that have open tabs but may not have a saved state yet
    tabsMapByUniverse.forEach((_, key) => {
      if (!allUniverseKeys.includes(key)) allUniverseKeys.push(key);
    });

    return Array.from(allUniverseKeys)
      .sort((a, b) => a.localeCompare(b))
      .map((universeKey) => this.BuildUniverseStatus(universeKey, this.savesByUniverse.get(universeKey), tabsMapByUniverse));
  }

  private BuildUniverseStatus(universeKey: string, universe: ExtensionLocalData | undefined, tabsMapByUniverse: Map<string, number[]>): SidePanelUniverseStatus {
    const tabIds = tabsMapByUniverse.get(universeKey) || [];
    const lastRefreshAtMs = universe?.LastRefreshDate;

    const universeData = this.universeDataByUniverse.get(universeKey);
    const detectedDisplayName = universe?.UniverseName;

    return new SidePanelUniverseStatus({
      UniverseKey: universeKey,
      UniverseDisplayName: detectedDisplayName || UniverseDataNormalizer.ToUniverseDisplayName(universeKey),
      IsOpen: tabIds.length > 0,
      TabIds: tabIds, // <--- On passe directement les IDs ici
      LastRefreshAtIso: typeof lastRefreshAtMs === 'number' ? new Date(lastRefreshAtMs).toISOString() : undefined,
      SidePanelOptions: universe?.SidePanelOptions || new UniverseSidePanelOptions({}),
      SidePanelUniverseCounters: universeData?.universeCounters || new SidePanelUniverseCounters({})
    });
  }




}