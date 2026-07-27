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
import { FlyingFleetEvent } from "../../model/flyingFleetEvent";
import { UniverseFleetEventItem } from "../../messaging/data/universeFleetEventItem";

export class UniverseManager {
    private readonly universeDataByUniverse = new Map<string, { universeCounters: SidePanelUniverseCounters }>();
    private readonly savesByUniverse = new Map<string, ExtensionLocalData>();

    constructor(
        private readonly logger: Logger,
        private readonly saveManager: SaveManager,
        private readonly universeTabsManager: UniverseTabsManager
    ) { }

    private initialization?: Promise<void>;

    public InitializeAsync(): Promise<void> {
        if (!this.initialization) this.initialization = this.LoadSavesAsync();
        return this.initialization;
    }

    private async LoadSavesAsync(): Promise<void> {
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

    public UpdateUniverseSave(universeKey: string, data: ExtensionLocalData) {
        if (data.UniverseKey) this.savesByUniverse.set(universeKey, data);
    }

    public async ApplyQueryResultAsync(universeKey: string, data: ExtensionLocalData): Promise<void> {
        await this.InitializeAsync();

        const current = this.savesByUniverse.get(universeKey);
        if (current?.SidePanelOptions) data.SidePanelOptions = current.SidePanelOptions;
        if (current?.FlyingFleetEvents) data.FlyingFleetEvents = current.FlyingFleetEvents;

        this.UpdateUniverseSave(universeKey, data);

        const options = data.SidePanelOptions;
        const events = data.FlyingFleetEvents;
        await this.saveManager.UpdateExtensionLocalDataAsync(universeKey, (d) => {
            if (options) d.SidePanelOptions = options;
            if (events) d.FlyingFleetEvents = events;
        });
    }

    public async RegisterUniverseAsync(universeKey: string, universeName: string, universeDomain: string, lastRefreshDate: number): Promise<void> {
        await this.InitializeAsync();
        const localSave = await this.saveManager.RegisterUniverseAsync(universeKey, universeName, universeDomain, lastRefreshDate);
        this.UpdateUniverseSave(universeKey, localSave);
        await this.saveManager.AppendToUniverseOrderAndGridAsync(universeKey);
    }

    public async RemoveUniverseAsync(universeKey: string): Promise<void> {
        await this.InitializeAsync();
        await this.saveManager.RemoveUniverseAsync(universeKey);
        this.savesByUniverse.delete(universeKey);
        this.universeDataByUniverse.delete(universeKey);
        await this.saveManager.RemoveFromUniverseOrderAndGridAsync(universeKey);
    }

    public async UpdateUniverseStatusAsync(universeKey: string, universeCounters: SidePanelUniverseCounters, flyingFleetEvents: FlyingFleetEvent[]): Promise<void> {
        await this.InitializeAsync();
        const localSave = await this.saveManager.UpdateExtensionLocalDataAsync(universeKey, (d) => {
            d.FlyingFleetEvents = flyingFleetEvents;
            return d;
        });

        universeCounters.MaximumExpeditionSlots = localSave?.Account?.CalculatedData?.MaximumExpeditionSlots ?? 0;
        this.universeDataByUniverse.set(universeKey, { universeCounters });
        this.UpdateUniverseSave(universeKey, localSave);
    }

    public async ListUniverseStatusesAsync(mode: 'list' | 'grid'): Promise<SidePanelUniversesSections> {
        await this.InitializeAsync();
        const allUniverseKeys = Array.from(this.savesByUniverse.keys());
        await this.universeTabsManager.WhenReadyAsync();

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

    public async GetUniverseSidePanelOptionsAsync(universeKey: string): Promise<UniverseSidePanelOptions> {
        await this.InitializeAsync();
        const localSave = this.savesByUniverse.get(universeKey);
        if (localSave?.SidePanelOptions) {
            return localSave.SidePanelOptions;
        }
        return await this.saveManager.GetUniverseSidePanelOptionsAsync(universeKey);
    }

    public async SaveUniverseSidePanelOptionsAsync(universeKey: string, options: UniverseSidePanelOptions): Promise<void> {
        await this.InitializeAsync();
        const localSave = this.savesByUniverse.get(universeKey);
        if (localSave) {
            localSave.SidePanelOptions = options;
            await this.saveManager.UpdateExtensionLocalDataAsync(universeKey, (d) => {
                d.SidePanelOptions = options;
                return d;
            });
        } else {
            await this.saveManager.SaveUniverseSidePanelOptionsAsync(universeKey, options);
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
            SidePanelUniverseCounters: universeData?.universeCounters || new SidePanelUniverseCounters({}),
        });
    }

    public async GetAllFlyingFleetEventsAsync(universeKey?: string): Promise<UniverseFleetEventItem[]> {
        await this.InitializeAsync();
        const result: UniverseFleetEventItem[] = [];

        for (const [key, data] of this.savesByUniverse.entries()) {
            if (universeKey && key !== universeKey) continue;

            const universeSave = this.savesByUniverse.get(key);
            const displayName = universeSave?.UniverseName || UniverseDataNormalizer.ToUniverseDisplayName(key);

            if (data.FlyingFleetEvents && data.FlyingFleetEvents.length > 0) {
                for (const event of data.FlyingFleetEvents) {
                    result.push({
                        universeKey: key,
                        universeDisplayName: displayName,
                        event
                    });
                }
            }
        }

        // Chronologically sort the events by ArrivalTime
        return result.sort((a, b) => (a.event.ArrivalTime ?? 0) - (b.event.ArrivalTime ?? 0));
    }
}