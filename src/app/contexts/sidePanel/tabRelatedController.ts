import { Logger } from '../../logging/logger';
import { SidePanelUniverseStatus } from '../../model/sidePanel/sidePanelUniverseStatus';
import { SidePanelUniversesSections } from '../../model/sidePanel/sidePanelUniversesSections';
import { LocalWindowTabsTracker } from './localWindowTabsTracker';
import { serviceWorkerProtocolClient } from '../../messaging/serviceWorkerProtocol';

export const DEFAULT_WARNING_THRESHOLD_MINUTES = 15;

/**
 * Debounce delay (ms) applied by each controller before refreshing universe
 * statuses following a local tab change. Shared so both controllers react
 * at the same pace.
 */
export const TAB_CHANGE_REFRESH_DEBOUNCE_MS = 250;

export interface UniverseTabPresence {
    hasLocalTabs: boolean;
    hasRemoteTabs: boolean;
    isActiveInCurrentWindow: boolean;
}


export abstract class TabRelatedController {
    // Shared across ALL instances (Events + Universe): a single server fetch
    // per tab-change cycle, even though both controllers react independently
    // to the same event.
    private static cachedStatusesPromise: Promise<Map<string, SidePanelUniverseStatus>> | null = null;

    private static readonly trackersWithCacheInvalidation = new WeakSet<LocalWindowTabsTracker>();

    /**
     * Shared cache of the raw SidePanelUniversesSections payload, keyed by mode ('list' | 'grid').
     * Avoids duplicate GetUniversesStatusesAsync network calls when several call sites (UniversePanelController.Refresh,
     * RefreshGlobalWarningAsync, FetchUniverseStatusesMapAsync) ask for the same data around the same time (e.g. on startup).
     */
    private static cachedSectionsPromises = new Map<string, Promise<SidePanelUniversesSections>>();

    /**
     * Aggregated "does at least one universe need a refresh" state, shared across ALL instances
     * (Events + Universe) so a single warning icon can be shown on the tab strip regardless of
     * which panel is currently active. Computed from data only (RefreshGlobalWarningAsync),
     * never from DOM presence.
     */
    private static hasGlobalRefreshWarning = false;
    private static lastKnownStatuses: SidePanelUniverseStatus[] = [];
    private static isFetchingGlobalWarning = false;
    private static isGlobalWarningRefreshQueued = false;
    private static readonly globalRefreshWarningListeners = new Set<(hasWarning: boolean) => void>();

    /**
     * Aggregated "at least one universe has fleet tracking enabled" state, shared across ALL instances and
     * computed from data (RefreshGlobalWarningAsync). undefined until the first computation.
     * Used by the side panel bootstrap to show/hide the Events tab.
     */
    private static hasAnyFleetTrackingEnabled: boolean | undefined;
    private static readonly fleetTrackingAvailabilityListeners = new Set<(hasTracking: boolean) => void>();

    private loopIntervalId?: number;

    constructor(protected readonly logger: Logger, protected readonly localWindowTabsTracker: LocalWindowTabsTracker) {
        if (!TabRelatedController.trackersWithCacheInvalidation.has(localWindowTabsTracker)) {
            TabRelatedController.trackersWithCacheInvalidation.add(localWindowTabsTracker);
            localWindowTabsTracker.onLocalTabChanged.addListener(() => TabRelatedController.InvalidateSharedCaches());
        }
        localWindowTabsTracker.onLocalTabChanged.addListener(() => {
            this.TabsChangedAsync().catch((error) => this.logger.error('TabsChangedAsync failed', error));
        });
    }

    protected abstract TabsChangedAsync(): Promise<void>;

    /**
     * Hook called on every frame while the loop is running (via StartAnimationLoop).
     * Default implementation is empty: subclasses that need per-frame work
     * (countdowns, display ticks, ...) override it.
     */
    protected OnAnimationFrame(): void {
        // no-op by default
    }

    protected StartAnimationLoop(): void {
        if (this.loopIntervalId !== undefined) return;

        this.OnAnimationFrame();
        this.loopIntervalId = window.setInterval(() => this.OnAnimationFrame(), 1000);
    }

    /**
     * Fetches the SidePanelUniverseStatus of all universes, indexed by raw
     * (non-normalized) UniverseKey. The network fetch is shared and cached until
     * the next local tab change, but each caller receives its OWN shallow copy
     * of each status: mutating a top-level field (IsOpen, SidePanelOptions, ...)
     * on one controller's copy can never affect the other controller's copy
     * nor the shared cache itself.
     */
    protected async GetFreshUniverseStatusesAsync(): Promise<Map<string, SidePanelUniverseStatus>> {
        if (!TabRelatedController.cachedStatusesPromise) {
            const statusesPromise = this.FetchUniverseStatusesMapAsync();
            TabRelatedController.cachedStatusesPromise = statusesPromise;
            statusesPromise.catch(() => {
                if (TabRelatedController.cachedStatusesPromise === statusesPromise) {
                    TabRelatedController.cachedStatusesPromise = null;
                }
            });
        }

        const sharedStatuses = await TabRelatedController.cachedStatusesPromise;

        const ownCopy = new Map<string, SidePanelUniverseStatus>();
        sharedStatuses.forEach((status, key) => ownCopy.set(key, { ...status }));
        return ownCopy;
    }

