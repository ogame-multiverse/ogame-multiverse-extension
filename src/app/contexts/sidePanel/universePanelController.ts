import { GlobalConstants } from '../../globalConstants';
import { Localizator } from '../../localization/localizator';
import { Logger } from '../../logging/logger';
import { serviceWorkerProtocolClient } from '../../messaging/serviceWorkerProtocol';
import { sidePanelBroadcastProtocolRegistrar } from '../../messaging/sidePanelBroadcastProtocol';
import { SidePanelUniverseStatus } from '../../model/sidePanel/sidePanelUniverseStatus';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { Debouncer } from '../../async/debouncer';
import { SidePanelUniverseCounters } from '../../model/sidePanel/sidePanelUniverseCounters';

interface UniverseRowView {
  row: HTMLElement;
  title: HTMLElement;
  badgesContainer: HTMLElement;
  lastRefresh: HTMLElement;
  unreadMessagesValue: HTMLElement;
  unreadChatMessagesValue: HTMLElement;
  hostileFleetGroup: HTMLElement;
  hostileFleetCountValue: HTMLElement;
  friendlyFleetCountValue: HTMLElement;
  ownFleetCountValue: HTMLElement;
  refreshButton: HTMLButtonElement;
  settingsButton: HTMLButtonElement;
  removeButton: HTMLButtonElement;
  updateWarningState: () => void;
  currentStatus: SidePanelUniverseStatus;
}

interface IndicatorBinding {
  checkboxIdSuffix: string;
  attributeName: string;
  optionKey: keyof UniverseSidePanelOptions;
}

const INDICATOR_BINDINGS: IndicatorBinding[] = [
  { checkboxIdSuffix: 'indicator-fleet-hostile-display-setting-checkbox', attributeName: 'show-hostile-fleets-indicator', optionKey: 'ShowHostileFleetIndicator' },
  { checkboxIdSuffix: 'indicator-fleet-friendly-display-setting-checkbox', attributeName: 'show-friendly-fleets-indicator', optionKey: 'ShowFriendlyFleetIndicator' },
  { checkboxIdSuffix: 'indicator-fleet-own-display-setting-checkbox', attributeName: 'show-own-fleets-indicator', optionKey: 'ShowOwnFleetIndicator' },
  { checkboxIdSuffix: 'indicator-unread-mail-display-setting-checkbox', attributeName: 'show-unread-mail-indicator', optionKey: 'ShowUnreadMessagesIndicator' },
  { checkboxIdSuffix: 'indicator-unread-chat-display-setting-checkbox', attributeName: 'show-unread-chat-indicator', optionKey: 'ShowUnreadChatMessagesIndicator' },
];

export class UniversePanelController {
  private readonly warningThresholdOptions = [5, 10, 15, 30, 45, -1];
  private readonly defaultWarningThresholdMinutes = 15;

  private loaded = false;
  private syncSuspended = false;
  private syncIndicatorEl?: HTMLElement;
  private readonly universeRowsByKey = new Map<string, UniverseRowView>();

  private rafId?: number;
  private readonly lastSecondByUniverseKey = new Map<string, number>();
  private lastSyncCheckTime = 0;

  private currentWindowId?: number;
  private readonly localTabIds = new Set<number>();

  private readonly onTabActivated = () => { void this.CheckSyncStateAsync(); void this.Refresh(); };
  private readonly onTabUpdated = () => { void this.CheckSyncStateAsync(); void this.Refresh(); };

  constructor(private readonly logger: Logger) {
    sidePanelBroadcastProtocolRegistrar.OnRegisterUniverse(this.logger, () => this.Refresh());

    sidePanelBroadcastProtocolRegistrar.OnRemoveUniverse(this.logger, (universeKey: string) => {
      this.RemoveSingleUniverse(universeKey);
    });

    sidePanelBroadcastProtocolRegistrar.OnUpdateUniverseStatus(
      this.logger,
      (data: { universeKey: string; universeName: string; universeCounters: SidePanelUniverseCounters; isOpen: boolean }) => {
        this.UpdateSingleUniverseStatus(data);
      }
    );

    sidePanelBroadcastProtocolRegistrar.OnUpdateUniverseOpenState(this.logger, (data: { universeKey: string; isOpen: boolean }) => {
      this.UpdateUniverseOpenState(data.universeKey, data.isOpen);
    });

    sidePanelBroadcastProtocolRegistrar.OnUpdateUniverseSidePanelOptions(
      this.logger,
      (data: { universeKey: string; options: UniverseSidePanelOptions }) => {
        this.UpdateSingleUniverseOptions(data.universeKey, data.options);
      }
    );
  }

