import { LocalizationStrings } from '../../../types/LocalizationStrings';
import { DataMutator, DataChanges } from '../../dataMutator';
import { FlyingFleetEvent } from '../../model/flyingFleetEvent';
import { ExtensionLocalData } from '../../model/save/extensionLocalData';
import { ExtensionSessionData } from '../../model/save/extensionSessionData';
import { LocalizationData } from '../../model/save/localizationData';
import { SidePanelGlobalOptions } from '../../model/sidePanel/sidePanelGlobalOptions';
import { UniverseLayoutConfig } from '../../model/sidePanel/universeLayoutConfig';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { ExtensionStorageService, StorageArea } from './extensionStorageService';

export const UNIVERSE_LAYOUT_CONFIG_STORAGE_KEY = '__ogm_universe_layout_config';
export const SIDE_PANEL_GLOBAL_OPTIONS_STORAGE_KEY = '__ogm_side_panel_global_options';


export class SaveManager {
    private readonly localDataQueues = new Map<string, Promise<unknown>>();
    private readonly sessionDataQueues = new Map<string, Promise<unknown>>();
    private readonly layoutQueues = new Map<string, Promise<unknown>>();
    private readonly localDataSavedListeners = new Set<(universeKey: string, data: ExtensionLocalData) => void>();

    constructor(private readonly extensionStorageService: ExtensionStorageService) { }



    public OnLocalDataSaved(listener: (universeKey: string, data: ExtensionLocalData) => void): void {
        this.localDataSavedListeners.add(listener);
    }

    private EnqueueAsync<T>(queues: Map<string, Promise<unknown>>, queueKey: string, task: () => Promise<T>): Promise<T> {
        const previous = queues.get(queueKey) ?? Promise.resolve();
        const run = previous.catch(() => undefined).then(task);
        const tail = run.catch(() => undefined);
        queues.set(queueKey, tail);
        void tail.then(() => {
            if (queues.get(queueKey) === tail) queues.delete(queueKey);
        });
        return run;
    }

    public UpdateExtensionSessionDataAsync(universeKey: string, mutator: DataMutator<ExtensionSessionData>): Promise<ExtensionSessionData> {
        return this.UpdateDataAsync(
            this.sessionDataQueues,
            StorageArea.Session,
            universeKey,
            (key) => this.GetExtensionSessionDataAsync(key),
            mutator
        );
    }

    public UpdateExtensionLocalDataAsync(universeKey: string, mutator: DataMutator<ExtensionLocalData>): Promise<ExtensionLocalData> {
        return this.UpdateDataAsync(
            this.localDataQueues,
            StorageArea.Local,
            universeKey,
            (key) => this.GetExtensionLocalDataAsync(key),
            mutator
        );
    }

    private UpdateDataAsync<T>(
        queues: Map<string, Promise<unknown>>,
        area: StorageArea,
        universeKey: string,
        read: (universeKey: string) => Promise<T>,
        mutator: DataMutator<T>
    ): Promise<T> {
        return this.EnqueueAsync(queues, universeKey, async () => {
            const currentData = await read(universeKey);
            const updatedData = await mutator(currentData);
            if (updatedData === DataChanges.None) return currentData;
            await this.extensionStorageService.Set(area, universeKey, updatedData);
            if (area === StorageArea.Local) this.NotifyLocalDataSaved(universeKey, updatedData as unknown as ExtensionLocalData);
            return updatedData;
        });
    }

    private NotifyLocalDataSaved(universeKey: string, data: ExtensionLocalData): void {
        this.localDataSavedListeners.forEach((listener) => listener(universeKey, data));
    }

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
     * Reconciles a section without destroying the multi-column layout during List mode actions.
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

        // Detection of a call coming from List mode (incoming grid flattened to 1 column)
        const isIncomingGridFlatList =
            inGrid.length === 0 ||
            (inGrid.length === 1 && this.areEqual(inGrid[0], inList));

        let finalGrid: string[][];
        let finalList: string[];

        if (isIncomingGridFlatList && stGrid.length > 0) {
            // --- LIST MODE ACTION ---
            finalList = inList;
            const listKeys = new Set(finalList);

            finalGrid = stGrid
                .map((col) => col.filter((id) => listKeys.has(id)))
                .filter((col) => col.length > 0);

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
            // --- GRID MODE ACTION ---
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
            // --- INITIALIZATION OR EMPTY SECTIONS ---
            finalList = inList.length > 0 ? inList : stList;
            finalGrid = stGrid.length > 0 ? stGrid : (finalList.length > 0 ? [finalList] : []);
        }

