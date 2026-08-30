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
  labelKey: string;
  icon: string;
  containerClass: string;
}

const INDICATOR_BINDINGS: IndicatorBinding[] = [
  { checkboxIdSuffix: 'indicator-fleet-hostile-display-setting-checkbox', attributeName: 'show-hostile-fleets-indicator', optionKey: 'ShowHostileFleetIndicator', labelKey: 'SidePanelHostileFleetsLabel', icon: 'rocket_launch', containerClass: 'indicator-fleet-hostile-display-setting' },
  { checkboxIdSuffix: 'indicator-fleet-friendly-display-setting-checkbox', attributeName: 'show-friendly-fleets-indicator', optionKey: 'ShowFriendlyFleetIndicator', labelKey: 'SidePanelFriendlyFleetsLabel', icon: 'rocket_launch', containerClass: 'indicator-fleet-friendly-display-setting' },
  { checkboxIdSuffix: 'indicator-fleet-own-display-setting-checkbox', attributeName: 'show-own-fleets-indicator', optionKey: 'ShowOwnFleetIndicator', labelKey: 'SidePanelOwnFleetsLabel', icon: 'rocket_launch', containerClass: 'indicator-fleet-own-display-setting' },
  { checkboxIdSuffix: 'indicator-unread-mail-display-setting-checkbox', attributeName: 'show-unread-mail-indicator', optionKey: 'ShowUnreadMessagesIndicator', labelKey: 'SidePanelUnreadMessagesLabel', icon: 'mail', containerClass: 'indicator-unread-mail-display-setting' },
  { checkboxIdSuffix: 'indicator-unread-chat-display-setting-checkbox', attributeName: 'show-unread-chat-indicator', optionKey: 'ShowUnreadChatMessagesIndicator', labelKey: 'SidePanelUnreadChatLabel', icon: 'chat', containerClass: 'indicator-unread-chat-display-setting' },
];

export class UniversePanelController {
  private readonly warningThresholdOptions = [5, 10, 15, 30, 45, -1];
  private readonly defaultWarningThresholdMinutes = 15;

  private loaded = false;
  private readonly universeRowsByKey = new Map<string, UniverseRowView>();

  private rafId?: number;
  private readonly lastSecondByUniverseKey = new Map<string, number>();
  private lastSyncCheckTime = 0;

  private currentWindowId?: number;
  private readonly localTabIds = new Set<number>();
  private readonly activeLocalTabIds = new Set<number>();

  private containerDnDListenersAttached = false;
  private resizeObserver?: ResizeObserver;

  private readonly onTabChanged = () => { void this.Refresh(); };

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

    sidePanelBroadcastProtocolRegistrar.OnUpdateUniverseOrder(this.logger, (data: { order: string[] }) => {
      this.ApplyUniverseOrder(data?.order || []);
    });