  public async ActivateAsync(): Promise<void> {
    if (!this.loaded) {
      this.loaded = true;
      await this.InitCurrentWindowIdAsync();
      this.Refresh();
    }
    this.StartAnimationLoop();
    void this.CheckSyncStateAsync();

    const chromeApi = (globalThis as { chrome?: any }).chrome;
    if (chromeApi?.tabs) {
      chromeApi.tabs.onActivated?.addListener(this.onTabActivated);
      chromeApi.tabs.onUpdated?.addListener(this.onTabUpdated);
    }
  }

  public Deactivate(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }

    const chromeApi = (globalThis as { chrome?: any }).chrome;
    if (chromeApi?.tabs) {
      chromeApi.tabs.onActivated?.removeListener(this.onTabActivated);
      chromeApi.tabs.onUpdated?.removeListener(this.onTabUpdated);
    }
  }

  private async InitCurrentWindowIdAsync(): Promise<void> {
    const chromeApi = (globalThis as { chrome?: any }).chrome;
    if (chromeApi?.windows?.getCurrent) {
      try {
        const win = await chromeApi.windows.getCurrent();
        this.currentWindowId = win?.id;
      } catch (error) {
        this.logger.error('Failed to get current window ID', error);
      }
    }
  }

  private async UpdateLocalTabIdsAsync(): Promise<void> {
    if (this.currentWindowId === undefined) {
      await this.InitCurrentWindowIdAsync();
    }
    if (this.currentWindowId === undefined) return;

    const chromeApi = (globalThis as { chrome?: any }).chrome;
    if (chromeApi?.tabs?.query) {
      try {
        const tabs = await chromeApi.tabs.query({ windowId: this.currentWindowId });
        this.localTabIds.clear();
        tabs.forEach((tab: any) => {
          if (typeof tab.id === 'number') {
            this.localTabIds.add(tab.id);
          }
        });
      } catch (error) {
        this.logger.error('Failed to query tabs for current window', error);
      }
    }
  }

  public Refresh(): void {
    Debouncer.Debounce('universe-panel-refresh', async () => {
      const container = document.getElementById('universe-list');
      if (!container) return;

      void this.CheckSyncStateAsync();
      await this.UpdateLocalTabIdsAsync();

      const universeStatuses = await serviceWorkerProtocolClient.GetUniversesStatusesAsync(this.logger);
      if (!universeStatuses.length) {
        container.replaceChildren();
        this.universeRowsByKey.clear();
        this.lastSecondByUniverseKey.clear();

        const empty = document.createElement('div');
        empty.className = 'universe-empty';
        empty.textContent = Localizator.Translate('SidePanelNoUniverses');
        container.appendChild(empty);
        return;
      }

      this.SyncUniverseRows(container, universeStatuses);
    }, 100, false);
  }

  private UpdateUniverseOpenState(universeKey: string, isOpen: boolean): void {
    const key = this.NormalizeUniverseKey(universeKey);
    const existingRow = this.universeRowsByKey.get(key);

    if (existingRow) {
      existingRow.currentStatus.IsOpen = isOpen;
      this.UpdateUniverseRow(existingRow, existingRow.currentStatus);
    }
  }

  public async CheckSyncStateAsync(): Promise<void> {
    const hasActiveTab = await this.HasActiveSyncableTabAsync();
    this.syncSuspended = !hasActiveTab;
    this.SetSyncPausedIndicator(this.syncSuspended);
  }

  public UpdateSingleUniverseStatus(data: { universeKey: string; universeName: string; universeCounters: SidePanelUniverseCounters; isOpen: boolean }): void {
    if (!data?.universeKey) return;

    const universeKey = this.NormalizeUniverseKey(data.universeKey);
    const existingRow = this.universeRowsByKey.get(universeKey);

    if (existingRow) {
      existingRow.currentStatus.UniverseDisplayName = data.universeName;
      existingRow.currentStatus.IsOpen = data.isOpen;
      if (data.universeCounters) {
        existingRow.currentStatus.SidePanelUniverseCounters = data.universeCounters;
      }
      this.UpdateUniverseRow(existingRow, existingRow.currentStatus);
    } else {
      this.Refresh();
    }
  }

  public RemoveSingleUniverse(universeKey: string): void {
    if (!universeKey) return;

    const key = this.NormalizeUniverseKey(universeKey);
    const existingRow = this.universeRowsByKey.get(key);

    if (existingRow) {
      existingRow.row.remove();
      this.universeRowsByKey.delete(key);
      this.lastSecondByUniverseKey.delete(key);

      const container = document.getElementById('universe-list');
      if (container && this.universeRowsByKey.size === 0) {
        container.replaceChildren();
        const empty = document.createElement('div');
        empty.className = 'universe-empty';
        empty.textContent = Localizator.Translate('SidePanelNoUniverses');
        container.appendChild(empty);
      }
    }
  }

  public UpdateSingleUniverseOptions(universeKey: string, options: UniverseSidePanelOptions): void {
    if (!universeKey || !options) return;

    const key = this.NormalizeUniverseKey(universeKey);
    const existingRow = this.universeRowsByKey.get(key);

    if (!existingRow) return;

    existingRow.currentStatus.SidePanelOptions = options;

    const thresholdSelect = existingRow.row.querySelector('.universe-threshold-select') as HTMLSelectElement;
    if (thresholdSelect && options.WarningThresholdMinutes !== undefined) {
      thresholdSelect.value = String(options.WarningThresholdMinutes);
    }

    INDICATOR_BINDINGS.forEach(({ checkboxIdSuffix, attributeName, optionKey }) => {
      const checkbox = existingRow.row.querySelector(`#${checkboxIdSuffix}-${existingRow.currentStatus.UniverseKey}`) as HTMLInputElement;
      const value = Boolean(options[optionKey]);
      if (checkbox) {
        checkbox.checked = value;
      }
      existingRow.row.setAttribute(attributeName, String(value));
    });

    existingRow.updateWarningState();
  }

  private StartAnimationLoop(): void {
    if (this.rafId !== undefined) return;

    const loop = () => {
      this.TickRenderedRows();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private TickRenderedRows(): void {
    const now = Date.now();

    if (now - this.lastSyncCheckTime >= 1000) {
      this.lastSyncCheckTime = now;
      void this.CheckSyncStateAsync();
    }

    this.universeRowsByKey.forEach((rowView, universeKey) => {
      const status = rowView.currentStatus;
      if (!status.LastRefreshAtIso) return;

      const parsed = Date.parse(status.LastRefreshAtIso);
      if (!Number.isFinite(parsed)) return;

      const elapsedSec = Math.max(0, Math.floor((now - parsed) / 1000));
      const previousSec = this.lastSecondByUniverseKey.get(universeKey);

      if (elapsedSec !== previousSec) {
        this.lastSecondByUniverseKey.set(universeKey, elapsedSec);

        const nextRefreshText = `${Localizator.Translate('SidePanelLastRefreshLabel')}: ${this.FormatLastRefreshWithState(status)}`;
        if (rowView.lastRefresh.textContent !== nextRefreshText) {
          rowView.lastRefresh.textContent = nextRefreshText;
        }
        rowView.updateWarningState();
      }
    });
  }

  private async HasActiveSyncableTabAsync(): Promise<boolean> {
    const chromeApi = (globalThis as { chrome?: any }).chrome;
    if (!chromeApi?.tabs?.query) return true;

    try {
      const queries = [{ active: true, currentWindow: true }, { active: true, lastFocusedWindow: true }, { active: true }];
      for (const query of queries) {
        const tabs = await chromeApi.tabs.query(query);
        if (tabs.some((tab: any) => this.IsKeepSyncTab(tab))) return true;
      }
      return false;
    } catch {
      return true;
    }
  }

  private IsKeepSyncTab(tab: any): boolean {
    if (GlobalConstants.SYNC_TABS_URLS_REGEXPS.length === 0) return true;
    const url = typeof tab?.url === 'string' ? tab.url : typeof tab?.pendingUrl === 'string' ? tab.pendingUrl : '';
    return GlobalConstants.SYNC_TABS_URLS_REGEXPS.some((regexp) => regexp.test(url));
  }

  private SetSyncPausedIndicator(paused: boolean): void {
    const container = document.getElementById('universe-list');
    if (!container) return;

    if (!paused) {
      this.syncIndicatorEl?.remove();
      this.syncIndicatorEl = undefined;
      return;
    }

    if (this.syncIndicatorEl) return;

    const parent = container.parentElement || container;
    const el = document.createElement('div');
    el.id = 'universe-sync-paused';
    el.className = 'universe-sync-paused';

    const text = Localizator.Translate('SidePanelSyncPaused') || 'Sync paused — no active OGame tab.';
    el.innerHTML = `
      <span class="material-symbols-outlined" aria-hidden="true">warning</span>
      <span>${text}</span>
    `;

    parent.insertBefore(el, container);
    this.syncIndicatorEl = el;
  }

  private BuildUniverseRow(status: SidePanelUniverseStatus): UniverseRowView {
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = this.GetUniverseRowTemplate(status.UniverseKey);
    const row = tempContainer.firstElementChild as HTMLElement;

    const thresholdSelect = row.querySelector('.universe-threshold-select') as HTMLSelectElement;
    const refreshButton = row.querySelector('.universe-refresh-button') as HTMLButtonElement;
    const settingsButton = row.querySelector('.universe-settings-button') as HTMLButtonElement;
    const removeButton = row.querySelector('.universe-remove-button') as HTMLButtonElement;
    const lastRefresh = row.querySelector('.universe-last-refresh') as HTMLElement;
    const badgesContainer = row.querySelector('.universe-status-badges') as HTMLElement;

    // Gestion du clic sur le badge en se basant sur l'élément cliqué
    badgesContainer.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const badge = target.closest('.universe-status-badge');
      if (badge) {
        void this.HandleTabIconClickAsync(rowView.currentStatus, badge as HTMLElement);
      }
    });

    const updateWarningState = (thresholdMinutes: number) => {
      const shouldWarn = this.ShouldShowRefreshWarning(rowView.currentStatus, thresholdMinutes);
      refreshButton.classList.toggle('universe-refresh-warning', shouldWarn);
      lastRefresh.classList.toggle('universe-last-refresh-warning', shouldWarn);
    };

    const rowView: UniverseRowView = {
      row,
      title: row.querySelector('.universe-title')!,
      badgesContainer,
      lastRefresh,
      unreadMessagesValue: row.querySelector('.unread-mail')!,
      unreadChatMessagesValue: row.querySelector('.unread-chat')!,
      hostileFleetGroup: row.querySelector('.fleet-hostile-group')!,
      hostileFleetCountValue: row.querySelector('.fleet-hostile')!,
      friendlyFleetCountValue: row.querySelector('.fleet-friendly')!,
      ownFleetCountValue: row.querySelector('.fleet-own')!,
      refreshButton,
      settingsButton,
      removeButton,
      currentStatus: status,
      updateWarningState: () => {
        const threshold = status.SidePanelOptions.WarningThresholdMinutes ?? this.defaultWarningThresholdMinutes;
        updateWarningState(threshold);
      },
    };

    const selectedThreshold = status.SidePanelOptions.WarningThresholdMinutes;
    this.warningThresholdOptions.forEach((minutes) => {
      const option = document.createElement('option');
      option.value = String(minutes);
      option.textContent = minutes > 0 ? `${minutes} ${Localizator.Translate('SidePanelMinutesShort')}` : Localizator.Translate('Never');
      option.selected = selectedThreshold === minutes;
      thresholdSelect.appendChild(option);
    });

    updateWarningState(selectedThreshold ?? this.defaultWarningThresholdMinutes);

    thresholdSelect.addEventListener('change', async () => {
      const selectedMinutes = Number(thresholdSelect.value);
      status.SidePanelOptions.WarningThresholdMinutes = selectedMinutes;
      await this.SaveOption(status.UniverseKey, 'WarningThresholdMinutes', selectedMinutes);
      updateWarningState(selectedMinutes);
    });

    refreshButton.addEventListener('click', () => this.ExecuteRowAction(refreshButton, () => serviceWorkerProtocolClient.ReloadUniverseTabAsync(this.logger, status.UniverseKey)));
    removeButton.addEventListener('click', () => this.ExecuteRowAction(removeButton, () => serviceWorkerProtocolClient.RemoveUniverseAsync(this.logger, status.UniverseKey)));

    settingsButton.addEventListener('click', () => {
      const isActive = settingsButton.getAttribute('data-universe-settings-active') === 'true';
      settingsButton.setAttribute('data-universe-settings-active', String(!isActive));
    });

    INDICATOR_BINDINGS.forEach(({ checkboxIdSuffix, attributeName, optionKey }) => {
      const checkbox = row.querySelector(`#${checkboxIdSuffix}-${status.UniverseKey}`) as HTMLInputElement;
      if (!checkbox) return;

      const initialValue = Boolean(status.SidePanelOptions[optionKey]);
      checkbox.checked = initialValue;
      row.setAttribute(attributeName, String(initialValue));

      checkbox.addEventListener('change', async () => {
        const checked = checkbox.checked;
        row.setAttribute(attributeName, String(checked));
        await this.SaveOption(status.UniverseKey, optionKey, checked);
      });
    });

    this.UpdateUniverseRow(rowView, status);
    return rowView;
  }

  private async HandleTabIconClickAsync(status: SidePanelUniverseStatus, badge: HTMLElement): Promise<void> {
    const chromeApi = (globalThis as { chrome?: any }).chrome;
    if (!chromeApi?.tabs) return;

    const tabIds = status.TabIds || [];
    const localTabIds = tabIds.filter((tabId) => this.localTabIds.has(tabId));
    const remoteTabIds = tabIds.filter((tabId) => !this.localTabIds.has(tabId));

    if (badge.classList.contains('activate-tab')) {
      if (localTabIds.length > 0) {
        try {
          const targetTabId = localTabIds[0];
          const tab = await chromeApi.tabs.get(targetTabId);
          if (tab?.windowId) {
            await chromeApi.windows.update(tab.windowId, { focused: true });
          }
          await chromeApi.tabs.update(targetTabId, { active: true });
        } catch (error) {
          this.logger.error('Failed to activate tab', error);
        }
      }
    } else if (badge.classList.contains('close-tab')) {
      if (remoteTabIds.length > 0) {
        try {
          await chromeApi.tabs.remove(remoteTabIds);
          this.Refresh();
        } catch (error) {
          this.logger.error('Failed to close remote universe tabs', error);
        }
      }
    } else if (badge.classList.contains('move-tab')) {
      if (this.currentWindowId === undefined) {
        await this.InitCurrentWindowIdAsync();
      }
      if (this.currentWindowId === undefined) return;

      if (remoteTabIds.length > 0) {
        try {
          const movedTabs = await chromeApi.tabs.move(remoteTabIds, { windowId: this.currentWindowId, index: -1 });
          const firstMovedTabId = Array.isArray(movedTabs) ? movedTabs[0]?.id : movedTabs?.id;
          if (firstMovedTabId) {
            await chromeApi.tabs.update(firstMovedTabId, { active: true });
          } else if (remoteTabIds.length > 0) {
            await chromeApi.tabs.update(remoteTabIds[0], { active: true });
          }
          await chromeApi.windows.update(this.currentWindowId, { focused: true });
          this.Refresh();
        } catch (error) {
          this.logger.error('Failed to move and activate universe tabs', error);
        }
      }
    }
  }

  private async SaveOption<K extends keyof UniverseSidePanelOptions>(universeKey: string, key: K, value: UniverseSidePanelOptions[K]): Promise<void> {
    const options = await serviceWorkerProtocolClient.GetUniverseSidePanelOptionsAsync(this.logger, universeKey);
    options[key] = value;
    await serviceWorkerProtocolClient.SaveUniverseSidePanelOptionsAsync(this.logger, universeKey, options);
  }

  private async ExecuteRowAction(button: HTMLButtonElement, action: () => Promise<void>): Promise<void> {
    if (button.disabled) return;
    button.disabled = true;
    try {
      await action();
    } finally {
      try {
        this.Refresh();
      } finally {
        button.disabled = false;
      }
    }
  }

  private SyncUniverseRows(container: HTMLElement, universeStatuses: SidePanelUniverseStatus[]): void {
    container.querySelector('.universe-empty')?.remove();
    const nextUniverseKeys = new Set<string>();

    universeStatuses.forEach((status) => {
      const universeKey = this.NormalizeUniverseKey(status.UniverseKey);
      nextUniverseKeys.add(universeKey);

      const existingRow = this.universeRowsByKey.get(universeKey);
      if (existingRow) {
        this.UpdateUniverseRow(existingRow, status);
      } else {
        const createdRow = this.BuildUniverseRow(status);
        this.universeRowsByKey.set(universeKey, createdRow);
        container.appendChild(createdRow.row);
      }
    });

    this.universeRowsByKey.forEach((rowView, key) => {
      if (!nextUniverseKeys.has(key)) {
        rowView.row.remove();
        this.universeRowsByKey.delete(key);
        this.lastSecondByUniverseKey.delete(key);
      }
    });
  }

  private UpdateUniverseRow(rowView: UniverseRowView, status: SidePanelUniverseStatus): void {
    rowView.currentStatus = status;

    const tabIds = status.TabIds || [];
    const hasLocalTabs = tabIds.some((tabId) => this.localTabIds.has(tabId));
    const hasRemoteTabs = tabIds.some((tabId) => !this.localTabIds.has(tabId));

    let badgesHtml = '';

    if (hasLocalTabs && hasRemoteTabs) {
      badgesHtml += `<span class="universe-status-badge is-open activate-tab" aria-hidden="true">
          <span class="material-symbols-outlined icon-default">check_circle</span>
          <span class="material-symbols-outlined icon-hover">visibility</span>
        </span>`;
      badgesHtml += `
        <span class="universe-status-badge is-other-window close-tab" aria-hidden="true">
          <span class="material-symbols-outlined icon-default">tab</span>
          <span class="material-symbols-outlined icon-hover">close</span>
        </span>
      `;
    }
    else if (hasLocalTabs) {
      badgesHtml += `<span class="universe-status-badge is-open activate-tab" aria-hidden="true">
          <span class="material-symbols-outlined icon-default">check_circle</span>
          <span class="material-symbols-outlined icon-hover">visibility</span>
        </span>`;
    }
    else if (hasRemoteTabs) {
      badgesHtml += `
        <span class="universe-status-badge is-other-window move-tab" aria-hidden="true">
          <span class="material-symbols-outlined icon-default">tab</span>
          <span class="material-symbols-outlined icon-hover">input</span>
        </span>
      `;
    }
    else {
      badgesHtml += `<span class="universe-status-badge is-closed" aria-hidden="true"><span class="material-symbols-outlined">cancel</span></span>`;
    }

    const nextTitle = status.UniverseDisplayName ? `${status.UniverseDisplayName} (${status.UniverseKey})` : status.UniverseKey;
    if (rowView.title.textContent !== nextTitle) {
      rowView.title.textContent = nextTitle;
    }

    const isGlobalOpen = tabIds.length > 0;
    rowView.row.setAttribute('data-universe-open', String(isGlobalOpen));

    if (rowView.badgesContainer.innerHTML !== badgesHtml) {
      rowView.badgesContainer.innerHTML = badgesHtml;
    }

    const nextRefreshText = `${Localizator.Translate('SidePanelLastRefreshLabel')}: ${this.FormatLastRefreshWithState(status)}`;
    if (rowView.lastRefresh.textContent !== nextRefreshText) {
      rowView.lastRefresh.textContent = nextRefreshText;
    }

    const updateCounter = (el: HTMLElement, value: number) => {
      const strValue = String(value);
      if (el.textContent !== strValue) {
        el.setAttribute('ogm-value', strValue);
        el.textContent = strValue;
      }
    };

    updateCounter(rowView.unreadMessagesValue, status.SidePanelUniverseCounters.NewMessages);
    updateCounter(rowView.unreadChatMessagesValue, status.SidePanelUniverseCounters.NewChatMessages);
    updateCounter(rowView.hostileFleetCountValue, status.SidePanelUniverseCounters.HostileFleetCount);
    updateCounter(rowView.friendlyFleetCountValue, status.SidePanelUniverseCounters.FriendlyFleetCount);
    updateCounter(rowView.ownFleetCountValue, status.SidePanelUniverseCounters.OwnFleetCount);

    rowView.updateWarningState();
  }

  private FormatLastRefresh(lastRefreshAtIso: string | undefined): string {
    if (!lastRefreshAtIso) return Localizator.Translate('SidePanelNeverRefreshed');

    const parsed = Date.parse(lastRefreshAtIso);
    if (!Number.isFinite(parsed)) return Localizator.Translate('SidePanelNeverRefreshed');

    const elapsedSec = Math.max(0, Math.floor((Date.now() - parsed) / 1000));

    const seconds = elapsedSec % 60;
    const totalMinutes = Math.floor(elapsedSec / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    if (elapsedSec < 60) {
      return `${elapsedSec} ${Localizator.Translate('SidePanelSecondsShort')}`;
    }

    if (totalMinutes < 60) {
      return `${minutes} ${Localizator.Translate('SidePanelMinutesShort')} ${seconds} ${Localizator.Translate('SidePanelSecondsShort')}`;
    }

    if (hours < 24) {
      return `${hours} ${Localizator.Translate('SidePanelHoursShort')} ${minutes} ${Localizator.Translate('SidePanelMinutesShort')} ${seconds} ${Localizator.Translate('SidePanelSecondsShort')}`;
    }

    return `${Math.floor(hours / 24)} ${Localizator.Translate('SidePanelDaysShort')}`;
  }

  private FormatLastRefreshWithState(status: SidePanelUniverseStatus): string {
    const formattedLastRefresh = this.FormatLastRefresh(status.LastRefreshAtIso);
    if (status.IsOpen) return formattedLastRefresh;
    return `${formattedLastRefresh} (${Localizator.Translate('SidePanelUniverseInactiveShort')})`;
  }

  private ShouldShowRefreshWarning(status: SidePanelUniverseStatus, thresholdMinutes: number): boolean {
    if (thresholdMinutes <= 0) return false;
    if (!status.LastRefreshAtIso) return true;

    const lastRefreshAt = Date.parse(status.LastRefreshAtIso);
    if (!Number.isFinite(lastRefreshAt)) return true;

    return Date.now() - lastRefreshAt >= thresholdMinutes * 60_000;
  }

  private NormalizeUniverseKey(universeKey: string): string {
    return (universeKey || '').trim().toLowerCase();
  }

  private GetUniverseRowTemplate(universeKey: string): string {
    return `
      <div class="universe-item-box">
        <div class="universe-item">
          <div class="universe-details">
            <div class="universe-head">
              <div class="universe-status-badges" aria-hidden="true"></div>
              <div class="universe-title"></div>
            </div>
            <div class="universe-last-refresh"></div>
            <div class="universe-controls">
              <span class="universe-threshold-label">${Localizator.Translate('SidePanelRefreshWarningThresholdLabel')}:</span>
              <select class="universe-threshold-select" aria-label="${Localizator.Translate('SidePanelRefreshWarningThresholdLabel')}"></select>
            </div>
            <div class="universe-indicators">
              <span class="universe-value-group universe-value-group-hostile only-if-valued fleet-hostile-group">
                <span class="material-symbols-outlined" aria-hidden="true">rocket_launch</span>
                <span class="universe-value-label">${Localizator.Translate('SidePanelHostileFleetsLabel')}</span>
                <span class="universe-value fleet-hostile"></span>
              </span>
              <span class="universe-value-group universe-value-group-friendly only-if-valued">
                <span class="material-symbols-outlined" aria-hidden="true">rocket_launch</span>
                <span class="universe-value-label">${Localizator.Translate('SidePanelFriendlyFleetsLabel')}</span>
                <span class="universe-value fleet-friendly"></span>
              </span>
              <span class="universe-value-group universe-value-group-own only-if-valued">
                <span class="material-symbols-outlined" aria-hidden="true">rocket_launch</span>
                <span class="universe-value-label">${Localizator.Translate('SidePanelOwnFleetsLabel')}</span>
                <span class="universe-value fleet-own"></span>
              </span>
              <span class="universe-value-group universe-value-group-unread-mail only-if-valued">
                <span class="material-symbols-outlined" aria-hidden="true">mail</span>
                <span class="universe-value-label">${Localizator.Translate('SidePanelUnreadMessagesLabel')}</span>
                <span class="universe-value unread-mail"></span>
              </span>
              <span class="universe-value-group universe-value-group-unread-chat only-if-valued">
                <span class="material-symbols-outlined" aria-hidden="true">chat</span>
                <span class="universe-value-label">${Localizator.Translate('SidePanelUnreadChatLabel')}</span>
                <span class="universe-value unread-chat"></span>
              </span>
            </div>
          </div>
          <button type="button" class="universe-refresh-button" title="${Localizator.Translate('SidePanelReloadUniverseTab')}" aria-label="${Localizator.Translate('SidePanelReloadUniverseTab')}">
            <span class="material-symbols-outlined" aria-hidden="true">refresh</span>
          </button>
          <button type="button" class="universe-settings-button" title="${Localizator.Translate('SidePanelSettingsUniverse')}" aria-label="${Localizator.Translate('SidePanelSettingsUniverse')}">
            <span class="material-symbols-outlined" aria-hidden="true">settings</span>
          </button>
          <div class="universe-settings">
            <span class="universe-settings-header">${Localizator.Translate('SidePanelSettingsUniverse')}</span>
            <div class="universe-settings-group">
              <span class="universe-settings-group-header">${Localizator.Translate('SidePanelSettingsGroupIndicators')}:</span>
              <div class="universe-settings-group-content">
                <div class="universe-setting-item indicator-fleet-hostile-display-setting">
                  <label for="indicator-fleet-hostile-display-setting-checkbox-${universeKey}" class="setting-item-label">
                    <span class="material-symbols-outlined" aria-hidden="true">rocket_launch</span>
                    <span class="setting-item-label-text">${Localizator.Translate('SidePanelHostileFleetsLabel')}</span>
                  </label>
                  <input type="checkbox" id="indicator-fleet-hostile-display-setting-checkbox-${universeKey}" class="setting-item-checkbox"></input>
                </div>
                <div class="universe-setting-item indicator-fleet-friendly-display-setting">
                  <label for="indicator-fleet-friendly-display-setting-checkbox-${universeKey}" class="setting-item-label">
                    <span class="material-symbols-outlined" aria-hidden="true">rocket_launch</span>
                    <span class="setting-item-label-text">${Localizator.Translate('SidePanelFriendlyFleetsLabel')}</span>
                  </label>
                  <input type="checkbox" id="indicator-fleet-friendly-display-setting-checkbox-${universeKey}" class="setting-item-checkbox"></input>
                </div>
                <div class="universe-setting-item indicator-fleet-own-display-setting">
                  <label for="indicator-fleet-own-display-setting-checkbox-${universeKey}" class="setting-item-label">
                    <span class="material-symbols-outlined" aria-hidden="true">rocket_launch</span>
                    <span class="setting-item-label-text">${Localizator.Translate('SidePanelOwnFleetsLabel')}</span>
                  </label>
                  <input type="checkbox" id="indicator-fleet-own-display-setting-checkbox-${universeKey}" class="setting-item-checkbox"></input>
                </div>
                <div class="universe-setting-item indicator-unread-mail-display-setting">
                  <label for="indicator-unread-mail-display-setting-checkbox-${universeKey}" class="setting-item-label">
                    <span class="material-symbols-outlined" aria-hidden="true">mail</span>
                    <span class="setting-item-label-text">${Localizator.Translate('SidePanelUnreadMessagesLabel')}</span>
                  </label>
                  <input type="checkbox" id="indicator-unread-mail-display-setting-checkbox-${universeKey}" class="setting-item-checkbox"></input>
                </div>
                <div class="universe-setting-item indicator-unread-chat-display-setting">
                  <label for="indicator-unread-chat-display-setting-checkbox-${universeKey}" class="setting-item-label">
                    <span class="material-symbols-outlined" aria-hidden="true">chat</span>
                    <span class="setting-item-label-text">${Localizator.Translate('SidePanelUnreadChatLabel')}</span>
                  </label>
                  <input type="checkbox" id="indicator-unread-chat-display-setting-checkbox-${universeKey}" class="setting-item-checkbox"></input>
                </div>
              </div>
            </div>
            <button type="button" class="universe-remove-button" title="${Localizator.Translate('SidePanelRemoveUniverse')}" aria-label="${Localizator.Translate('SidePanelRemoveUniverse')}">
              <span class="material-symbols-outlined" aria-hidden="true">delete</span>
            </button>
          </div>
        </div>
      </div>
    `.trim();
  }
}