        return { list: finalList, grid: finalGrid };
    }

    public async GetAllExtensionLocalDataAsync(): Promise<Record<string, ExtensionLocalData>> {
        return await this.extensionStorageService.GetAll<ExtensionLocalData>(StorageArea.Local,
            (val): val is ExtensionLocalData => this.isExtensionLocalData(val)
        );
    }

    public async GetUniverseLayoutConfigAsync(): Promise<UniverseLayoutConfig> {
        const raw = await this.extensionStorageService.Get<Partial<UniverseLayoutConfig>>(StorageArea.Local, UNIVERSE_LAYOUT_CONFIG_STORAGE_KEY);

        // Pure read: no write here. The layout gets persisted on the first
        // SaveUniverseLayoutConfigAsync call (universe added/removed, drag & drop...).
        if (!raw) {
            return new UniverseLayoutConfig({
                favoriteListOrder: [],
                favoriteGridOrder: [],
                listOrder: [],
                gridOrder: [],
            });
        }

        const fav = this.reconcileSection(raw.favoriteListOrder, raw.favoriteGridOrder, raw.favoriteListOrder, raw.favoriteGridOrder);
        const favKeys = new Set([...fav.list, ...fav.grid.flat()]);

        const otherOrder = (raw.listOrder || []).filter((id) => !favKeys.has(this.normalizeKey(id)));
        const otherGrid = (raw.gridOrder || [])
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

    public SaveUniverseLayoutConfigAsync(config: UniverseLayoutConfig): Promise<UniverseLayoutConfig> {
        return this.EnqueueAsync(this.layoutQueues, 'layout', () => this.SaveUniverseLayoutConfigCoreAsync(config));
    }

    private async SaveUniverseLayoutConfigCoreAsync(config: UniverseLayoutConfig): Promise<UniverseLayoutConfig> {
        const current = await this.GetUniverseLayoutConfigAsync();

        // Favorites
        const fav = this.reconcileSection(
            config.favoriteListOrder,
            config.favoriteGridOrder,
            current.favoriteListOrder,
            current.favoriteGridOrder
        );
        const favKeys = new Set([...fav.list, ...fav.grid.flat()]);

        // Other universes (excluding favorites)
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

        const updatedConfig = new UniverseLayoutConfig({
            favoriteListOrder: fav.list,
            favoriteGridOrder: fav.grid,
            listOrder: others.list,
            gridOrder: others.grid,
        });

        await this.extensionStorageService.Set(StorageArea.Local, UNIVERSE_LAYOUT_CONFIG_STORAGE_KEY, updatedConfig);
        return updatedConfig;
    }

    public AppendToUniverseOrderAndGridAsync(universeKey: string): Promise<void> {
        return this.EnqueueAsync(this.layoutQueues, 'layout', () => this.AppendToUniverseOrderAndGridCoreAsync(universeKey));
    }

    private async AppendToUniverseOrderAndGridCoreAsync(universeKey: string): Promise<void> {
        const key = this.normalizeKey(universeKey);
        if (!key) return;

        const layout = await this.GetUniverseLayoutConfigAsync();

        let hasChanged = false;

        const inFavList = layout.favoriteListOrder.includes(key);
        const inOtherList = layout.listOrder.includes(key);
        if (!inFavList && !inOtherList) {
            layout.listOrder.push(key);
            hasChanged = true;
        }

        const inFavGrid = layout.favoriteGridOrder.some((col) => col.includes(key));
        const inOtherGrid = layout.gridOrder.some((col) => col.includes(key));
        if (!inFavGrid && !inOtherGrid) {
            if (layout.gridOrder.length === 0) {
                layout.gridOrder.push([key]);
            } else {
                layout.gridOrder[layout.gridOrder.length - 1].push(key);
            }
            hasChanged = true;
        }

        if (!hasChanged) return;
        await this.SaveUniverseLayoutConfigCoreAsync(layout);
    }

    public RemoveFromUniverseOrderAndGridAsync(universeKey: string): Promise<void> {
        return this.EnqueueAsync(this.layoutQueues, 'layout', () => this.RemoveFromUniverseOrderAndGridCoreAsync(universeKey));
    }

    private async RemoveFromUniverseOrderAndGridCoreAsync(universeKey: string): Promise<void> {
        const key = this.normalizeKey(universeKey);
        if (!key) return;

        const layout = await this.GetUniverseLayoutConfigAsync();
        layout.favoriteListOrder = layout.favoriteListOrder.filter((k) => k !== key);
        layout.listOrder = layout.listOrder.filter((k) => k !== key);
        layout.favoriteGridOrder = layout.favoriteGridOrder.map((col) => col.filter((k) => k !== key)).filter((col) => col.length > 0);
        layout.gridOrder = layout.gridOrder.map((col) => col.filter((k) => k !== key)).filter((col) => col.length > 0);

        await this.SaveUniverseLayoutConfigCoreAsync(layout);
    }
    public async GetExtensionDataAsync(universeKey: string): Promise<{ sessionData: ExtensionSessionData, localizationData: LocalizationData }> {
        const extensionSessionData = await this.GetExtensionSessionDataAsync(universeKey);
        const extensionLocalData = await this.GetExtensionLocalDataAsync(universeKey);
        return {
            sessionData: extensionSessionData, localizationData: extensionLocalData?.LocalizationData ?? new LocalizationData({})
        };
    }

    /* LOCALIZATION */
    public async SaveLocalizationStringsAsync(universeKey: string, language: string, localizationStrings: LocalizationStrings): Promise<void> {
        await this.UpdateExtensionLocalDataAsync(universeKey, (extensionLocalData) => {
            extensionLocalData.LocalizationData.Language = language;
            extensionLocalData.LocalizationData.LocalizationStrings = localizationStrings;
            return extensionLocalData;
        });
    }

    public async GetLocalizationDataAsync(universeKey: string): Promise<LocalizationData> {
        const localSave = await this.GetExtensionLocalDataAsync(universeKey);
        return localSave.LocalizationData;
    }

    public async SaveFlyingFleetEventsAsync(universeKey: string, flyingFleetEvents: FlyingFleetEvent[]): Promise<void> {
        await this.UpdateExtensionLocalDataAsync(universeKey, (extensionLocalData) => {
            extensionLocalData.FlyingFleetEvents = flyingFleetEvents;
            return extensionLocalData;
        });
    }

    public async GetExtensionLocalDataAsync(universeKey: string): Promise<ExtensionLocalData> {
        const raw = await this.extensionStorageService.Get<Partial<ExtensionLocalData>>(StorageArea.Local, universeKey);
        return new ExtensionLocalData(raw ?? { UniverseKey: universeKey });
    }
    public async GetExtensionSessionDataAsync(universeKey: string): Promise<ExtensionSessionData> {
        const raw = await this.extensionStorageService.Get<Partial<ExtensionSessionData>>(StorageArea.Session, universeKey);
        return new ExtensionSessionData(raw ?? { UniverseKey: universeKey });
    }


    public async GetUniverseSidePanelOptionsAsync(universeKey: string): Promise<UniverseSidePanelOptions> {
        const localSave = await this.GetExtensionLocalDataAsync(universeKey);
        return localSave.SidePanelOptions;
    }

    public async SaveUniverseSidePanelOptionsAsync(universeKey: string, options: UniverseSidePanelOptions): Promise<void> {
        await this.UpdateExtensionLocalDataAsync(universeKey, (extensionLocalData) => {
            extensionLocalData.SidePanelOptions = options;
            return extensionLocalData;
        });
    }



    public async RemoveUniverseAsync(universeKey: string): Promise<void> {
        await this.EnqueueAsync(this.localDataQueues, universeKey, () => this.extensionStorageService.Remove(StorageArea.Local, universeKey));
        await this.EnqueueAsync(this.sessionDataQueues, universeKey, () => this.extensionStorageService.Remove(StorageArea.Session, universeKey));
    }

    public async RegisterUniverseAsync(universeKey: string, universeName: string, universeDomain: string, lastRefreshDate: number): Promise<ExtensionLocalData> {
        return await this.UpdateExtensionLocalDataAsync(universeKey, (d) => {
            d.UniverseKey = universeKey;
            d.UniverseName = universeName;
            if (!d.UniverseDomain) d.UniverseDomain = universeDomain;
            d.LastRefreshDate = lastRefreshDate;
            return d;
        });
    }

    /**
     * Global side panel options (not tied to a particular universe), e.g. visibility
     * of the Events panel's timeline.
     */
    public async GetSidePanelGlobalOptionsAsync(): Promise<SidePanelGlobalOptions> {
        const raw = await this.extensionStorageService.Get<Partial<SidePanelGlobalOptions>>(StorageArea.Local, SIDE_PANEL_GLOBAL_OPTIONS_STORAGE_KEY);
        return new SidePanelGlobalOptions(raw ?? undefined);
    }

    public async SaveSidePanelGlobalOptionsAsync(options: SidePanelGlobalOptions): Promise<void> {
        await this.extensionStorageService.Set(StorageArea.Local, SIDE_PANEL_GLOBAL_OPTIONS_STORAGE_KEY, options);
    }
}