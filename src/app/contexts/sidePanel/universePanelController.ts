import { GlobalConstants } from '../../globalConstants';
import { Localizator } from '../../localization/localizator';
import { Logger } from '../../logging/logger';
import { serviceWorkerProtocolClient } from '../../messaging/serviceWorkerProtocol';
import { SidePanelUniverseStatus } from '../../model/sidePanel/sidePanelUniverseStatus';

interface UniverseRowView {
  row: HTMLElement;
  title: HTMLElement;
  openStateBadge: HTMLElement;
  lastRefresh: HTMLElement;
  unreadMessagesValue: HTMLElement;
  unreadChatMessagesValue: HTMLElement;
  hostileFleetGroup: HTMLElement;
  hostileFleetCountValue: HTMLElement;
  friendlyFleetCountValue: HTMLElement;
  ownFleetCountValue: HTMLElement;
  refreshButton: HTMLButtonElement;
  settingsButton: HTMLButtonElement;
  displayHostileFleetCheckboxSetting: HTMLInputElement;
  displayFriendlyFleetCheckboxSetting: HTMLInputElement;
  displayOwnFleetCheckboxSetting: HTMLInputElement;
  displayUnreadMailCheckboxSetting: HTMLInputElement;
  displayUnreadChatCheckboxSetting: HTMLInputElement;
  removeButton: HTMLButtonElement;
  updateWarningState: () => void;
  currentStatus: SidePanelUniverseStatus;
}

export class UniversePanelController {
  private readonly warningThresholdOptions = [5, 10, 15, 30, 45, -1];
  private readonly defaultWarningThresholdMinutes = 15;

  private loaded = false;
  private syncIntervalId: number | undefined;
  private syncSuspended: boolean = false;
  private syncIndicatorEl: HTMLElement | undefined;
  private readonly universeRowsByKey = new Map<string, UniverseRowView>();

  constructor(private readonly logger: Logger) { }

  public Activate(): void {
    if (!this.loaded) {
      this.loaded = true;
      void this.RefreshAsync();
    }
    this.StartSync();
  }

  public Deactivate(): void {
    this.StopSync();
  }

  public StopSync(): void {
    if (this.syncIntervalId === undefined) return;
    window.clearInterval(this.syncIntervalId);
    this.syncIntervalId = undefined;
  }

  public async RefreshAsync(): Promise<void> {
    const container = document.getElementById('universe-list');
    if (!container) return;

    const universeStatuses = await serviceWorkerProtocolClient.GetUniversesStatusesAsync(this.logger);
    if (!universeStatuses.length) {
      container.replaceChildren();
      this.universeRowsByKey.clear();

      const empty = document.createElement('div');
      empty.className = 'universe-empty';
      empty.textContent = Localizator.Translate('SidePanelNoUniverses');
      container.appendChild(empty);
      return;
    }

    this.SyncUniverseRows(container, universeStatuses);
  }

  private StartSync(): void {
    if (this.syncIntervalId !== undefined) return;

    this.syncIntervalId = window.setInterval(() => {
      void this.SyncTickAsync();
    }, 1000);
  }

  private async SyncTickAsync(): Promise<void> {
    this.RefreshRenderedRowsOnly();
    const hasActive = await this.HasActiveSyncableTabAsync();
    if (!hasActive) {
      if (!this.syncSuspended) {
        this.syncSuspended = true;
        this.SetSyncPausedIndicator(true);
      }

      await this.RefreshAsync();
      return;
    }

    if (this.syncSuspended) {
      this.syncSuspended = false;
      this.SetSyncPausedIndicator(false);
    }

    await this.RefreshAsync();
  }

  private RefreshRenderedRowsOnly(): void {
    this.universeRowsByKey.forEach((rowView) => {
      rowView.lastRefresh.textContent = `${Localizator.Translate('SidePanelLastRefreshLabel')}: ${this.FormatLastRefreshWithState(rowView.currentStatus)}`;
      rowView.updateWarningState();
    });
  }

