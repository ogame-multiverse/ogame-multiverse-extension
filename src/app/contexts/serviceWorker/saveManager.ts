import { ExtensionLocalData } from '../../model/save/extensionLocalData';
import { UniverseLayoutConfig } from '../../model/sidePanel/universeLayoutConfig';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { ExtensionStorageService } from './extensionStorageService';

export const UNIVERSE_ORDER_STORAGE_KEY = '__ogm_universe_order';
export const UNIVERSE_GRID_STORAGE_KEY = '__ogm_universe_grid';
export const UNIVERSE_FAVORITE_ORDER_STORAGE_KEY = '__ogm_universe_favorite_order';
export const UNIVERSE_FAVORITE_GRID_STORAGE_KEY = '__ogm_universe_favorite_grid';

export class SaveManager {
  constructor(private readonly extensionStorageService: ExtensionStorageService) { }

  private isExtensionLocalData(val: unknown): val is ExtensionLocalData {
    return (
      typeof val === 'object' &&
      val !== null &&
      !Array.isArray(val) &&
      ('UniverseKey' in val || 'LastRefreshDate' in val)
    );
  }

  private normalizeKey(key: string): string {
    return (key || '').trim().toLowerCase();
  }

  private sanitizeRow(items: string[], seen: Set<string> = new Set()): string[] {
    const result: string[] = [];
    for (const raw of items || []) {
      if (typeof raw !== 'string') continue;
      const key = this.normalizeKey(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(key);
    }
    return result;
  }

  private sanitizeGrid(grid: string[][], seen: Set<string> = new Set()): string[][] {
    return (grid || [])
      .filter((column) => Array.isArray(column))
      .map((column) => this.sanitizeRow(column, seen))
      .filter((column) => column.length > 0);
  }

  public async GetAllExtensionLocalDataAsync(): Promise<Record<string, ExtensionLocalData>> {
    return await this.extensionStorageService.GetAll<ExtensionLocalData>(
      (val): val is ExtensionLocalData => this.isExtensionLocalData(val)
    );
  }

  public async GetUniverseLayoutConfigAsync(): Promise<UniverseLayoutConfig> {
    const seen = new Set<string>();

    const rawFavOrder = await this.extensionStorageService.Get<string[]>(UNIVERSE_FAVORITE_ORDER_STORAGE_KEY) || [];
    const rawFavGrid = await this.extensionStorageService.Get<string[][]>(UNIVERSE_FAVORITE_GRID_STORAGE_KEY) || [];
    const rawOrder = await this.extensionStorageService.Get<string[]>(UNIVERSE_ORDER_STORAGE_KEY) || [];
    const rawGrid = await this.extensionStorageService.Get<string[][]>(UNIVERSE_GRID_STORAGE_KEY) || [];

    const favoriteListOrder = this.sanitizeRow(rawFavOrder, seen);

    const favGridSeen = new Set<string>();
    const favoriteGridOrder = this.sanitizeGrid(rawFavGrid, favGridSeen);

    const otherSeen = new Set<string>(seen);
    const listOrder = this.sanitizeRow(rawOrder, otherSeen);

    const otherGridSeen = new Set<string>(favGridSeen);
    const gridOrder = this.sanitizeGrid(rawGrid, otherGridSeen);

    return new UniverseLayoutConfig({
      favoriteListOrder,
      favoriteGridOrder,
      listOrder,
      gridOrder,
    });
  }

  public async SaveUniverseLayoutConfigAsync(config: UniverseLayoutConfig): Promise<UniverseLayoutConfig> {
    const seenList = new Set<string>();
    const favList = this.sanitizeRow(config.favoriteListOrder || [], seenList);
    const otherList = this.sanitizeRow(config.listOrder || [], seenList);

    const seenGrid = new Set<string>();
    const favGrid = this.sanitizeGrid(config.favoriteGridOrder || [], seenGrid);
    const otherGrid = this.sanitizeGrid(config.gridOrder || [], seenGrid);

    await this.extensionStorageService.Set(UNIVERSE_FAVORITE_ORDER_STORAGE_KEY, favList);
    await this.extensionStorageService.Set(UNIVERSE_FAVORITE_GRID_STORAGE_KEY, favGrid);
    await this.extensionStorageService.Set(UNIVERSE_ORDER_STORAGE_KEY, otherList);
    await this.extensionStorageService.Set(UNIVERSE_GRID_STORAGE_KEY, otherGrid);

    return new UniverseLayoutConfig({
      favoriteListOrder: favList,
      favoriteGridOrder: favGrid,
      listOrder: otherList,
      gridOrder: otherGrid,
    });
  }

  public async AppendToUniverseOrderAndGridAsync(universeKey: string): Promise<void> {
    const key = this.normalizeKey(universeKey);
    if (!key) return;

    const layout = await this.GetUniverseLayoutConfigAsync();

    const inFavList = layout.favoriteListOrder.includes(key);
    const inOtherList = layout.listOrder.includes(key);
    if (!inFavList && !inOtherList) {
      layout.listOrder.push(key);
    }

    const inFavGrid = layout.favoriteGridOrder.some((col) => col.includes(key));
    const inOtherGrid = layout.gridOrder.some((col) => col.includes(key));
    if (!inFavGrid && !inOtherGrid) {
      if (layout.gridOrder.length === 0) {
        layout.gridOrder.push([key]);
      } else {
        layout.gridOrder[layout.gridOrder.length - 1].push(key);
      }
    }

    await this.SaveUniverseLayoutConfigAsync(layout);
  }

  public async RemoveFromUniverseOrderAndGridAsync(universeKey: string): Promise<void> {
    const key = this.normalizeKey(universeKey);
    if (!key) return;

    const layout = await this.GetUniverseLayoutConfigAsync();
    layout.favoriteListOrder = layout.favoriteListOrder.filter((k) => k !== key);
    layout.listOrder = layout.listOrder.filter((k) => k !== key);
    layout.favoriteGridOrder = layout.favoriteGridOrder.map((col) => col.filter((k) => k !== key)).filter((col) => col.length > 0);
    layout.gridOrder = layout.gridOrder.map((col) => col.filter((k) => k !== key)).filter((col) => col.length > 0);

    await this.SaveUniverseLayoutConfigAsync(layout);
  }

  public async GetExtensionLocalDataAsync(universeKey: string): Promise<ExtensionLocalData> {
    const raw = await this.extensionStorageService.Get<Partial<ExtensionLocalData>>(universeKey);
    if (!raw) {
      const localSave = new ExtensionLocalData({});
      await this.SaveExtensionLocalDataAsync(universeKey, localSave);
      return localSave;
    }
    return new ExtensionLocalData(raw);
  }

  public async GetUniverseSidePanelOptionsAsync(universeKey: string): Promise<UniverseSidePanelOptions> {
    const localSave = await this.GetExtensionLocalDataAsync(universeKey);
    return localSave.SidePanelOptions;
  }

  public async SaveUniverseSidePanelOptionsAsync(universeKey: string, options: UniverseSidePanelOptions): Promise<void> {
    const localSave = await this.GetExtensionLocalDataAsync(universeKey);
    localSave.SidePanelOptions = options;
    await this.SaveExtensionLocalDataAsync(universeKey, localSave);
  }

  public async SaveExtensionLocalDataAsync(universeKey: string, localSave: ExtensionLocalData): Promise<void> {
    await this.extensionStorageService.Set(universeKey, localSave);
  }

  public async RemoveUniverseAsync(universeKey: string): Promise<void> {
    await this.extensionStorageService.Remove(universeKey);
  }

  public async RegisterUniverseAsync(
    universeKey: string,
    universeDomain: string,
    lastRefreshDate: number
  ): Promise<ExtensionLocalData> {
    const raw = await this.extensionStorageService.Get<Partial<ExtensionLocalData>>(universeKey);
    const localSave = raw
      ? new ExtensionLocalData(raw)
      : new ExtensionLocalData({
        UniverseKey: universeKey,
        UniverseDomain: universeDomain,
      });
    localSave.LastRefreshDate = lastRefreshDate;
    await this.SaveExtensionLocalDataAsync(universeKey, localSave);
    return localSave;
  }
}