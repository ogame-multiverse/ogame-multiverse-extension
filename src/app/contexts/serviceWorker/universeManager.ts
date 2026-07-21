import { ExtensionLocalData } from "../../model/save/extensionLocalData";
import { SidePanelUniverseCounters } from "../../model/sidePanel/sidePanelUniverseCounters";
import { SidePanelUniverseStatus } from "../../model/sidePanel/sidePanelUniverseStatus";
import { UniverseSidePanelOptions } from "../../model/sidePanel/universeSidePanelOptions";
import { UniverseDataNormalizer } from "../../universeDataNormalizer";
import { SaveManager } from "./saveManager";
import { UniverseTabsService } from "./universeTabsManager";
export class UniverseManager {

  private readonly universeDataByUniverse = new Map<string, { universeName: string, universeCounters: SidePanelUniverseCounters }>();
  private readonly savesByUniverse = new Map<string, ExtensionLocalData>();

  private readonly saveManager: SaveManager;
  private readonly universeTabsService: UniverseTabsService
  constructor(saveManager: SaveManager, universeTabsService: UniverseTabsService) {
    this.saveManager = saveManager;
    this.universeTabsService = universeTabsService;
  }

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

      console.info(`[Init] Initialisé avec succès. Nombre d'univers : ${this.savesByUniverse.size}`);
    } catch (error) {
      console.error("[Init] Erreur d'initialisation :", error);
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
    console.info(`[ListUniverseStatusesAsync] Found ${allUniverseKeys.length} universe(s) in local save.`);

    await this.universeTabsService.RebuildOpenTabsStateAsync();
    const openTabsCountByUniverse = this.universeTabsService.GetOpenTabsCountByUniverse(allUniverseKeys);

    return Array.from(allUniverseKeys)
      .sort((a, b) => a.localeCompare(b))
      .map((universeKey) => this.BuildUniverseStatus(universeKey, this.savesByUniverse.get(universeKey), openTabsCountByUniverse));
  }

  private BuildUniverseStatus(universeKey: string, universe: ExtensionLocalData | undefined, openTabsCountByUniverse: Map<string, number>): SidePanelUniverseStatus {
    const openTabsCount = openTabsCountByUniverse.get(universeKey) || 0;
    const lastRefreshAtMs = universe?.LastRefreshDate;

    const universeData = this.universeDataByUniverse.get(universeKey);
    const detectedDisplayName = universe?.UniverseName;

    return new SidePanelUniverseStatus({
      UniverseKey: universeKey,
      UniverseDisplayName: detectedDisplayName || UniverseDataNormalizer.ToUniverseDisplayName(universeKey),
      IsOpen: openTabsCount > 0,
      OpenTabsCount: openTabsCount,
      LastRefreshAtIso: typeof lastRefreshAtMs === 'number' ? new Date(lastRefreshAtMs).toISOString() : undefined,
      SidePanelOptions: universe?.SidePanelOptions || new UniverseSidePanelOptions({}),
      SidePanelUniverseCounters: universeData?.universeCounters || new SidePanelUniverseCounters({})


    });
  }




}