  private async HasActiveSyncableTabAsync(): Promise<boolean> {
    const chromeApi = (globalThis as { chrome?: any }).chrome;
    if (!chromeApi?.tabs?.query) return true;

    try {
      const activeCurrentWindowTabs = await chromeApi.tabs.query({ active: true, currentWindow: true });
      if (activeCurrentWindowTabs.some((tab: any) => this.IsKeepSyncTab(tab))) return true;

      const activeLastFocusedWindowTabs = await chromeApi.tabs.query({ active: true, lastFocusedWindow: true });
      if (activeLastFocusedWindowTabs.some((tab: any) => this.IsKeepSyncTab(tab))) return true;

      const allActiveTabs = await chromeApi.tabs.query({ active: true });
      return allActiveTabs.some((tab: any) => this.IsKeepSyncTab(tab));
    } catch {
      return true;
    }
  }

  private IsKeepSyncTab(tab: any): boolean {
    if (GlobalConstants.SYNC_TABS_URLS_REGEXPS.length > 0) {
      const url = typeof tab?.url === 'string' ? tab.url : typeof tab?.pendingUrl === 'string' ? tab.pendingUrl : '';
      return GlobalConstants.SYNC_TABS_URLS_REGEXPS.some((regexp) => regexp.test(url));
    }
    return true;
  }

  private SetSyncPausedIndicator(paused: boolean): void {
    try {
      const container = document.getElementById('universe-list');
      if (!container) return;

      const parent = container.parentElement || container;
      if (paused) {
        if (this.syncIndicatorEl) return;
        const el = document.createElement('div');
        el.id = 'universe-sync-paused';
        el.className = 'universe-sync-paused';

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = 'warning';

        const textEl = document.createElement('span');
        let text = 'Sync paused — no active OGame tab.';
        try {
          text = Localizator.Translate('SidePanelSyncPaused') || text;
        } catch { }
        textEl.textContent = text;

        el.appendChild(icon);
        el.appendChild(textEl);

        parent.insertBefore(el, container);
        this.syncIndicatorEl = el;
      } else {
        if (!this.syncIndicatorEl) return;
        this.syncIndicatorEl.remove();
        this.syncIndicatorEl = undefined;
      }
    } catch (error) {
      // ignore UI update errors
    }
  }