    private async FetchUniverseStatusesMapAsync(): Promise<Map<string, SidePanelUniverseStatus>> {
        const rawData = await this.GetUniversesSectionsAsync('list');
        const allStatuses: SidePanelUniverseStatus[] = [
            ...(rawData?.favorites || []).flat(),
            ...(rawData?.others || []).flat(),
        ];
        return new Map(allStatuses.map((status) => [status.UniverseKey, status]));
    }

    /**
     * Fetches the raw SidePanelUniversesSections for a given mode, sharing the in-flight/last request
     * with any other caller asking for the same mode until the cache is invalidated (local tab change).
     * Pass forceRefresh when the caller just performed a mutation (drag & drop reorder, option change,
     * remove...) and needs the response to reflect it rather than a possibly-stale cached one.
     */
    protected async GetUniversesSectionsAsync(mode: 'list' | 'grid', forceRefresh = false): Promise<SidePanelUniversesSections> {
        if (forceRefresh) {
            TabRelatedController.cachedSectionsPromises.delete(mode);
        }

        return TabRelatedController.GetSharedSectionsPromise(this.logger, mode);
    }

    private static GetSharedSectionsPromise(logger: Logger, mode: 'list' | 'grid'): Promise<SidePanelUniversesSections> {
        let promise = TabRelatedController.cachedSectionsPromises.get(mode);
        if (!promise) {
            const sectionsPromise = serviceWorkerProtocolClient.GetUniversesStatusesAsync(logger, mode);
            promise = sectionsPromise;
            TabRelatedController.cachedSectionsPromises.set(mode, sectionsPromise);
            sectionsPromise.catch(() => {
                if (TabRelatedController.cachedSectionsPromises.get(mode) === sectionsPromise) {
                    TabRelatedController.cachedSectionsPromises.delete(mode);
                }
            });
        }
        return promise;
    }

    public static InvalidateSharedCaches(): void {
        TabRelatedController.cachedStatusesPromise = null;
        TabRelatedController.cachedSectionsPromises.clear();
    }

    protected InvalidateStatusesCache(): void {
        TabRelatedController.InvalidateSharedCaches();
    }


    /**
     * Registers a listener for the aggregated refresh-warning state and immediately invokes it
     * with the current value. Intended for app.ts to toggle the tab-universe warning icon.
     */
    public static OnGlobalRefreshWarningChanged(callback: (hasWarning: boolean) => void): void {
        TabRelatedController.globalRefreshWarningListeners.add(callback);
        callback(TabRelatedController.hasGlobalRefreshWarning);
    }

    /**
     * Registers a listener for the aggregated fleet tracking availability. Invoked immediately only if the
     * state is already known, then on the first computation and on every change.
     */
    public static OnFleetTrackingAvailabilityChanged(callback: (hasTracking: boolean) => void): void {
        TabRelatedController.fleetTrackingAvailabilityListeners.add(callback);
        if (TabRelatedController.hasAnyFleetTrackingEnabled !== undefined) callback(TabRelatedController.hasAnyFleetTrackingEnabled);
    }

    protected static NotifyFleetTrackingAvailability(hasTracking: boolean): void {
        if (hasTracking === TabRelatedController.hasAnyFleetTrackingEnabled) return;
        TabRelatedController.hasAnyFleetTrackingEnabled = hasTracking;
        TabRelatedController.fleetTrackingAvailabilityListeners.forEach((listener) => listener(hasTracking));
    }

    /** Updates the aggregated refresh-warning state and notifies listeners only when it changes. */
    protected static NotifyRefreshWarningState(hasWarning: boolean): void {
        if (hasWarning === TabRelatedController.hasGlobalRefreshWarning) return;
        TabRelatedController.hasGlobalRefreshWarning = hasWarning;
        TabRelatedController.globalRefreshWarningListeners.forEach((listener) => listener(hasWarning));
    }

    protected ComputeUniverseTabPresence(tabIds: number[]): UniverseTabPresence {
        return {
            hasLocalTabs: tabIds.some((tabId) => this.localWindowTabsTracker.IsLocalTab(tabId)),
            hasRemoteTabs: tabIds.some((tabId) => !this.localWindowTabsTracker.IsLocalTab(tabId)),
            isActiveInCurrentWindow: tabIds.some((tabId) => this.localWindowTabsTracker.IsActiveLocalTab(tabId)),
        };
    }

