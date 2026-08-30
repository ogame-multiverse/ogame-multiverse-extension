import { ExtensionLocalData } from '../../model/save/extensionLocalData';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { ExtensionStorageService } from './extensionStorageService';

// Reserved storage keys holding the user-defined universe display order and grid layout.
export const UNIVERSE_ORDER_STORAGE_KEY = '__ogm_universe_order';
export const UNIVERSE_GRID_STORAGE_KEY = '__ogm_universe_grid';

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

  public async GetAllExtensionLocalDataAsync(): Promise<Record<string, ExtensionLocalData>> {
    return await this.extensionStorageService.GetAll<ExtensionLocalData>(
      (val): val is ExtensionLocalData => this.isExtensionLocalData(val)
    );
  }

  public async GetUniverseOrderAsync(): Promise<string[]> {
    try {
      const result = await this.extensionStorageService.Get<string[]>(UNIVERSE_ORDER_STORAGE_KEY);
      if (!Array.isArray(result)) return [];
      return this.sanitizeRow(result);
    } catch {
      return [];
    }
  }

  public async SaveUniverseOrderAsync(order: string[]): Promise<string[]> {
    const normalized = this.sanitizeRow(order);
    await this.extensionStorageService.Set(UNIVERSE_ORDER_STORAGE_KEY, normalized);
    return normalized;
  }

  public async GetUniverseGridAsync(): Promise<string[][]> {
    try {
      const raw = await this.extensionStorageService.Get<string[][]>(UNIVERSE_GRID_STORAGE_KEY);
      if (!Array.isArray(raw)) return [];

      const seen = new Set<string>();
      return raw
        .filter((row): row is string[] => Array.isArray(row))
        .map((row) => this.sanitizeRow(row, seen))
        .filter((row) => row.length > 0);
    } catch {
      return [];
    }
  }

  public async SaveUniverseGridAsync(grid: string[][]): Promise<string[][]> {
    const seen = new Set<string>();
    const normalized = (grid || [])
      .filter((column) => Array.isArray(column))
      .map((column) => this.sanitizeRow(column, seen))
      .filter((column) => column.length > 0);

    await this.extensionStorageService.Set(UNIVERSE_GRID_STORAGE_KEY, normalized);
    return normalized;
  }


  public async AppendToUniverseOrderAndGridAsync(universeKey: string): Promise<void> {
    const key = this.normalizeKey(universeKey);
    if (!key) return;

    const order = await this.GetUniverseOrderAsync();
    if (!order.includes(key)) {
      order.push(key);
      await this.SaveUniverseOrderAsync(order);
    }

    const grid = await this.GetUniverseGridAsync();
    const existsInGrid = grid.some((column) => column.includes(key));

    if (!existsInGrid) {
      if (grid.length === 0) {
        grid.push([key]);
      } else {
        grid[grid.length - 1].push(key);
      }
      await this.SaveUniverseGridAsync(grid);
    }
  }

  public async RemoveFromUniverseOrderAndGridAsync(universeKey: string): Promise<void> {
    const key = this.normalizeKey(universeKey);
    if (!key) return;

    // Remove from order (1D)
    const order = await this.GetUniverseOrderAsync();
    const nextOrder = order.filter((k) => k !== key);
    if (nextOrder.length !== order.length) {
      await this.SaveUniverseOrderAsync(nextOrder);
    }

    // Remove from grid (2D)
    const grid = await this.GetUniverseGridAsync();
    const nextGrid = grid.map((column) => column.filter((k) => k !== key));
    await this.SaveUniverseGridAsync(nextGrid);
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

  public async RemoveExtensionLocalDataAsync(universeKey: string): Promise<void> {
    await this.extensionStorageService.Remove(universeKey);
  }
}