    sidePanelBroadcastProtocolRegistrar.OnUpdateUniverseGrid(this.logger, () => {
      this.Refresh();
    });
  }

  public async ActivateAsync(): Promise<void> {
    if (!this.loaded) {
      this.loaded = true;
      await this.InitCurrentWindowIdAsync();
      this.InitResizeObserver();
      this.Refresh();
    }
    this.StartAnimationLoop();

    const chromeApi = (globalThis as { chrome?: any }).chrome;
    if (chromeApi?.tabs) {
      chromeApi.tabs.onActivated?.addListener(this.onTabChanged);
      chromeApi.tabs.onUpdated?.addListener(this.onTabChanged);
      chromeApi.tabs.onRemoved?.addListener(this.onTabChanged);
    }
  }

  public Deactivate(): void {
    this.resizeObserver?.disconnect();

    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }

    const chromeApi = (globalThis as { chrome?: any }).chrome;
    if (chromeApi?.tabs) {
      chromeApi.tabs.onActivated?.removeListener(this.onTabChanged);
      chromeApi.tabs.onUpdated?.removeListener(this.onTabChanged);
      chromeApi.tabs.onRemoved?.removeListener(this.onTabChanged);
    }
  }

  private DetectUniverseDisplayMode(): 'list' | 'grid' {
    const parent = document.getElementById('panel-universe');
    const width = parent ? parent.clientWidth : window.innerWidth;
    return width >= 650 ? 'grid' : 'list';
  }

  private InitResizeObserver(): void {
    const container = document.getElementById('universe-list');
    if (!container) return;

    let currentMode: 'list' | 'grid' | null = null;

    this.resizeObserver = new ResizeObserver(() => {
      const newMode = this.DetectUniverseDisplayMode();
      container.setAttribute('data-mode', newMode);

      if (newMode !== currentMode) {
        currentMode = newMode;
        this.Refresh();
      }
    });

    const parent = document.getElementById('panel-universe') || container;
    this.resizeObserver.observe(parent);
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
        this.activeLocalTabIds.clear();
        tabs.forEach((tab: any) => {
          if (typeof tab.id === 'number') {
            this.localTabIds.add(tab.id);
            if (tab.active) {
              this.activeLocalTabIds.add(tab.id);
            }
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

      await this.UpdateLocalTabIdsAsync();

      const mode = this.DetectUniverseDisplayMode();
      container.setAttribute('data-mode', mode);

      const rawStatuses = await serviceWorkerProtocolClient.GetUniversesStatusesAsync(this.logger, mode);

      if (!rawStatuses || (Array.isArray(rawStatuses) && rawStatuses.length === 0)) {
        container.replaceChildren();
        this.universeRowsByKey.clear();
        this.lastSecondByUniverseKey.clear();

        const empty = document.createElement('div');
        empty.className = 'universe-empty';
        empty.textContent = Localizator.Translate('SidePanelNoUniverses');
        container.appendChild(empty);
        return;
      }

      const is2DGrid = Array.isArray(rawStatuses[0]);

      let activeGrid: SidePanelUniverseStatus[][];
      if (mode === 'grid' && is2DGrid) {
        activeGrid = (rawStatuses as SidePanelUniverseStatus[][]).filter(
          (col) => col && col.length > 0
        );
      } else {
        const flatStatuses: SidePanelUniverseStatus[] = is2DGrid
          ? (rawStatuses as unknown as SidePanelUniverseStatus[][]).flat()
          : (rawStatuses as unknown as SidePanelUniverseStatus[]);
        activeGrid = [flatStatuses];
      }

      this.SyncUniverseGrid(container, activeGrid);
    }, 100, false);
  }

  private SyncUniverseGrid(container: HTMLElement, activeGrid: SidePanelUniverseStatus[][]): void {
    container.querySelector('.universe-empty')?.remove();
    this.EnsureContainerDnDListeners(container);

    const nextUniverseKeys = new Set<string>();

    const existingCols = Array.from(container.querySelectorAll<HTMLElement>('.universe-column'));
    while (existingCols.length > activeGrid.length) {
      existingCols.pop()?.remove();
    }
    while (existingCols.length < activeGrid.length) {
      const colEl = document.createElement('div');
      colEl.className = 'universe-column';
      container.appendChild(colEl);
      existingCols.push(colEl);
    }

    activeGrid.forEach((colStatuses, colIdx) => {
      const colEl = existingCols[colIdx];

      colStatuses.forEach((status) => {
        const universeKey = this.NormalizeUniverseKey(status.UniverseKey);
        nextUniverseKeys.add(universeKey);

        let rowView = this.universeRowsByKey.get(universeKey);
        if (rowView) {
          this.UpdateUniverseRow(rowView, status);
        } else {
          rowView = this.BuildUniverseRow(status);
          this.universeRowsByKey.set(universeKey, rowView);
        }

        colEl.appendChild(rowView.row);
      });
    });

    this.universeRowsByKey.forEach((rowView, key) => {
      if (!nextUniverseKeys.has(key)) {
        rowView.row.remove();
        this.universeRowsByKey.delete(key);
        this.lastSecondByUniverseKey.delete(key);
      }
    });
  }

  private UpdateUniverseOpenState(universeKey: string, isOpen: boolean): void {
    const key = this.NormalizeUniverseKey(universeKey);
    const existingRow = this.universeRowsByKey.get(key);

    if (existingRow) {
      existingRow.currentStatus.IsOpen = isOpen;
      this.UpdateUniverseRow(existingRow, existingRow.currentStatus);
    }
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
    existingRow.updateWarningState();

    INDICATOR_BINDINGS.forEach(({ checkboxIdSuffix, attributeName, optionKey }) => {
      const checkbox = existingRow.row.querySelector(`#${checkboxIdSuffix}-${existingRow.currentStatus.UniverseKey}`) as HTMLInputElement;
      const value = Boolean(options[optionKey]);
      if (checkbox) {
        checkbox.checked = value;
      }
      existingRow.row.setAttribute(attributeName, String(value));
    });
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

        const nextRefreshText = `${Localizator.Translate('SidePanelLastRefreshLabel')}: ${this.FormatLastRefresh(status.LastRefreshAtIso) }`;
        if (rowView.lastRefresh.textContent !== nextRefreshText) {
          rowView.lastRefresh.textContent = nextRefreshText;
        }
        rowView.updateWarningState();
      }
    });
  }

  private BuildUniverseRow(status: SidePanelUniverseStatus): UniverseRowView {
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = this.GetUniverseRowTemplate(status.UniverseKey);
    const row = tempContainer.firstElementChild as HTMLElement;

    row.setAttribute('data-universe-key', status.UniverseKey);
    row.setAttribute('draggable', 'false');

    const dragHandle = row.querySelector('.universe-drag-handle') as HTMLElement | null;
    if (dragHandle) {
      dragHandle.addEventListener('mouseenter', () => row.setAttribute('draggable', 'true'));
      dragHandle.addEventListener('mouseleave', () => {
        if (!row.classList.contains('dragging')) {
          row.setAttribute('draggable', 'false');
        }
      });
    }

    row.addEventListener('dragstart', (event) => {
      if (!event.dataTransfer) return;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', status.UniverseKey);
      event.dataTransfer.setData('text/x-ogame-item', status.UniverseKey);
      row.classList.add('dragging');
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      row.setAttribute('draggable', 'false');
      this.ClearDropIndicators();
    });

    const thresholdSelect = row.querySelector('.universe-threshold-select') as HTMLSelectElement;
    const refreshButton = row.querySelector('.universe-refresh-button') as HTMLButtonElement;
    const settingsButton = row.querySelector('.universe-settings-button') as HTMLButtonElement;
    const removeButton = row.querySelector('.universe-remove-button') as HTMLButtonElement;
    const lastRefresh = row.querySelector('.universe-last-refresh') as HTMLElement;
    const badgesContainer = row.querySelector('.universe-status-badges') as HTMLElement;

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
      rowView.currentStatus.SidePanelOptions.WarningThresholdMinutes = selectedMinutes;
      await this.SaveOption(rowView.currentStatus.UniverseKey, 'WarningThresholdMinutes', selectedMinutes);
      updateWarningState(selectedMinutes);
    });

    refreshButton.addEventListener('click', () =>
      this.HandleTabIconClickAsync(rowView.currentStatus, refreshButton)
    );
    removeButton.addEventListener('click', () => this.ExecuteRowAction(removeButton, () => serviceWorkerProtocolClient.RemoveUniverseAsync(this.logger, rowView.currentStatus.UniverseKey)));

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
        await this.SaveOption(rowView.currentStatus.UniverseKey, optionKey, checked);
      });
    });

    this.UpdateUniverseRow(rowView, status);
    return rowView;
  }

  private async HandleTabIconClickAsync(status: SidePanelUniverseStatus, badge: HTMLElement): Promise<void> {
    if (badge.classList.contains('activate-tab')) {
      await serviceWorkerProtocolClient.ActionOnUniverseTabAsync(this.logger,
        status.UniverseKey,
        'activate',
        this.currentWindowId
      );
    } else if (badge.classList.contains('close-tab')) {
      await serviceWorkerProtocolClient.ActionOnUniverseTabAsync(this.logger,
        status.UniverseKey,
        'close',
        this.currentWindowId
      );
      this.Refresh();
    } else if (badge.classList.contains('move-tab')) {
      await serviceWorkerProtocolClient.ActionOnUniverseTabAsync(this.logger,
        status.UniverseKey,
        'move',
        this.currentWindowId
      );
      this.Refresh();
    } else if (badge.classList.contains('refresh-tab')) {
      await serviceWorkerProtocolClient.ActionOnUniverseTabAsync(this.logger,
        status.UniverseKey,
        'refresh',
        this.currentWindowId
      );
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

  private UpdateUniverseRow(rowView: UniverseRowView, status: SidePanelUniverseStatus): void {
    rowView.currentStatus = status;

    const tabIds = status.TabIds || [];
    const hasLocalTabs = tabIds.some((tabId) => this.localTabIds.has(tabId));
    const hasRemoteTabs = tabIds.some((tabId) => !this.localTabIds.has(tabId));

    const isGlobalOpen = tabIds.length > 0;
    const isOpenInCurrentWindow = isGlobalOpen && hasLocalTabs;
    const isOpenInOtherWindow = isGlobalOpen && hasRemoteTabs;
    const isActiveInCurrentWindow = tabIds.some((tabId) => this.activeLocalTabIds.has(tabId));

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

    const badgesHtml = badges.join('');

    const nextTitle = status.UniverseDisplayName ? `${status.UniverseDisplayName} (${status.UniverseKey})` : status.UniverseKey;
    if (rowView.title.textContent !== nextTitle) {
      rowView.title.textContent = nextTitle;
    }

    rowView.row.setAttribute('data-universe-open', String(isGlobalOpen));
    rowView.row.setAttribute('data-universe-open-current-window', String(isOpenInCurrentWindow));
    rowView.row.setAttribute('data-universe-open-other-window', String(isOpenInOtherWindow));
    rowView.row.setAttribute('data-universe-active-current-window', String(isActiveInCurrentWindow));

    if (rowView.badgesContainer.innerHTML !== badgesHtml) {
      rowView.badgesContainer.innerHTML = badgesHtml;
    }

    const nextRefreshText = `${Localizator.Translate('SidePanelLastRefreshLabel')}: ${this.FormatLastRefresh(status.LastRefreshAtIso) }`;
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

  private EnsureContainerDnDListeners(container: HTMLElement): void {
    if (this.containerDnDListenersAttached) return;
    this.containerDnDListenersAttached = true;

    let indicator = container.querySelector('.drop-indicator-line') as HTMLElement | null;
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'drop-indicator-line';
      container.appendChild(indicator);
    }

    interface DropTargetState {
      type: 'new-col-first' | 'new-col-last' | 'inside';
      targetKey?: string;
      isBefore?: boolean;
    }

    let draggingItem: HTMLElement | null = null;
    let draggedKey: string | null = null;
    let dropTargetState: DropTargetState | null = null;

    const hideIndicator = () => {
      if (indicator) indicator.style.display = 'none';
    };

    const applyReorder = () => {
      const mode = container.getAttribute('data-mode') || 'list';
      const keyToMove = draggedKey || draggingItem?.getAttribute('data-universe-key');

      if (keyToMove && dropTargetState) {
        if (mode === 'grid') {
          let currentGrid = this.ExtractUniverseGridFromDOM(container);

          if (dropTargetState.type === 'new-col-first') {
            currentGrid.unshift([keyToMove]);
          } else if (dropTargetState.type === 'new-col-last') {
            currentGrid.push([keyToMove]);
          } else if (dropTargetState.type === 'inside' && dropTargetState.targetKey) {
            const targetKey = dropTargetState.targetKey;
            const isBefore = dropTargetState.isBefore;

            let inserted = false;
            for (let c = 0; c < currentGrid.length; c++) {
              const idx = currentGrid[c].indexOf(targetKey);
              if (idx !== -1) {
                const insertIdx = isBefore ? idx : idx + 1;
                currentGrid[c].splice(insertIdx, 0, keyToMove);
                inserted = true;
                break;
              }
            }

            if (!inserted) {
              if (currentGrid.length === 0) {
                currentGrid = [[keyToMove]];
              } else {
                currentGrid[currentGrid.length - 1].push(keyToMove);
              }
            }
          }

          currentGrid = currentGrid.filter((col) => col.length > 0);
          void this.PersistUniverseGridAsync(currentGrid);
        } else {
          if (dropTargetState.targetKey) {
            const items = Array.from(container.querySelectorAll<HTMLElement>('.universe-item-box'));
            let newOrder = items.map((el) => el.getAttribute('data-universe-key') || '').filter(Boolean);
            newOrder = newOrder.filter((k) => k !== keyToMove);

            const targetIdx = newOrder.indexOf(dropTargetState.targetKey);
            if (targetIdx !== -1) {
              const insertIdx = dropTargetState.isBefore ? targetIdx : targetIdx + 1;
              newOrder.splice(insertIdx, 0, keyToMove);
            } else {
              newOrder.push(keyToMove);
            }
            void this.PersistUniverseOrderAsync(newOrder);
          }
        }
      }

      hideIndicator();
      draggingItem = null;
      draggedKey = null;
      dropTargetState = null;
    };

    container.addEventListener('dragstart', (event) => {
      const target = (event.target as HTMLElement | null)?.closest('.universe-item-box') as HTMLElement | null;
      if (target) {
        draggingItem = target;
        draggedKey = target.getAttribute('data-universe-key');
        target.classList.add('dragging');

        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/x-ogame-item', draggedKey || '');
          event.dataTransfer.setData('text/plain', '');
        }
      }
    });

    container.addEventListener('dragover', (event) => {
      const dragging = draggingItem || (container.querySelector('.universe-item-box.dragging') as HTMLElement | null);
      if (!dragging || !indicator) return;

      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

      const mode = container.getAttribute('data-mode') || 'list';
      const containerRect = container.getBoundingClientRect();

      if (mode === 'grid') {
        const colElements = Array.from(container.querySelectorAll<HTMLElement>('.universe-column'));
        if (colElements.length === 0) return;

        const firstColRect = colElements[0].getBoundingClientRect();
        const lastColRect = colElements[colElements.length - 1].getBoundingClientRect();
        const canCreateNewColumn = colElements.length < 4;

        const isFarLeft = canCreateNewColumn && (event.clientX < firstColRect.left + 25);
        const isFarRight = canCreateNewColumn && (event.clientX > containerRect.right - 35 || event.clientX > lastColRect.right - 25);

        if (isFarLeft) {
          const colHeight = firstColRect.height;
          indicator.style.top = `${firstColRect.top - containerRect.top}px`;
          indicator.style.left = `${firstColRect.left - containerRect.left - 4}px`;
          indicator.style.width = '4px';
          indicator.style.height = `${colHeight}px`;
          indicator.style.display = 'block';
          dropTargetState = { type: 'new-col-first' };
          return;
        }

        if (isFarRight) {
          const colHeight = lastColRect.height;
          indicator.style.top = `${lastColRect.top - containerRect.top}px`;
          indicator.style.left = `${lastColRect.right - containerRect.left + 2}px`;
          indicator.style.width = '4px';
          indicator.style.height = `${colHeight}px`;
          indicator.style.display = 'block';
          dropTargetState = { type: 'new-col-last' };
          return;
        }

        let targetCol = colElements[0];
        let minDistance = Infinity;
        colElements.forEach((colEl) => {
          const rect = colEl.getBoundingClientRect();
          const center = rect.left + rect.width / 2;
          const dist = Math.abs(event.clientX - center);
          if (dist < minDistance) {
            minDistance = dist;
            targetCol = colEl;
          }
        });

        const targetColItems = Array.from(targetCol.querySelectorAll<HTMLElement>('.universe-item-box:not(.dragging)'));

        if (targetColItems.length === 0) {
          const targetColRect = targetCol.getBoundingClientRect();
          indicator.style.top = `${targetColRect.top - containerRect.top}px`;
          indicator.style.left = `${targetColRect.left - containerRect.left}px`;
          indicator.style.width = `${targetColRect.width}px`;
          indicator.style.height = '4px';
          indicator.style.display = 'block';

          dropTargetState = { type: 'inside', targetKey: undefined, isBefore: true };
          return;
        }

        let targetItem = targetColItems[0];
        let isBefore = true;

        for (const item of targetColItems) {
          const rect = item.getBoundingClientRect();
          const itemMiddle = rect.top + rect.height / 2;
          if (event.clientY < itemMiddle) {
            targetItem = item;
            isBefore = true;
            break;
          } else {
            targetItem = item;
            isBefore = false;
          }
        }

        const targetRect = targetItem.getBoundingClientRect();
        const topPos = isBefore
          ? targetRect.top - containerRect.top - 4
          : targetRect.bottom - containerRect.top + 2;

        indicator.style.top = `${topPos}px`;
        indicator.style.left = `${targetRect.left - containerRect.left}px`;
        indicator.style.width = `${targetRect.width}px`;
        indicator.style.height = '4px';
        indicator.style.display = 'block';

        dropTargetState = {
          type: 'inside',
          targetKey: targetItem.getAttribute('data-universe-key') || undefined,
          isBefore,
        };
      } else {
        const target = (event.target as HTMLElement | null)?.closest('.universe-item-box') as HTMLElement | null;
        if (!target || target === dragging) {
          hideIndicator();
          return;
        }

        const targetRect = target.getBoundingClientRect();
        const isBefore = event.clientY < targetRect.top + targetRect.height / 2;
        const topPos = isBefore
          ? targetRect.top - containerRect.top - 4
          : targetRect.bottom - containerRect.top + 1;

        indicator.style.top = `${topPos}px`;
        indicator.style.left = `${targetRect.left - containerRect.left}px`;
        indicator.style.width = `${targetRect.width}px`;
        indicator.style.height = '3px';
        indicator.style.display = 'block';

        dropTargetState = {
          type: 'inside',
          targetKey: target.getAttribute('data-universe-key') || undefined,
          isBefore,
        };
      }
    });

    container.addEventListener('dragleave', (event) => {
      if (event.target === container) hideIndicator();
    });

    container.addEventListener('dragend', (event) => {
      const target = (event.target as HTMLElement | null)?.closest('.universe-item-box') as HTMLElement | null;
      target?.classList.remove('dragging');
      applyReorder();
    });

    container.addEventListener('drop', (event) => {
      event.preventDefault();
      applyReorder();
    });
  }

  private ExtractUniverseGridFromDOM(container: HTMLElement): string[][] {
    const columns = Array.from(container.querySelectorAll<HTMLElement>('.universe-column'));
    return columns
      .map((col) => {
        const items = Array.from(col.querySelectorAll<HTMLElement>('.universe-item-box:not(.dragging)'));
        return items.map((item) => item.getAttribute('data-universe-key') || '').filter(Boolean);
      })
      .filter((col) => col.length > 0);
  }

  private ClearDropIndicators(): void {
    document.querySelectorAll('.universe-item-box.drop-before, .universe-item-box.drop-after')
      .forEach((el) => el.classList.remove('drop-before', 'drop-after'));
  }

  private async PersistUniverseOrderAsync(order: string[]): Promise<void> {
    try {
      await serviceWorkerProtocolClient.SaveUniverseOrderAsync(this.logger, order);
    } catch (error) {
      this.logger.error('Failed to persist universe order', error);
      this.Refresh();
    }
  }

  private async PersistUniverseGridAsync(grid: string[][]): Promise<void> {
    try {
      await serviceWorkerProtocolClient.SaveUniverseGridAsync(this.logger, grid);
    } catch (error) {
      this.logger.error('Failed to persist universe grid', error);
      this.Refresh();
    }
  }

  private ApplyUniverseOrder(order: string[]): void {
    const mode = this.DetectUniverseDisplayMode();
    if (mode === 'grid') {
      this.Refresh();
      return;
    }
    const container = document.getElementById('universe-list');
    if (!container) return;
    const col = container.querySelector('.universe-column') || container;
    const desiredRows: HTMLElement[] = [];
    order.forEach((rawKey) => {
      const rowView = this.universeRowsByKey.get(this.NormalizeUniverseKey(rawKey));
      if (rowView) desiredRows.push(rowView.row);
    });
    desiredRows.forEach((row) => col.appendChild(row));
  }

  private GetUniverseRowTemplate(universeKey: string): string {
    const indicatorSettingsHtml = INDICATOR_BINDINGS.map(({ checkboxIdSuffix, labelKey, icon, containerClass }) => `
                <div class="universe-setting-item ${containerClass}">
                  <label for="${checkboxIdSuffix}-${universeKey}" class="setting-item-label">
                    <span class="material-symbols-outlined" aria-hidden="true">${icon}</span>
                    <span class="setting-item-label-text">${Localizator.Translate(labelKey)}</span>
                  </label>
                  <input type="checkbox" id="${checkboxIdSuffix}-${universeKey}" class="setting-item-checkbox"></input>
                </div>
    `.trim()).join('\n');

    return `
      <div class="universe-item-box">
        <div class="universe-item">
          <div class="universe-details">
            <div class="universe-head">
              <span class="universe-drag-handle material-symbols-outlined" aria-hidden="true" title="${Localizator.Translate('SidePanelDragHandleTitle')}">drag_indicator</span>
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
          <button type="button" class="universe-refresh-button refresh-tab" title="${Localizator.Translate('SidePanelReloadUniverseTab')}" aria-label="${Localizator.Translate('SidePanelReloadUniverseTab')}">
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
                ${indicatorSettingsHtml}
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