    protected BuildUniverseStatusBadgesHtml(presence: UniverseTabPresence): string {
        const { hasLocalTabs, hasRemoteTabs, isActiveInCurrentWindow } = presence;

        const renderBadge = (customClasses: string, defaultIcon: string, hoverIcon?: string) => `
  <span class="universe-status-badge ${customClasses}" aria-hidden="true">
    <span class="material-symbols-outlined ${hoverIcon ? 'icon-default' : ''}">${defaultIcon}</span>
    ${hoverIcon ? `<span class="material-symbols-outlined icon-hover">${hoverIcon}</span>` : ''}
  </span>
`.trim();

        const badges: string[] = [];

        if (hasLocalTabs) {
            if (isActiveInCurrentWindow) badges.push(renderBadge('is-active-current-window', 'check_circle'));
            else badges.push(renderBadge('is-open activate-tab', 'check_circle', 'visibility'));
        }

        if (hasRemoteTabs) {
            const actionClass = hasLocalTabs ? 'close-tab' : 'move-tab';
            const hoverIcon = hasLocalTabs ? 'close' : 'input';
            badges.push(renderBadge(`is-other-window ${actionClass}`, 'tab', hoverIcon));
        }

        if (!hasLocalTabs && !hasRemoteTabs) {
            badges.push(renderBadge('is-closed', 'cancel'));
        }

        return badges.join('');
    }

    public static IsRefreshWarningDue(status: SidePanelUniverseStatus, thresholdMinutes: number): boolean {
        if (thresholdMinutes <= 0) return false;
        if (!status.LastRefreshAtIso) return true;

        const lastRefreshAt = Date.parse(status.LastRefreshAtIso);
        if (!Number.isFinite(lastRefreshAt)) return true;

        return Date.now() - lastRefreshAt >= thresholdMinutes * 60_000;
    }

    protected ShouldShowRefreshWarning(status: SidePanelUniverseStatus, thresholdMinutes: number): boolean {
        return TabRelatedController.IsRefreshWarningDue(status, thresholdMinutes);
    }

    /** Fetches statuses from the service worker (single in-flight request), then recomputes the warning. */
    public static async RefreshGlobalWarningAsync(logger: Logger): Promise<void> {
        if (TabRelatedController.isFetchingGlobalWarning) {
            TabRelatedController.isGlobalWarningRefreshQueued = true;
            return;
        }
        TabRelatedController.isFetchingGlobalWarning = true;

        try {
            const rawData: SidePanelUniversesSections = await TabRelatedController.GetSharedSectionsPromise(logger, 'list');
            TabRelatedController.lastKnownStatuses = [
                ...(rawData?.favorites || []).flat(),
                ...(rawData?.others || []).flat(),
            ];
            TabRelatedController.NotifyFleetTrackingAvailability(
                TabRelatedController.lastKnownStatuses.some((status) => status.SidePanelOptions?.FleetTrackingEnabled ?? false)
            );
            TabRelatedController.RecomputeGlobalWarningFromCache();
        } catch (error) {
            logger.error('Failed to refresh global warning state', error);
        } finally {
            TabRelatedController.isFetchingGlobalWarning = false;
        }

        if (TabRelatedController.isGlobalWarningRefreshQueued) {
            TabRelatedController.isGlobalWarningRefreshQueued = false;
            await TabRelatedController.RefreshGlobalWarningAsync(logger);
        }
    }

    /** Network-free recomputation from the last fetched statuses (cheap, safe to call on a timer). */
    public static RecomputeGlobalWarningFromCache(): void {
        const hasWarning = TabRelatedController.lastKnownStatuses.some((status) =>
            TabRelatedController.IsRefreshWarningDue(
                status,
                status.SidePanelOptions?.WarningThresholdMinutes ?? DEFAULT_WARNING_THRESHOLD_MINUTES
            )
        );
        TabRelatedController.NotifyRefreshWarningState(hasWarning);
    }


    protected async HandleUniverseTabIconClickAsync(
        logger: Logger,
        status: SidePanelUniverseStatus,
        badge: HTMLElement,
        currentWindowId: number | undefined,
        onRefresh?: () => void
    ): Promise<void> {
        if (badge.classList.contains('activate-tab')) {
            await serviceWorkerProtocolClient.ActionOnUniverseTabAsync(logger, status.UniverseKey, 'activate', currentWindowId);
        } else if (badge.classList.contains('close-tab')) {
            await serviceWorkerProtocolClient.ActionOnUniverseTabAsync(logger, status.UniverseKey, 'close', currentWindowId);
            onRefresh?.();
        } else if (badge.classList.contains('move-tab')) {
            await serviceWorkerProtocolClient.ActionOnUniverseTabAsync(logger, status.UniverseKey, 'move', currentWindowId);
            onRefresh?.();
        } else if (badge.classList.contains('refresh-tab')) {
            await serviceWorkerProtocolClient.ActionOnUniverseTabAsync(logger, status.UniverseKey, 'refresh', currentWindowId);
        }
    }

}