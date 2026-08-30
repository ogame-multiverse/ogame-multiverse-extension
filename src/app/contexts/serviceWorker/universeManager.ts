import { ExtensionLocalData } from "../../model/save/extensionLocalData";
import { SidePanelUniverseCounters } from "../../model/sidePanel/sidePanelUniverseCounters";
import { SidePanelUniverseStatus } from "../../model/sidePanel/sidePanelUniverseStatus";
import { SidePanelUniversesSections } from "../../model/sidePanel/sidePanelUniversesSections";
import { UniverseLayoutConfig } from "../../model/sidePanel/universeLayoutConfig";
import { UniverseSidePanelOptions } from "../../model/sidePanel/universeSidePanelOptions";
import { UniverseDataNormalizer } from "../../universeDataNormalizer";
import { SaveManager } from "./saveManager";
import { UniverseTabsManager } from "./universeTabsManager";
import { Logger } from "../../logging/logger";

export class UniverseManager {
  private readonly universeDataByUniverse = new Map<string, { universeName: string, universeCounters: SidePanelUniverseCounters }>();
  private readonly savesByUniverse = new Map<string, ExtensionLocalData>();

  constructor(
    private readonly logger: Logger,
    private readonly saveManager: SaveManager,
    private readonly universeTabsManager: UniverseTabsManager
  ) { }

