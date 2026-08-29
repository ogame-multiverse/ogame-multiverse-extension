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
    await this.saveManager.AppendToUniverseOrderAsync(universeKey);
  }

  public async RemoveUniverseAsync(universeKey: string): Promise<void> {
    //remove the universe from the local save and update the in-memory map
    await this.saveManager.RemoveUniverseAsync(universeKey);
    this.savesByUniverse.delete(universeKey);
    this.universeDataByUniverse.delete(universeKey);
    await this.saveManager.RemoveFromUniverseOrderAsync(universeKey);
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


  public async ListUniverseStatusesAsync(mode: 'list' | 'grid'): Promise<SidePanelUniverseStatus[][]> {
    const allUniverseKeys = Array.from(this.savesByUniverse.keys());
    await this.universeTabsManager.RebuildOpenTabsStateAsync();

    // Add universe keys from the tabs map that are not already in the savesByUniverse map
    const tabsMapByUniverse = this.universeTabsManager.GetTabsMapByUniverse();
    tabsMapByUniverse.forEach((_, key) => {
      if (!allUniverseKeys.includes(key)) allUniverseKeys.push(key);
    });

    if (mode === 'list') {
      const orderedKeys = await this.SortUniverseKeysByPersistedOrderAsync(allUniverseKeys);
      const orderedUniverses = orderedKeys.map((universeKey) =>
        this.BuildUniverseStatus(universeKey, this.savesByUniverse.get(universeKey), tabsMapByUniverse)
      );
      return [orderedUniverses];
    }

    if (mode === 'grid') {
      const orderedGrid = await this.SortUniverseGridByPersistedOrderAsync(allUniverseKeys);
      return orderedGrid.map((column) =>
        column.map((universeKey) =>
          this.BuildUniverseStatus(universeKey, this.savesByUniverse.get(universeKey), tabsMapByUniverse)
        )
      );
    }

    return [];
  }

  public async SetUniverseOrderAsync(order: string[]): Promise<string[]> {
    const knownKeys = new Set(Array.from(this.savesByUniverse.keys()).map((k) => k.trim().toLowerCase()));
    const filtered = (order || []).filter((k) => typeof k === 'string' && knownKeys.has(k.trim().toLowerCase()));
    const missing = Array.from(knownKeys).filter((k) => !filtered.map((x) => x.trim().toLowerCase()).includes(k)).sort((a, b) => a.localeCompare(b));
    return await this.saveManager.SaveUniverseOrderAsync([...filtered, ...missing]);
  }

  private async SortUniverseKeysByPersistedOrderAsync(allUniverseKeys: string[]): Promise<string[]> {
    const persistedOrder = await this.saveManager.GetUniverseOrderAsync();
    const keyByNormalized = new Map<string, string>();
    allUniverseKeys.forEach((key) => keyByNormalized.set(key.trim().toLowerCase(), key));

    const ordered: string[] = [];
    const consumed = new Set<string>();
    persistedOrder.forEach((normalized) => {
      const original = keyByNormalized.get(normalized);
      if (original && !consumed.has(normalized)) {
        ordered.push(original);
        consumed.add(normalized);
      }
    });

    const remaining = allUniverseKeys.filter((k) => !consumed.has(k.trim().toLowerCase())).sort((a, b) => a.localeCompare(b));
    return [...ordered, ...remaining];
  }

  private async SortUniverseGridByPersistedOrderAsync(allUniverseKeys: string[]): Promise<string[][]> {
    const persistedOrder = await this.saveManager.GetUniverseGridAsync();

    // Map normalized keys to original keys from input
    const keyByNormalized = new Map<string, string>();
    (allUniverseKeys || []).forEach((key) => {
      if (typeof key === 'string') {
        keyByNormalized.set(key.trim().toLowerCase(), key);
      }
    });

    const orderedGrid: string[][] = [];
    const consumed = new Set<string>();

    // Reconstruct the 2D grid layout using persisted column structures
    for (const column of persistedOrder || []) {
      const orderedColumn: string[] = [];
      for (const normalized of column || []) {
        const original = keyByNormalized.get(normalized);
        if (original && !consumed.has(normalized)) {
          orderedColumn.push(original);
          consumed.add(normalized);
        }
      }
      orderedGrid.push(orderedColumn);
    }

    // Collect new or unpositioned keys
    const remaining = (allUniverseKeys || [])
      .filter((k) => typeof k === 'string' && !consumed.has(k.trim().toLowerCase()))
      .sort((a, b) => a.localeCompare(b));

    // Append remaining keys to the first column
    if (remaining.length > 0) {
      if (orderedGrid.length === 0) {
        orderedGrid.push([]);
      }
      orderedGrid[0].push(...remaining);
    }

    return orderedGrid;
  }


  public async SetUniverseGridAsync(grid: string[][]): Promise<string[][]> {
    const knownKeys = new Set(Array.from(this.savesByUniverse.keys()).map((k) => k.trim().toLowerCase()));
    const filteredGrid = (grid || []).map((column) => (column || []).filter((k) => typeof k === 'string' && knownKeys.has(k.trim().toLowerCase())));
    const missing = Array.from(knownKeys).filter((k) => !filteredGrid.flat().map((x) => x.trim().toLowerCase()).includes(k)).sort((a, b) => a.localeCompare(b));
    return await this.saveManager.SaveUniverseGridAsync([...filteredGrid, missing]);
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