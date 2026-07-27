import browser from 'webextension-polyfill';
import { GlobalConstants } from '../../globalConstants';
import { Logger } from '../../logging/logger';
import { UniverseDataNormalizer } from '../../universeDataNormalizer';
import { sidePanelBroadcastProtocolClient } from '../../messaging/sidePanelBroadcastProtocol';

export class UniverseTabsService {
  private readonly universeByTabId = new Map<number, string>();
  private started = false;

  constructor(private readonly logger: Logger) { }

  public GetUniverseTabs(): Map<number, string> {
    return this.universeByTabId;
  }


  public Start(): void {
    if (this.started) return;
    if (!browser?.tabs) return;

    browser.tabs.onUpdated.addListener(this.OnTabUpdated);
    browser.tabs.onRemoved.addListener(this.OnTabRemoved);
    browser.tabs.onCreated.addListener(this.OnTabCreated);


    this.started = true;
    void this.RebuildOpenTabsStateAsync();
  }

  private BuildUniverseOverviewUrl(universeKey: string): string {
    return `https://${universeKey}.${GlobalConstants.OGAME_DOMAIN}/game/index.php?page=ingame&component=overview`;
  }


  public async ReloadUniverseTabAsync(universeKey: string): Promise<void> {
    if (!browser?.tabs?.query || !browser.tabs.reload) return;

    const tabs = await browser.tabs.query({ url: GlobalConstants.OGAME_URL_GAME_PATTERN });
    const matchingTabs = tabs.filter((tab: browser.Tabs.Tab) => this.ExtractUniverseKeyFromTab(tab) === universeKey && typeof tab.id === 'number');
    if (matchingTabs.length === 0) {
      await browser.tabs.create({
        url: this.BuildUniverseOverviewUrl(universeKey),
        active: true
      });
      return;
    }

    const activeTab = matchingTabs.find((tab: { active: any; }) => tab.active);
    const tabToReload = activeTab || matchingTabs[0];
    if (typeof tabToReload.id !== 'number') return;

    if (browser.tabs.update) await browser.tabs.update(tabToReload.id, { active: true, url: this.BuildUniverseOverviewUrl(universeKey), });
    else await browser.tabs.reload(tabToReload.id, { bypassCache: true });
  }


  private readonly OnTabUpdated = (tabId: number, changeInfo: { status?: string; url?: string }, tab: browser.Tabs.Tab): void => {
    const universeFromUrl = this.ExtractUniverseKeyFromUrl(changeInfo.url || tab.url);

    if (universeFromUrl) {
      this.universeByTabId.set(tabId, universeFromUrl);
      sidePanelBroadcastProtocolClient.UpdateUniverseOpenState(this.logger, universeFromUrl, true);
    } else if (changeInfo.url && !universeFromUrl) {
      const oldUniverse = this.universeByTabId.get(tabId);
      this.universeByTabId.delete(tabId);
      if (oldUniverse) {
        const isStillOpen = this.HasOpenTabForUniverse(oldUniverse);
        sidePanelBroadcastProtocolClient.UpdateUniverseOpenState(this.logger, oldUniverse, isStillOpen);
      }
    }
  };

  private readonly OnTabRemoved = (tabId: number): void => {
    const universeKey = this.universeByTabId.get(tabId) || '';
    this.universeByTabId.delete(tabId);
    const isUniverseStillOpen = this.HasOpenTabForUniverse(universeKey);
    sidePanelBroadcastProtocolClient.UpdateUniverseOpenState(this.logger, universeKey, isUniverseStillOpen);
  };

  private readonly OnTabCreated = (tab: browser.Tabs.Tab): void => {
    const universeKey = this.ExtractUniverseKeyFromTab(tab);
    if (!universeKey || typeof tab.id !== 'number') return;

    this.universeByTabId.set(tab.id, universeKey);
    sidePanelBroadcastProtocolClient.UpdateUniverseOpenState(this.logger, universeKey, true);
  };

  public async RebuildOpenTabsStateAsync(): Promise<void> {
    if (!browser?.tabs?.query) return;

    const tabs = await browser.tabs.query({ url: GlobalConstants.OGAME_URL_GAME_PATTERN });
    const rebuilt = new Map<number, string>();

    tabs.forEach((tab: browser.Tabs.Tab) => {
      if (typeof tab.id !== 'number') return;
      const universeKey = this.ExtractUniverseKeyFromTab(tab);
      if (!universeKey) return;
      rebuilt.set(tab.id, universeKey);
    });

    this.universeByTabId.clear();
    rebuilt.forEach((value, key) => this.universeByTabId.set(key, value));
  }

  public HasOpenTabForUniverse(universeKey: string): boolean {
    return Array.from(this.universeByTabId.values()).some((key) => key === universeKey);
  }

  public GetOpenTabsCountByUniverse(allUniverseKeys: string[]): Map<string, number> {
    const openTabsCountByUniverse = new Map<string, number>();
    this.universeByTabId.forEach((universeKey) => {
      openTabsCountByUniverse.set(universeKey, (openTabsCountByUniverse.get(universeKey) || 0) + 1);
    });

    openTabsCountByUniverse.forEach((_, universeKey) => allUniverseKeys.push(universeKey));
    return openTabsCountByUniverse;
  }

  private ExtractUniverseKeyFromTab(tab: browser.Tabs.Tab): string | undefined {
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