  public async InitializeAsync(): Promise<void> {
    try {
      const universes = await this.saveManager.GetAllExtensionLocalDataAsync();
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
    await this.saveManager.AppendToUniverseOrderAndGridAsync(universeKey);
  }

  public async RemoveUniverseAsync(universeKey: string): Promise<void> {
    await this.saveManager.RemoveUniverseAsync(universeKey);
    this.savesByUniverse.delete(universeKey);
    this.universeDataByUniverse.delete(universeKey);
    await this.saveManager.RemoveFromUniverseOrderAndGridAsync(universeKey);
  }

  public async UpdateUniverseStatusAsync(universeKey: string, universeName: string, universeCounters: SidePanelUniverseCounters): Promise<void> {
    this.universeDataByUniverse.set(universeKey, { universeName, universeCounters });
    const localSave = this.savesByUniverse.get(universeKey);
    if (localSave && localSave.UniverseName !== universeName) {
      localSave.UniverseName = universeName;
      await this.SaveExtensionLocalDataAsync(universeKey, localSave);
    }
  }

  public async ListUniverseStatusesAsync(mode: 'list' | 'grid'): Promise<SidePanelUniversesSections> {
    const allUniverseKeys = Array.from(this.savesByUniverse.keys());
    await this.universeTabsManager.RebuildOpenTabsStateAsync();

    const tabsMapByUniverse = this.universeTabsManager.GetTabsMapByUniverse();
    tabsMapByUniverse.forEach((_, key) => {
      if (!allUniverseKeys.includes(key)) allUniverseKeys.push(key);
    });

    const layout = await this.saveManager.GetUniverseLayoutConfigAsync();
    const favKeySet = new Set<string>();

    if (mode === 'list') {
      (layout.favoriteListOrder || []).forEach((k) => favKeySet.add(k));
    } else {
      (layout.favoriteGridOrder || []).flat().forEach((k) => favKeySet.add(k));
    }

    const favKeys = allUniverseKeys.filter((k) => favKeySet.has(k.trim().toLowerCase()));
    const otherKeys = allUniverseKeys.filter((k) => !favKeySet.has(k.trim().toLowerCase()));

    if (mode === 'list') {
      const favOrdered = this.SortKeysByPersistedOrder(favKeys, layout.favoriteListOrder);
      const otherOrdered = this.SortKeysByPersistedOrder(otherKeys, layout.listOrder);

      return {
        favorites: [favOrdered.map((key) => this.BuildUniverseStatus(key, this.savesByUniverse.get(key), tabsMapByUniverse))],
        others: [otherOrdered.map((key) => this.BuildUniverseStatus(key, this.savesByUniverse.get(key), tabsMapByUniverse))],
      };
    } else {
      const favGridOrdered = this.SortGridByPersistedOrder(favKeys, layout.favoriteGridOrder);
      const otherGridOrdered = this.SortGridByPersistedOrder(otherKeys, layout.gridOrder);

      return {
        favorites: favGridOrdered.map((col) => col.map((key) => this.BuildUniverseStatus(key, this.savesByUniverse.get(key), tabsMapByUniverse))),
        others: otherGridOrdered.map((col) => col.map((key) => this.BuildUniverseStatus(key, this.savesByUniverse.get(key), tabsMapByUniverse))),
      };
    }
  }

  public async SetUniverseLayoutAsync(layout: UniverseLayoutConfig): Promise<UniverseLayoutConfig> {
    return await this.saveManager.SaveUniverseLayoutConfigAsync(layout);
  }

  private SortKeysByPersistedOrder(keys: string[], persistedOrder: string[]): string[] {
    const keyByNormalized = new Map<string, string>();
    keys.forEach((key) => keyByNormalized.set(key.trim().toLowerCase(), key));

    const ordered: string[] = [];
    const consumed = new Set<string>();

    (persistedOrder || []).forEach((normalized) => {
      const original = keyByNormalized.get(normalized.trim().toLowerCase());
      if (original && !consumed.has(normalized.trim().toLowerCase())) {
        ordered.push(original);
        consumed.add(normalized.trim().toLowerCase());
      }
    });

    const remaining = keys.filter((k) => !consumed.has(k.trim().toLowerCase())).sort((a, b) => a.localeCompare(b));
    return [...ordered, ...remaining];
  }

  private SortGridByPersistedOrder(keys: string[], persistedGrid: string[][]): string[][] {
    const keyByNormalized = new Map<string, string>();
    keys.forEach((key) => keyByNormalized.set(key.trim().toLowerCase(), key));

    const orderedGrid: string[][] = [];
    const consumed = new Set<string>();

    for (const column of persistedGrid || []) {
      const orderedColumn: string[] = [];
      for (const normalized of column || []) {
        const original = keyByNormalized.get(normalized.trim().toLowerCase());
        if (original && !consumed.has(normalized.trim().toLowerCase())) {
          orderedColumn.push(original);
          consumed.add(normalized.trim().toLowerCase());
        }
      }
      if (orderedColumn.length > 0) orderedGrid.push(orderedColumn);
    }

    const remaining = keys.filter((k) => !consumed.has(k.trim().toLowerCase())).sort((a, b) => a.localeCompare(b));
    if (remaining.length > 0) {
      if (orderedGrid.length === 0) orderedGrid.push([]);
      orderedGrid[0].push(...remaining);
    }

    return orderedGrid;
  }

  private BuildUniverseStatus(universeKey: string, universe: ExtensionLocalData | undefined, tabsMapByUniverse: Map<string, number[]>): SidePanelUniverseStatus {
    const tabIds = tabsMapByUniverse.get(universeKey) || [];
    const lastRefreshAtMs = universe?.LastRefreshDate;
    const universeData = this.universeDataByUniverse.get(universeKey);

    return new SidePanelUniverseStatus({
      UniverseKey: universeKey,
      UniverseDisplayName: universe?.UniverseName || UniverseDataNormalizer.ToUniverseDisplayName(universeKey),
      IsOpen: tabIds.length > 0,
      TabIds: tabIds,
      LastRefreshAtIso: typeof lastRefreshAtMs === 'number' ? new Date(lastRefreshAtMs).toISOString() : undefined,
      SidePanelOptions: universe?.SidePanelOptions || new UniverseSidePanelOptions({}),
      SidePanelUniverseCounters: universeData?.universeCounters || new SidePanelUniverseCounters({})
    });
  }

  private async SaveExtensionLocalDataAsync(universeKey: string, localSave: ExtensionLocalData): Promise<void> {
    await this.saveManager.SaveExtensionLocalDataAsync(universeKey, localSave);
  }
}