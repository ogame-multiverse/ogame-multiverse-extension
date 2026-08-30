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

  private sanitizeRow(items: string[] | undefined): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    for (const raw of items || []) {
      if (typeof raw !== 'string') continue;
      const key = this.normalizeKey(raw);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(key);
    }
    return result;
  }

  private sanitizeGrid(grid: string[][] | undefined): string[][] {
    const result: string[][] = [];
    const seen = new Set<string>();
    for (const col of grid || []) {
      if (!Array.isArray(col)) continue;
      const cleanCol: string[] = [];
      for (const raw of col) {
        if (typeof raw !== 'string') continue;
        const key = this.normalizeKey(raw);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        cleanCol.push(key);
      }
      if (cleanCol.length > 0) result.push(cleanCol);
    }
    return result;
  }

  private areEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  /**
   * Réconcilie une section sans détruire le découpage multi-colonnes lors des actions en mode Liste.
   */
  private reconcileSection(
    incomingListRaw: string[] | undefined,
    incomingGridRaw: string[][] | undefined,
    storedListRaw: string[] | undefined,
    storedGridRaw: string[][] | undefined
  ): { list: string[]; grid: string[][] } {
    const inList = this.sanitizeRow(incomingListRaw);
    const inGrid = this.sanitizeGrid(incomingGridRaw);
    const stList = this.sanitizeRow(storedListRaw);
    const stGrid = this.sanitizeGrid(storedGridRaw);

    // Détection d'un appel provenant du mode Liste (grille entrante aplatie à 1 colonne)
    const isIncomingGridFlatList =
      inGrid.length === 0 ||
      (inGrid.length === 1 && this.areEqual(inGrid[0], inList));

    let finalGrid: string[][];
    let finalList: string[];

    if (isIncomingGridFlatList && stGrid.length > 0) {
      // --- ACTION MODE LISTE ---
      // On conserve prioritairement les colonnes existantes en stockage
      finalList = inList;
      const listKeys = new Set(finalList);

      // Conserve les éléments présents dans les colonnes d'origine
      finalGrid = stGrid
        .map((col) => col.filter((id) => listKeys.has(id)))
        .filter((col) => col.length > 0);

      // Si un nouvel univers a été déplacé dans cette section, on l'ajoute dans la dernière colonne
      const currentGridKeys = new Set(finalGrid.flat());
      const missing = finalList.filter((id) => !currentGridKeys.has(id));

      if (missing.length > 0) {
        if (finalGrid.length === 0) {
          finalGrid.push(missing);
        } else {
          finalGrid[finalGrid.length - 1].push(...missing);
        }
      }
    } else if (inGrid.length > 0) {
      // --- ACTION MODE GRILLE ---
      // La disposition multi-colonnes de inGrid fait foi
      finalGrid = inGrid;
      const gridKeys = new Set(finalGrid.flat());

      const baseList = inList.length > 0 ? inList : stList;
      finalList = baseList.filter((id) => gridKeys.has(id));
      finalGrid.flat().forEach((id) => {
        if (!finalList.includes(id)) {
          finalList.push(id);
        }
      });
    } else {
      // --- INITIALISATION OU SECTIONS VIDES ---
      finalList = inList.length > 0 ? inList : stList;
      finalGrid = stGrid.length > 0 ? stGrid : (finalList.length > 0 ? [finalList] : []);
    }

    return { list: finalList, grid: finalGrid };
  }

  public async GetAllExtensionLocalDataAsync(): Promise<Record<string, ExtensionLocalData>> {
    return await this.extensionStorageService.GetAll<ExtensionLocalData>(
      (val): val is ExtensionLocalData => this.isExtensionLocalData(val)
    );
  }

  public async GetUniverseLayoutConfigAsync(): Promise<UniverseLayoutConfig> {
    const rawFavOrder = await this.extensionStorageService.Get<string[]>(UNIVERSE_FAVORITE_ORDER_STORAGE_KEY) || [];
    const rawFavGrid = await this.extensionStorageService.Get<string[][]>(UNIVERSE_FAVORITE_GRID_STORAGE_KEY) || [];
    const rawOrder = await this.extensionStorageService.Get<string[]>(UNIVERSE_ORDER_STORAGE_KEY) || [];
    const rawGrid = await this.extensionStorageService.Get<string[][]>(UNIVERSE_GRID_STORAGE_KEY) || [];

    const fav = this.reconcileSection(rawFavOrder, rawFavGrid, rawFavOrder, rawFavGrid);
    const favKeys = new Set([...fav.list, ...fav.grid.flat()]);

    const otherOrder = rawOrder.filter((id) => !favKeys.has(this.normalizeKey(id)));
    const otherGrid = rawGrid
      .map((col) => col.filter((id) => !favKeys.has(this.normalizeKey(id))))
      .filter((col) => col.length > 0);

    const others = this.reconcileSection(otherOrder, otherGrid, otherOrder, otherGrid);

    return new UniverseLayoutConfig({
      favoriteListOrder: fav.list,
      favoriteGridOrder: fav.grid,
      listOrder: others.list,
      gridOrder: others.grid,
    });
  }

  public async SaveUniverseLayoutConfigAsync(config: UniverseLayoutConfig): Promise<UniverseLayoutConfig> {
    const current = await this.GetUniverseLayoutConfigAsync();

    // 1. Favoris
    const fav = this.reconcileSection(
      config.favoriteListOrder,
      config.favoriteGridOrder,
      current.favoriteListOrder,
      current.favoriteGridOrder
    );
    const favKeys = new Set([...fav.list, ...fav.grid.flat()]);

    // 2. Autres univers (exclusion des favoris)
    const incomingOtherList = (config.listOrder || []).filter((id) => !favKeys.has(this.normalizeKey(id)));
    const incomingOtherGrid = (config.gridOrder || [])
      .map((col) => col.filter((id) => !favKeys.has(this.normalizeKey(id))))
      .filter((col) => col.length > 0);

    const storedOtherList = current.listOrder.filter((id) => !favKeys.has(this.normalizeKey(id)));
    const storedOtherGrid = current.gridOrder
      .map((col) => col.filter((id) => !favKeys.has(this.normalizeKey(id))))
      .filter((col) => col.length > 0);

    const others = this.reconcileSection(
      incomingOtherList,
      incomingOtherGrid,
      storedOtherList,
      storedOtherGrid
    );

    await this.extensionStorageService.Set(UNIVERSE_FAVORITE_ORDER_STORAGE_KEY, fav.list);
    await this.extensionStorageService.Set(UNIVERSE_FAVORITE_GRID_STORAGE_KEY, fav.grid);
    await this.extensionStorageService.Set(UNIVERSE_ORDER_STORAGE_KEY, others.list);
    await this.extensionStorageService.Set(UNIVERSE_GRID_STORAGE_KEY, others.grid);

    return new UniverseLayoutConfig({
      favoriteListOrder: fav.list,
      favoriteGridOrder: fav.grid,
      listOrder: others.list,
      gridOrder: others.grid,
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