  private GetUniverseRowTemplate(universeKey: string): string {
    return `
      <div class="universe-item-box">
        <div class="universe-item">
          <div class="universe-details">
            <div class="universe-head">
              <span class="universe-status-badge" aria-hidden="true">
                <span class="material-symbols-outlined"></span>
              </span>
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
                  <input type="checkbox" id="indicator-fleet-hostile-display-setting-checkbox-${universeKey}" class="setting-item-checkbox"></checkbox>
                </div>
                <div class="universe-setting-item indicator-fleet-friendly-display-setting">
                  <label for="indicator-fleet-friendly-display-setting-checkbox-${universeKey}" class="setting-item-label">
                    <span class="material-symbols-outlined" aria-hidden="true">rocket_launch</span>
                    <span class="setting-item-label-text">${Localizator.Translate('SidePanelFriendlyFleetsLabel')}</span>
                  </label>
                  <input type="checkbox" id="indicator-fleet-friendly-display-setting-checkbox-${universeKey}" class="setting-item-checkbox"></checkbox>
                </div>
                <div class="universe-setting-item indicator-fleet-own-display-setting">
                  <label for="indicator-fleet-own-display-setting-checkbox-${universeKey}" class="setting-item-label">
                    <span class="material-symbols-outlined" aria-hidden="true">rocket_launch</span>
                    <span class="setting-item-label-text">${Localizator.Translate('SidePanelOwnFleetsLabel')}</span>
                  </label>
                  <input type="checkbox" id="indicator-fleet-own-display-setting-checkbox-${universeKey}" class="setting-item-checkbox"></checkbox>
                </div>
                <div class="universe-setting-item indicator-unread-mail-display-setting">
                  <label for="indicator-unread-mail-display-setting-checkbox-${universeKey}" class="setting-item-label">
                    <span class="material-symbols-outlined" aria-hidden="true">mail</span>
                    <span class="setting-item-label-text">${Localizator.Translate('SidePanelUnreadMessagesLabel')}</span>
                  </label>
                  <input type="checkbox" id="indicator-unread-mail-display-setting-checkbox-${universeKey}" class="setting-item-checkbox"></checkbox>
                </div>
                <div class="universe-setting-item indicator-unread-chat-display-setting">
                  <label for="indicator-unread-chat-display-setting-checkbox-${universeKey}" class="setting-item-label">
                    <span class="material-symbols-outlined" aria-hidden="true">chat</span>
                    <span class="setting-item-label-text">${Localizator.Translate('SidePanelUnreadChatLabel')}</span>
                  </label>
                  <input type="checkbox" id="indicator-unread-chat-display-setting-checkbox-${universeKey}" class="setting-item-checkbox"></checkbox>
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

  private BuildUniverseRow(status: SidePanelUniverseStatus): UniverseRowView {
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = this.GetUniverseRowTemplate(status.UniverseKey);
    const row = tempContainer.firstElementChild as HTMLElement;

    const thresholdSelect = row.querySelector('.universe-threshold-select') as HTMLSelectElement;
    const refreshButton = row.querySelector('.universe-refresh-button') as HTMLButtonElement;
    const settingsButton = row.querySelector('.universe-settings-button') as HTMLButtonElement;
    const removeButton = row.querySelector('.universe-remove-button') as HTMLButtonElement;
    const lastRefresh = row.querySelector('.universe-last-refresh') as HTMLElement;

    const updateWarningState = (thresholdMinutes: number): void => {
      const shouldWarn = this.ShouldShowRefreshWarning(rowView.currentStatus, thresholdMinutes);
      if (shouldWarn) {
        refreshButton.classList.add('universe-refresh-warning');
        lastRefresh.classList.add('universe-last-refresh-warning');
      } else {
        refreshButton.classList.remove('universe-refresh-warning');
        lastRefresh.classList.remove('universe-last-refresh-warning');
      }
    };

    const displayHostileFleetCheckboxSetting = row.querySelector(`#indicator-fleet-hostile-display-setting-checkbox-${status.UniverseKey}`) as HTMLInputElement;
    const displayFriendlyFleetCheckboxSetting = row.querySelector(`#indicator-fleet-friendly-display-setting-checkbox-${status.UniverseKey}`) as HTMLInputElement;
    const displayOwnFleetCheckboxSetting = row.querySelector(`#indicator-fleet-own-display-setting-checkbox-${status.UniverseKey}`) as HTMLInputElement;
    const displayUnreadMailCheckboxSetting = row.querySelector(`#indicator-unread-mail-display-setting-checkbox-${status.UniverseKey}`) as HTMLInputElement;
    const displayUnreadChatCheckboxSetting = row.querySelector(`#indicator-unread-chat-display-setting-checkbox-${status.UniverseKey}`) as HTMLInputElement;

    const rowView: UniverseRowView = {
      row,
      title: row.querySelector('.universe-title')!,
      openStateBadge: row.querySelector('.universe-status-badge')!,
      lastRefresh,
      unreadMessagesValue: row.querySelector('.unread-mail')!,
      unreadChatMessagesValue: row.querySelector('.unread-chat')!,
      hostileFleetGroup: row.querySelector('.fleet-hostile-group')!,
      hostileFleetCountValue: row.querySelector('.fleet-hostile')!,
      friendlyFleetCountValue: row.querySelector('.fleet-friendly')!,
      ownFleetCountValue: row.querySelector('.fleet-own')!,
      refreshButton,
      settingsButton,
      displayHostileFleetCheckboxSetting,
      displayFriendlyFleetCheckboxSetting,
      displayOwnFleetCheckboxSetting,
      displayUnreadMailCheckboxSetting,
      displayUnreadChatCheckboxSetting,
      removeButton,
      currentStatus: status,
      updateWarningState: () => {
        const thresholdMinutes = status.SidePanelOptions.WarningThresholdMinutes ?? this.defaultWarningThresholdMinutes;
        updateWarningState(thresholdMinutes);
      },
    };

    // Remplissage du select des seuils
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

      const options = await serviceWorkerProtocolClient.GetUniverseSidePanelOptionsAsync(this.logger, status.UniverseKey);
      options.WarningThresholdMinutes = selectedMinutes;
      await serviceWorkerProtocolClient.SaveUniverseSidePanelOptionsAsync(this.logger, status.UniverseKey, options);
      
      updateWarningState(selectedMinutes);
    });

    refreshButton.addEventListener('click', async () => {
      if (refreshButton.disabled) return;
      refreshButton.disabled = true;


      try {
        await serviceWorkerProtocolClient.ReloadUniverseTabAsync(this.logger, status.UniverseKey);
      } finally {
        try {
          await this.RefreshAsync();
        } finally {
          refreshButton.disabled = false;
        }
      }
    });

    removeButton.addEventListener('click', async () => {
      if (removeButton.disabled) return;
      removeButton.disabled = true;

      try {
        await serviceWorkerProtocolClient.RemoveUniverseAsync(this.logger, status.UniverseKey);
      } finally {
        try {
          await this.RefreshAsync();
        } finally {
          removeButton.disabled = false;
        }
      }

    });

    const updateBooleanRowAttribute = (attributeName: string, value: boolean) => {
      if (value) row.setAttribute(attributeName, 'true');
      else row.setAttribute(attributeName, 'false');
    }


    settingsButton.addEventListener('click', () => {
      if (settingsButton.attributes.getNamedItem('data-universe-settings-active')?.value === 'true') {
        settingsButton.setAttribute('data-universe-settings-active', 'false');
      }
      else settingsButton.setAttribute('data-universe-settings-active', 'true');
    });

    displayHostileFleetCheckboxSetting.checked = status.SidePanelOptions.ShowHostileFleetIndicator;
    updateBooleanRowAttribute('show-hostile-fleets-indicator', displayHostileFleetCheckboxSetting.checked);
    displayHostileFleetCheckboxSetting.addEventListener('change', async () => {
      const checked = displayHostileFleetCheckboxSetting.checked;

      const options = await serviceWorkerProtocolClient.GetUniverseSidePanelOptionsAsync(this.logger, status.UniverseKey);
      options.ShowHostileFleetIndicator = checked;
      await serviceWorkerProtocolClient.SaveUniverseSidePanelOptionsAsync(this.logger, status.UniverseKey, options);

      updateBooleanRowAttribute('show-hostile-fleets-indicator', checked);
    });

    displayFriendlyFleetCheckboxSetting.checked = status.SidePanelOptions.ShowFriendlyFleetIndicator;
    updateBooleanRowAttribute('show-friendly-fleets-indicator', displayFriendlyFleetCheckboxSetting.checked);
    displayFriendlyFleetCheckboxSetting.addEventListener('change', async () => {
      const checked = displayFriendlyFleetCheckboxSetting.checked;

      const options = await serviceWorkerProtocolClient.GetUniverseSidePanelOptionsAsync(this.logger, status.UniverseKey);
      options.ShowFriendlyFleetIndicator = checked;
      await serviceWorkerProtocolClient.SaveUniverseSidePanelOptionsAsync(this.logger, status.UniverseKey, options);

      updateBooleanRowAttribute('show-friendly-fleets-indicator', checked);
    });

    displayOwnFleetCheckboxSetting.checked = status.SidePanelOptions.ShowOwnFleetIndicator;
    updateBooleanRowAttribute('show-own-fleets-indicator', displayOwnFleetCheckboxSetting.checked);
    displayOwnFleetCheckboxSetting.addEventListener('change', async () => {
      const checked = displayOwnFleetCheckboxSetting.checked;

      const options = await serviceWorkerProtocolClient.GetUniverseSidePanelOptionsAsync(this.logger, status.UniverseKey);
      options.ShowOwnFleetIndicator = checked;
      await serviceWorkerProtocolClient.SaveUniverseSidePanelOptionsAsync(this.logger, status.UniverseKey, options);

      updateBooleanRowAttribute('show-own-fleets-indicator', checked);
    });

    displayUnreadMailCheckboxSetting.checked = status.SidePanelOptions.ShowUnreadMessagesIndicator;
    updateBooleanRowAttribute('show-unread-mail-indicator', displayUnreadMailCheckboxSetting.checked);
    displayUnreadMailCheckboxSetting.addEventListener('change', async () => {
      const checked = displayUnreadMailCheckboxSetting.checked;

      const options = await serviceWorkerProtocolClient.GetUniverseSidePanelOptionsAsync(this.logger, status.UniverseKey);
      options.ShowUnreadMessagesIndicator = checked;
      await serviceWorkerProtocolClient.SaveUniverseSidePanelOptionsAsync(this.logger, status.UniverseKey, options);

      updateBooleanRowAttribute('show-unread-mail-indicator', checked);
    });

    displayUnreadChatCheckboxSetting.checked = status.SidePanelOptions.ShowUnreadChatMessagesIndicator;
    updateBooleanRowAttribute('show-unread-chat-indicator', displayUnreadChatCheckboxSetting.checked);
    displayUnreadChatCheckboxSetting.addEventListener('change', async () => {
      const checked = displayUnreadChatCheckboxSetting.checked;

      const options = await serviceWorkerProtocolClient.GetUniverseSidePanelOptionsAsync(this.logger, status.UniverseKey);
      options.ShowUnreadChatMessagesIndicator = checked;
      await serviceWorkerProtocolClient.SaveUniverseSidePanelOptionsAsync(this.logger, status.UniverseKey, options);

      updateBooleanRowAttribute('show-unread-chat-indicator', checked);
    });


    this.UpdateUniverseRow(rowView, status);
    return rowView;
  }

  private SyncUniverseRows(container: HTMLElement, universeStatuses: SidePanelUniverseStatus[]): void {
    container.querySelector('.universe-empty')?.remove();


    const nextUniverseKeys = new Set<string>();

    //order by universeKey ascending
    universeStatuses/*.sort((a, b) => a.UniverseKey.localeCompare(b.UniverseKey))*/.forEach((status) => {
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

    Array.from(this.universeRowsByKey.keys()).forEach((universeKey) => {
      if (!nextUniverseKeys.has(universeKey)) {
        this.universeRowsByKey.get(universeKey)?.row.remove();
        this.universeRowsByKey.delete(universeKey);
      }
    });
  }

  private UpdateUniverseRow(rowView: UniverseRowView, status: SidePanelUniverseStatus): void {
    rowView.currentStatus = status;

    const nextTitle = status.UniverseDisplayName ? `${status.UniverseDisplayName} (${status.UniverseKey})` : status.UniverseKey;
    if (rowView.title.textContent !== nextTitle) {
      rowView.title.textContent = nextTitle;
    }

    if (status.IsOpen) rowView.row.setAttribute('data-universe-open', 'true');
    else rowView.row.setAttribute('data-universe-open', 'false');

    const nextBadgeClass = `universe-status-badge ${status.IsOpen ? 'is-open' : 'is-closed'}`;
    if (rowView.openStateBadge.className !== nextBadgeClass) {
      rowView.openStateBadge.className = nextBadgeClass;
    }

    const nextIcon = status.IsOpen ? 'check_circle' : 'cancel';
    const currentIconSpan = rowView.openStateBadge.querySelector('.material-symbols-outlined');
    if (!currentIconSpan) {
      rowView.openStateBadge.innerHTML = `<span class="material-symbols-outlined">${nextIcon}</span>`;
    } else if (currentIconSpan.textContent !== nextIcon) {
      currentIconSpan.textContent = nextIcon;
    }

    const nextRefreshText = `${Localizator.Translate('SidePanelLastRefreshLabel')}: ${this.FormatLastRefreshWithState(status)}`;
    if (rowView.lastRefresh.textContent !== nextRefreshText) {
      rowView.lastRefresh.textContent = nextRefreshText;
    }

    // Helper function to update the text content of a counter element
    const updateCounter = (el: HTMLElement, value: number) => {
      const strValue = String(value);
      if (el.textContent !== strValue) {
        //add new attribute for screen readers
        el.setAttribute('ogm-value', `${value}`);
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

    const elapsedMs = Date.now() - parsed;
    const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
    if (elapsedSec < 60) return `${elapsedSec} ${Localizator.Translate('SidePanelSecondsShort')}`;

    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) return `${elapsedMin} ${Localizator.Translate('SidePanelMinutesShort')}`;

    const elapsedHours = Math.floor(elapsedMin / 60);
    if (elapsedHours < 24) {
      const remainingMinutes = elapsedMin % 60;
      return `${elapsedHours} ${Localizator.Translate('SidePanelHoursShort')} ${remainingMinutes} ${Localizator.Translate('SidePanelMinutesShort')}`;
    }

    const elapsedDays = Math.floor(elapsedHours / 24);
    return `${elapsedDays} ${Localizator.Translate('SidePanelDaysShort')}`;
  }

  private FormatLastRefreshWithState(status: SidePanelUniverseStatus): string {
    const formattedLastRefresh = this.FormatLastRefresh(status.LastRefreshAtIso);
    if (status.IsOpen) return formattedLastRefresh;
    return `${formattedLastRefresh} (${Localizator.Translate('SidePanelUniverseInactiveShort')})`;
  }

  private FormatOpenState(status: SidePanelUniverseStatus): string {
    if (!status.IsOpen) return Localizator.Translate('SidePanelUniverseTabClosed');
    if (status.OpenTabsCount <= 1) return Localizator.Translate('SidePanelUniverseTabOpen');
    return `${Localizator.Translate('SidePanelUniverseTabOpen')} (${status.OpenTabsCount})`;
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
}