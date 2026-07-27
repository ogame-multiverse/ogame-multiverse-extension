import browser from 'webextension-polyfill';
import { Debouncer } from '../../async/debouncer';
import { Logger } from '../../logging/logger';




type TabChangedCallback = () => void;
export class LocalWindowTabsTracker {

    private isRefreshing = false;
    private lastSnapshot = '';
    private currentWindowId?: number;
    private readonly localTabIds = new Set<number>();
    private readonly activeLocalTabIds = new Set<number>();
    private readonly activeLocalTabUrls = new Set<string>();
    private readonly onTabChanged = () => { this.Refresh(); };
    private readonly onTabUpdated = (_tabId: number, changeInfo: browser.Tabs.OnUpdatedChangeInfoType, tab?: browser.Tabs.Tab) => {
        if (changeInfo.url === undefined && changeInfo.status !== 'complete') return;
        if (this.currentWindowId !== undefined && tab?.windowId !== undefined && tab.windowId !== this.currentWindowId) return;
        this.Refresh();
    };

    private readonly listeners = new Set<TabChangedCallback>();
    public onLocalTabChanged = {
        addListener: (callback: TabChangedCallback) => this.listeners.add(callback),
        removeListener: (callback: TabChangedCallback) => this.listeners.delete(callback)
    };

    public destroy() {
        browser.tabs.onActivated.removeListener(this.onTabChanged);
        browser.tabs.onUpdated.removeListener(this.onTabUpdated);
        browser.tabs.onRemoved.removeListener(this.onTabChanged);
        this.listeners.clear();
    }

    constructor(private readonly logger: Logger) {
        browser.tabs.onActivated.addListener(this.onTabChanged);
        browser.tabs.onUpdated.addListener(this.onTabUpdated);
        browser.tabs.onRemoved.addListener(this.onTabChanged);
    }

    public NotifyExternalChange(): void {
        this.NotifyTabChanged();
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

    private async InitCurrentWindowIdAsync(): Promise<void> {
        try {
            const win = await browser.windows.getCurrent();
            this.currentWindowId = win?.id;
        } catch (error) {
            this.logger.error('Failed to get current window ID', error);
        }
    }

    private Refresh(): void {
        Debouncer.Debounce('local-window-tabs-refresh', async () => {
            await this.RefreshAsync();
        }, 50, false);
    }


    public async RefreshAsync(): Promise<void> {
        if (this.isRefreshing) return;
        this.isRefreshing = true;

        try {
            if (this.currentWindowId === undefined) {
                await this.InitCurrentWindowIdAsync();
            }
            if (this.currentWindowId === undefined) return;

            const tabs = await browser.tabs.query({ windowId: this.currentWindowId });

            const snapshot = tabs.map((tab) => `${tab.id}|${tab.active ? 1 : 0}|${tab.url ?? ''}`).join('\n');
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

            this.NotifyTabChanged();
        } catch (error) {
            this.logger.error('Failed to query tabs for current window', error);
        } finally {
            this.isRefreshing = false;
        }
    }

}