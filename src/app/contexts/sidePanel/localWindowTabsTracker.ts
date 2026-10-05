import browser from 'webextension-polyfill';
import { Debouncer } from '../../async/debouncer';
import { GlobalConstants } from '../../globalConstants';
import { Logger } from '../../logging/logger';

const REFRESH_DEBOUNCE_KEY = 'local-window-tabs-refresh';
const REFRESH_DEBOUNCE_MS = 50;
const NOTIFY_DEBOUNCE_KEY = 'local-window-tabs-notify';
const NOTIFY_DEBOUNCE_MS = 100;

type TabChangedCallback = () => void;
export class LocalWindowTabsTracker {

    private isRefreshing = false;
    private isRefreshQueued = false;
    private lastSnapshot: string | undefined;
    private currentWindowId?: number;
    private readonly localTabIds = new Set<number>();
    private readonly activeLocalTabIds = new Set<number>();
    private readonly activeLocalTabUrls = new Set<string>();

    private readonly onTabActivated = (activeInfo: browser.Tabs.OnActivatedActiveInfoType) => {
        if (this.IsOtherWindow(activeInfo.windowId)) return;
        this.Refresh();
    };
    private readonly onTabUpdated = (_tabId: number, changeInfo: browser.Tabs.OnUpdatedChangeInfoType, tab?: browser.Tabs.Tab) => {
        if (changeInfo.url === undefined && changeInfo.status !== 'complete') return;
        if (this.IsOtherWindow(tab?.windowId)) return;
        this.Refresh();
    };
    private readonly onTabRemoved = (_tabId: number, removeInfo: browser.Tabs.OnRemovedRemoveInfoType) => {
        if (this.IsOtherWindow(removeInfo.windowId)) return;
        this.Refresh();
    };
    private readonly onTabAttached = (_tabId: number, attachInfo: browser.Tabs.OnAttachedAttachInfoType) => {
        if (this.IsOtherWindow(attachInfo.newWindowId)) return;
        this.Refresh();
    };
    private readonly onTabDetached = (_tabId: number, detachInfo: browser.Tabs.OnDetachedDetachInfoType) => {
        if (this.IsOtherWindow(detachInfo.oldWindowId)) return;
        this.Refresh();
    };

    private readonly listeners = new Set<TabChangedCallback>();
    public onLocalTabChanged = {
        addListener: (callback: TabChangedCallback) => this.listeners.add(callback),
        removeListener: (callback: TabChangedCallback) => this.listeners.delete(callback)
    };

    public destroy() {
        browser.tabs.onActivated.removeListener(this.onTabActivated);
        browser.tabs.onUpdated.removeListener(this.onTabUpdated);
        browser.tabs.onRemoved.removeListener(this.onTabRemoved);
        browser.tabs.onAttached.removeListener(this.onTabAttached);
        browser.tabs.onDetached.removeListener(this.onTabDetached);
        Debouncer.CancelDebounceKey(REFRESH_DEBOUNCE_KEY);
        Debouncer.CancelDebounceKey(NOTIFY_DEBOUNCE_KEY);
        this.listeners.clear();
    }

    constructor(private readonly logger: Logger) {
        browser.tabs.onActivated.addListener(this.onTabActivated);
        browser.tabs.onUpdated.addListener(this.onTabUpdated);
        browser.tabs.onRemoved.addListener(this.onTabRemoved);
        browser.tabs.onAttached.addListener(this.onTabAttached);
        browser.tabs.onDetached.addListener(this.onTabDetached);
    }

    public NotifyExternalChange(): void {
        this.ScheduleNotify();
    }

    private ScheduleNotify(): void {
        Debouncer.Debounce(NOTIFY_DEBOUNCE_KEY, () => this.NotifyTabChanged(), NOTIFY_DEBOUNCE_MS, false);
    }

    private NotifyTabChanged() {
        this.listeners.forEach(callback => callback());
    }

    public get WindowId(): number | undefined {
        return this.currentWindowId;
    }

    public IsLocalTab(tabId: number): boolean {
        return this.localTabIds.has(tabId);
    }

    public IsActiveLocalTab(tabId: number): boolean {
        return this.activeLocalTabIds.has(tabId);
    }

    public GetActiveLocalTabUrls(): string[] {
        return Array.from(this.activeLocalTabUrls);
    }

    private IsOtherWindow(windowId: number | undefined): boolean {
        return this.currentWindowId !== undefined && windowId !== undefined && windowId !== this.currentWindowId;
    }

    private static ToHost(url: string | undefined): string {
        if (!url) return '';
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }

    private static IsOgameTab(tab: browser.Tabs.Tab): boolean {
        return LocalWindowTabsTracker.ToHost(tab.url).endsWith(`.${GlobalConstants.OGAME_DOMAIN}`);
    }

    private async InitCurrentWindowIdAsync(): Promise<void> {
        try {
            const win = await browser.windows.getCurrent();
            this.currentWindowId = win?.id;
        } catch (error) {
            this.logger.error('Failed to get current window ID', error);
        }
    }

    private Refresh(): void {
        Debouncer.Debounce(REFRESH_DEBOUNCE_KEY, async () => {
            await this.RefreshAsync();
        }, REFRESH_DEBOUNCE_MS, false);
    }


    public async RefreshAsync(): Promise<void> {
        if (this.isRefreshing) {
            this.isRefreshQueued = true;
            return;
        }
        this.isRefreshing = true;

        try {
            if (this.currentWindowId === undefined) {
                await this.InitCurrentWindowIdAsync();
            }
            if (this.currentWindowId === undefined) return;

            const tabs = (await browser.tabs.query({ windowId: this.currentWindowId })).filter((tab) => LocalWindowTabsTracker.IsOgameTab(tab));

            const snapshot = tabs
                .map((tab) => tab.active ? `${tab.id}|1|${LocalWindowTabsTracker.ToHost(tab.url)}` : `${tab.id}|0`)
                .join('\n');
            if (snapshot === this.lastSnapshot) return;
            this.lastSnapshot = snapshot;

            this.localTabIds.clear();
            this.activeLocalTabIds.clear();
            this.activeLocalTabUrls.clear();

            for (const tab of tabs) {
                if (typeof tab.id === 'number') {
                    this.localTabIds.add(tab.id);
                    if (tab.active) {
                        this.activeLocalTabIds.add(tab.id);
                        if (tab.url) this.activeLocalTabUrls.add(tab.url);
                    }
                }
            }

            this.ScheduleNotify();
        } catch (error) {
            this.logger.error('Failed to query tabs for current window', error);
        } finally {
            this.isRefreshing = false;
            if (this.isRefreshQueued) {
                this.isRefreshQueued = false;
                this.Refresh();
            }
        }
    }

}