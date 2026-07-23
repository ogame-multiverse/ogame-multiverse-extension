import { GlobalConstants } from '../../globalConstants';
import { Logger } from '../../logging/logger';
import { UniverseDataNormalizer } from '../../universeDataNormalizer';

export class UniverseTabsService {
  private readonly universeByTabId = new Map<number, string>();
  private started = false;

  constructor(private readonly logger: Logger) { }

  public GetUniverseTabs(): Map<number, string> {
    return this.universeByTabId;
  }


  public Start(): void {
    if (this.started) return;
    const chromeApi = (globalThis as { chrome?: typeof chrome }).chrome;
    if (!chromeApi?.tabs) return;

    chromeApi.tabs.onUpdated.addListener(this.OnTabUpdated);
    chromeApi.tabs.onRemoved.addListener(this.OnTabRemoved);
    chromeApi.tabs.onCreated.addListener(this.OnTabCreated);

    // Listen for extension installation or update events to reconnect open OGame tabs
    chromeApi.runtime.onInstalled.addListener(this.OnExtensionInstallation);

    this.started = true;
    void this.RebuildOpenTabsStateAsync();
    void this.ReconnectOpenOgameTabsAsync();
  }

  /**
   * On extension install or update, some browsers (like Chrome) may not properly trigger tab update events for already open tabs, 
   * which can lead to the extension not recognizing those tabs until the user interacts with them.
   * To mitigate this, we proactively query and reload any open OGame tabs to ensure they are correctly registered and updated with the latest extension data.
   * @returns promise that resolves when the reconnection process is complete, allowing for better handling of any potential errors or delays in tab updates after extension changes.
   */
  private async ReconnectOpenOgameTabsAsync(): Promise<void> {
    const chromeApi = (globalThis as { chrome?: typeof chrome }).chrome;
    if (!chromeApi?.tabs?.query || !chromeApi.tabs.reload) return;

    try {
      const tabs = await chromeApi.tabs.query({ url: GlobalConstants.OGAME_URL_GAME_PATTERN });
      const reloadableTabIds = tabs.map((tab: chrome.tabs.Tab) => tab.id).filter((tabId: any): tabId is number => typeof tabId === 'number');
      if (reloadableTabIds.length === 0) return;

      await Promise.allSettled(reloadableTabIds.map((tabId: any) => chromeApi.tabs.reload(tabId, { bypassCache: false })));
      this.logger.debug(`Reconnected ${reloadableTabIds.length} open OGame tab(s) after extension ${chromeApi.runtime?.id ? 'reload/update' : 'install'}.`);
    } catch (error) {
      this.logger.error('Failed to reconnect open OGame tabs on install/update.', error);
    }
  }


  private BuildUniverseOverviewUrl(universeKey: string): string {
    return `https://${universeKey}.${GlobalConstants.OGAME_DOMAIN}/game/index.php?page=ingame&component=overview`;
  }


  public async ReloadUniverseTabAsync(universeKey: string): Promise<void> {
    const chromeApi = (globalThis as { chrome?: typeof chrome }).chrome;
    if (!chromeApi?.tabs?.query || !chromeApi.tabs.reload) return;

    const tabs = await chromeApi.tabs.query({ url: GlobalConstants.OGAME_URL_GAME_PATTERN });
    const matchingTabs = tabs.filter((tab: chrome.tabs.Tab) => this.ExtractUniverseKeyFromTab(tab) === universeKey && typeof tab.id === 'number');
    if (matchingTabs.length === 0) {
      await chromeApi.tabs.create({
        url: this.BuildUniverseOverviewUrl(universeKey),
        active: true
      });
      return;
    }

    const activeTab = matchingTabs.find((tab: { active: any; }) => tab.active);
    const tabToReload = activeTab || matchingTabs[0];
    if (typeof tabToReload.id !== 'number') return;

    if (chromeApi.tabs.update) await chromeApi.tabs.update(tabToReload.id, { active: true, url: this.BuildUniverseOverviewUrl(universeKey), });
    else await chromeApi.tabs.reload(tabToReload.id, { bypassCache: true });
  }

  private readonly OnExtensionInstallation = (details: { reason: string }): void => {
    debugger;
    if (details.reason == 'install' || details.reason == 'update') {
      this.ReconnectOpenOgameTabsAsync();
    }
  };

  private readonly OnTabUpdated = (tabId: number, changeInfo: { status?: string; url?: string }, tab: chrome.tabs.Tab): void => {
    const universeFromUrl = this.ExtractUniverseKeyFromUrl(changeInfo.url || tab.url);

    if (universeFromUrl) {
      this.universeByTabId.set(tabId, universeFromUrl);
    } else if (changeInfo.url && !universeFromUrl) {
      this.universeByTabId.delete(tabId);
    }
  };

  private readonly OnTabRemoved = (tabId: number): void => {
    this.universeByTabId.delete(tabId);
  };

  private readonly OnTabCreated = (tab: chrome.tabs.Tab): void => {
    const universeKey = this.ExtractUniverseKeyFromTab(tab);
    if (!universeKey || typeof tab.id !== 'number') return;

    this.universeByTabId.set(tab.id, universeKey);
  };

  public async RebuildOpenTabsStateAsync(): Promise<void> {
    const chromeApi = (globalThis as { chrome?: typeof chrome }).chrome;
    if (!chromeApi?.tabs?.query) return;

    const tabs = await chromeApi.tabs.query({ url: GlobalConstants.OGAME_URL_GAME_PATTERN });
    const rebuilt = new Map<number, string>();

    tabs.forEach((tab: chrome.tabs.Tab) => {
      if (typeof tab.id !== 'number') return;
      const universeKey = this.ExtractUniverseKeyFromTab(tab);
      if (!universeKey) return;
      rebuilt.set(tab.id, universeKey);
    });

    this.universeByTabId.clear();
    rebuilt.forEach((value, key) => this.universeByTabId.set(key, value));
  }

  public GetOpenTabsCountByUniverse(allUniverseKeys: string[]): Map<string, number> {
    const openTabsCountByUniverse = new Map<string, number>();
    this.universeByTabId.forEach((universeKey) => {
      openTabsCountByUniverse.set(universeKey, (openTabsCountByUniverse.get(universeKey) || 0) + 1);
    });

    openTabsCountByUniverse.forEach((_, universeKey) => allUniverseKeys.push(universeKey));
    return openTabsCountByUniverse;
  }

  private ExtractUniverseKeyFromTab(tab: chrome.tabs.Tab): string | undefined {
    return this.ExtractUniverseKeyFromUrl(tab.url);
  }

  private ExtractUniverseKeyFromUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.endsWith(`.${GlobalConstants.OGAME_DOMAIN}`)) return undefined;
      if (!parsed.pathname.startsWith('/game/')) return undefined;

      const universeKey = parsed.hostname.split('.')[0];
      const normalizedUniverseKey = UniverseDataNormalizer.NormalizeUniverseKey(universeKey);
      return normalizedUniverseKey || undefined;
    } catch (error) {
      this.logger.warn('Unable to parse tab URL for universe extraction', error);
      return undefined;
    }
  }

}
