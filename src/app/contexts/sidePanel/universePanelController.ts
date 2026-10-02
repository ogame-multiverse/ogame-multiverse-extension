import { Debouncer } from '../../async/debouncer';
import { Localizator } from '../../localization/localizator';
import { Logger } from '../../logging/logger';
import { serviceWorkerProtocolClient } from '../../messaging/serviceWorkerProtocol';
import { SidePanelUniverseCounters } from '../../model/sidePanel/sidePanelUniverseCounters';
import { SidePanelUniversesSections } from '../../model/sidePanel/sidePanelUniversesSections';
import { SidePanelUniverseStatus } from '../../model/sidePanel/sidePanelUniverseStatus';
import { UniverseLayoutConfig } from '../../model/sidePanel/universeLayoutConfig';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { LocalWindowTabsTracker } from './localWindowTabsTracker';
import { DEFAULT_WARNING_THRESHOLD_MINUTES, TAB_CHANGE_REFRESH_DEBOUNCE_MS, TabRelatedController } from './tabRelatedController';

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
    expeditionsGroup: HTMLElement;
    expeditionsValue: HTMLElement;
    expeditionsActive: HTMLElement;
    expeditionsMax: HTMLElement;
    refreshButton: HTMLButtonElement;
    settingsButton: HTMLButtonElement;
    removeButton: HTMLButtonElement;
    thresholdSelect: HTMLSelectElement;
    updateWarningState: () => void;
    currentStatus: SidePanelUniverseStatus;
    refreshEpochMs?: number;
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
    { checkboxIdSuffix: 'indicator-expeditions-display-setting-checkbox', attributeName: 'show-expeditions-indicator', optionKey: 'ShowExpeditionsIndicator', labelKey: 'SidePanelExpeditionsLabel', icon: 'explore', containerClass: 'indicator-expeditions-display-setting' },
];

export class UniversePanelController extends TabRelatedController {
    private readonly warningThresholdOptions = [5, 10, 15, 30, 45, -1];

    private readonly universeRowsByKey = new Map<string, UniverseRowView>();

    private readonly lastSecondByUniverseKey = new Map<string, number>();
    /** Prevents TickRenderedRows from reprocessing all rows on every frame (60fps); we only
     *  reprocess once per second, as EventsPanelController.UpdateCountdowns already does. */
    private lastTickTime = 0;

    private dndListenersAttached = false;
    private resizeObserver?: ResizeObserver;
    /** Cache of #panel-universe, resolved once in Initialize rather than redone
     *  on every call to Refresh/DetectUniverseDisplayMode/InitResizeObserver/EnsureDnDListeners. */
    private panel: HTMLElement | null = null;

    constructor(logger: Logger, localWindowTabsTracker: LocalWindowTabsTracker) {
        super(logger, localWindowTabsTracker);
    }

    public Initialize(): void {
        this.panel = document.getElementById('panel-universe');

        this.InitResizeObserver();
        this.Refresh(false);
        this.StartAnimationLoop();
    }

    protected TabsChangedAsync(): Promise<void> {
        Debouncer.Debounce('universe-panel-tabids-refresh', async () => {
            await this.RefreshUniverseStatusesLightAsync();
            this.RefreshUniverseStatusBadges();
        }, TAB_CHANGE_REFRESH_DEBOUNCE_MS, false);
        return Promise.resolve();
    }

    private async RefreshUniverseStatusesLightAsync(): Promise<void> {
        const rawStatusByKey = await this.GetFreshUniverseStatusesAsync();
        const statusByKey = new Map<string, SidePanelUniverseStatus>();
        rawStatusByKey.forEach((status, key) => statusByKey.set(this.NormalizeUniverseKey(key), status));

        this.universeRowsByKey.forEach((rowView, key) => {
            const freshStatus = statusByKey.get(key);
            if (freshStatus) {
                rowView.currentStatus = freshStatus;
            }
        });
    }

    public RefreshUniverseStatusBadges(): void {
        this.universeRowsByKey.forEach((rowView) => {
            this.UpdateUniverseRowStatusBadges(rowView);
        });
    }

    private UpdateUniverseRowStatusBadges(rowView: UniverseRowView): void {
        const status = rowView.currentStatus;
        const tabIds = status.TabIds || [];
        const presence = this.ComputeUniverseTabPresence(tabIds);
        const { hasLocalTabs, hasRemoteTabs, isActiveInCurrentWindow } = presence;

        const isGlobalOpen = tabIds.length > 0;
        const isOpenInCurrentWindow = isGlobalOpen && hasLocalTabs;
        const isOpenInOtherWindow = isGlobalOpen && hasRemoteTabs;

        const badgesHtml = this.BuildUniverseStatusBadgesHtml(presence);

        rowView.row.setAttribute('data-universe-open', String(isGlobalOpen));
        rowView.row.setAttribute('data-universe-open-current-window', String(isOpenInCurrentWindow));
        rowView.row.setAttribute('data-universe-open-other-window', String(isOpenInOtherWindow));
        rowView.row.setAttribute('data-universe-active-current-window', String(isActiveInCurrentWindow));

        if (rowView.badgesContainer.innerHTML !== badgesHtml) {
            rowView.badgesContainer.innerHTML = badgesHtml;
        }
    }


    private DetectUniverseDisplayMode(): 'list' | 'grid' {
        const width = this.panel?.clientWidth || window.innerWidth;
        return width >= 717 ? 'grid' : 'list';
    }

    private InitResizeObserver(): void {
        const panel = this.panel;
        if (!panel) return;

        let currentMode: 'list' | 'grid' | null = null;

        this.resizeObserver = new ResizeObserver(() => {
            const newMode = this.DetectUniverseDisplayMode();
            if (newMode !== currentMode) {
                currentMode = newMode;
                this.Refresh(false);
            }
        });

        this.resizeObserver.observe(panel);
    }

    private pendingForceRefresh = false;

    public Refresh(force = true): void {
        this.pendingForceRefresh = this.pendingForceRefresh || force;
        Debouncer.Debounce('universe-panel-refresh', async () => {
            const forceRefresh = this.pendingForceRefresh;
            this.pendingForceRefresh = false;
            const panel = this.panel;
            if (!panel) return;

            const mode = this.DetectUniverseDisplayMode();
            panel.setAttribute('data-mode', mode);

            const rawData: SidePanelUniversesSections = await this.GetUniversesSectionsAsync(mode, forceRefresh);
            const favoritesGrid: SidePanelUniverseStatus[][] = rawData?.favorites || [];
            const othersGrid: SidePanelUniverseStatus[][] = rawData?.others || [];

            const favContainer = this.EnsureSectionDOM('favorites', Localizator.Translate('SidePanelFavoriteUniverses') || 'Univers favoris', 'star');
            const othersContainer = this.EnsureSectionDOM('others', Localizator.Translate('SidePanelOtherUniverses') || 'Autres univers', 'public');

            favContainer.setAttribute('data-mode', mode);
            othersContainer.setAttribute('data-mode', mode);

            const nextUniverseKeys = new Set<string>();

            this.SyncUniverseSection(favContainer, favoritesGrid, nextUniverseKeys);
            this.SyncUniverseSection(othersContainer, othersGrid, nextUniverseKeys);

            this.universeRowsByKey.forEach((rowView, key) => {
                if (!nextUniverseKeys.has(key)) {
                    rowView.row.remove();
                    this.universeRowsByKey.delete(key);
                    this.lastSecondByUniverseKey.delete(key);
                }
            });

            this.EnsureDnDListeners();
        }, 100, false);
    }

    private EnsureSectionDOM(sectionKey: string, sectionTitleText: string, iconName: string): HTMLElement {
        let sectionEl = document.getElementById(`universe-section-${sectionKey}`);
        if (!sectionEl) {
            const panel = this.panel;
            if (!panel) throw new Error('#panel-universe element missing');

            sectionEl = document.createElement('div');
            sectionEl.id = `universe-section-${sectionKey}`;
            sectionEl.className = 'universe-section';

            const header = document.createElement('div');
            header.className = 'universe-section-header';

            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined';
            icon.textContent = iconName;

            const title = document.createElement('span');
            title.className = 'universe-section-title';
            title.textContent = sectionTitleText;

            header.appendChild(icon);
            header.appendChild(title);

            const listContainer = document.createElement('div');
            listContainer.id = `universe-list-${sectionKey}`;
            listContainer.className = 'universe-list';
            listContainer.setAttribute('data-section', sectionKey);

            sectionEl.appendChild(header);
            sectionEl.appendChild(listContainer);
            panel.appendChild(sectionEl);
        }

        return sectionEl.querySelector('.universe-list') as HTMLElement;
    }

    private SyncUniverseSection(container: HTMLElement, activeGrid: SidePanelUniverseStatus[][], nextUniverseKeys: Set<string>): void {
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

            colStatuses.forEach((status, rowIdx) => {
                const universeKey = this.NormalizeUniverseKey(status.UniverseKey);
                nextUniverseKeys.add(universeKey);

                let rowView = this.universeRowsByKey.get(universeKey);
                if (rowView) {
                    this.UpdateUniverseRow(rowView, status);
                } else {
                    rowView = this.BuildUniverseRow(status);
                    this.universeRowsByKey.set(universeKey, rowView);
                }

                // Only insert/move the node if its position actually changed: appendChild on
                // a node already in the right place still forces a needless DOM reorder.
                if (colEl.children[rowIdx] !== rowView.row) {
                    colEl.appendChild(rowView.row);
                }
            });
        });
    }

    public UpdateUniverseOpenState(universeKey: string, isOpen: boolean): void {
        const key = this.NormalizeUniverseKey(universeKey);
        const existingRow = this.universeRowsByKey.get(key);

        if (existingRow) {
            existingRow.currentStatus.IsOpen = isOpen;
            this.UpdateUniverseRow(existingRow, existingRow.currentStatus);
        }
    }

    public UpdateSingleUniverseStatus(data: { universeKey: string; universeCounters: SidePanelUniverseCounters; isOpen: boolean }): void {
        if (!data?.universeKey) return;

        const universeKey = this.NormalizeUniverseKey(data.universeKey);
        const existingRow = this.universeRowsByKey.get(universeKey);

        if (existingRow) {
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

            if (this.universeRowsByKey.size === 0) {
                this.Refresh();
            }
        }
    }

    /** Applies the state (checked + attribute) of a binary indicator on a row, without touching listeners.
     *  Shared between BuildUniverseRow (initial setup) and UpdateSingleUniverseOptions (external update). */
    private ApplyIndicatorState(row: HTMLElement, universeKey: string, options: UniverseSidePanelOptions | undefined): void {
        INDICATOR_BINDINGS.forEach(({ checkboxIdSuffix, attributeName, optionKey }) => {
            const checkbox = row.querySelector(`#${checkboxIdSuffix}-${universeKey}`) as HTMLInputElement | null;
            const value = Boolean(options?.[optionKey]);
            if (checkbox) checkbox.checked = value;
            row.setAttribute(attributeName, String(value));
        });
    }

    public UpdateSingleUniverseOptions(universeKey: string, options: UniverseSidePanelOptions): void {
        if (!universeKey || !options) return;

        const key = this.NormalizeUniverseKey(universeKey);
        const existingRow = this.universeRowsByKey.get(key);

        if (!existingRow) return;

        existingRow.currentStatus.SidePanelOptions = options;
        this.UpdateUniverseRow(existingRow, existingRow.currentStatus);

        this.ApplyIndicatorState(existingRow.row, existingRow.currentStatus.UniverseKey, options);

        const fleetsTrackingCheckbox = existingRow.row.querySelector(`#enable-fleets-tracking-${existingRow.currentStatus.UniverseKey}`) as HTMLInputElement;
        const fleetTrackingEnabled = options.FleetTrackingEnabled ?? true;
        if (fleetsTrackingCheckbox) {
            fleetsTrackingCheckbox.checked = fleetTrackingEnabled;
        }
    }

    protected OnAnimationFrame(): void {
        const now = Date.now();
        if (now - this.lastTickTime < 900) return;
        this.lastTickTime = now;
        this.TickRenderedRows();
    }

    private TickRenderedRows(): void {
        const now = Date.now();

        this.universeRowsByKey.forEach((rowView, universeKey) => {
            const parsed = rowView.refreshEpochMs;

            if (parsed === undefined) {
                rowView.updateWarningState();
                return;
            }

            const elapsedSec = Math.max(0, Math.floor((now - parsed) / 1000));
            const previousSec = this.lastSecondByUniverseKey.get(universeKey);

            if (elapsedSec !== previousSec) {
                this.lastSecondByUniverseKey.set(universeKey, elapsedSec);

                const nextRefreshText = `${Localizator.Translate('SidePanelLastRefreshLabel')}: ${this.FormatLastRefresh(rowView.currentStatus.LastRefreshAtIso)}`;
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
                void this.HandleUniverseTabIconClickAsync(
                    this.logger,
                    rowView.currentStatus,
                    badge as HTMLElement,
                    this.localWindowTabsTracker.WindowId,
                    () => this.Refresh()
                );
            }
        });

        const selectedThreshold = status.SidePanelOptions?.WarningThresholdMinutes ?? DEFAULT_WARNING_THRESHOLD_MINUTES;

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
            expeditionsGroup: row.querySelector('.expeditions-group')!,
            expeditionsValue: row.querySelector('.expeditions')!,
            expeditionsActive: row.querySelector('.expeditions-active')!,
            expeditionsMax: row.querySelector('.expeditions-max')!,
            refreshButton,
            settingsButton,
            removeButton,
            thresholdSelect,
            currentStatus: status,
            updateWarningState: () => {
                const threshold = rowView.currentStatus.SidePanelOptions?.WarningThresholdMinutes ?? DEFAULT_WARNING_THRESHOLD_MINUTES;
                const shouldWarn = this.ShouldShowRefreshWarning(rowView.currentStatus, threshold);
                refreshButton.classList.toggle('universe-refresh-warning', shouldWarn);
                lastRefresh.classList.toggle('universe-last-refresh-warning', shouldWarn);
            },
        };

        this.warningThresholdOptions.forEach((minutes) => {
            const option = document.createElement('option');
            option.value = String(minutes);
            option.textContent = minutes > 0 ? `${minutes} ${Localizator.Translate('SidePanelMinutesShort')}` : Localizator.Translate('Never');
            option.selected = selectedThreshold === minutes;
            thresholdSelect.appendChild(option);
        });

        thresholdSelect.addEventListener('change', async () => {
            const selectedMinutes = Number(thresholdSelect.value);
            if (!rowView.currentStatus.SidePanelOptions) {
                rowView.currentStatus.SidePanelOptions = {} as UniverseSidePanelOptions;
            }
            rowView.currentStatus.SidePanelOptions.WarningThresholdMinutes = selectedMinutes;
            await this.SaveOption(rowView.currentStatus.UniverseKey, 'WarningThresholdMinutes', selectedMinutes);
            rowView.updateWarningState();
        });

        refreshButton.addEventListener('click', () =>
            this.HandleUniverseTabIconClickAsync(this.logger, rowView.currentStatus, refreshButton, this.localWindowTabsTracker.WindowId)
        );
        removeButton.addEventListener('click', () => this.ExecuteRowAction(removeButton, () => serviceWorkerProtocolClient.RemoveUniverseAsync(this.logger, rowView.currentStatus.UniverseKey)));

        settingsButton.addEventListener('click', () => {
            const isActive = settingsButton.getAttribute('data-universe-settings-active') === 'true';
            settingsButton.setAttribute('data-universe-settings-active', String(!isActive));
        });

        this.ApplyIndicatorState(row, status.UniverseKey, status.SidePanelOptions);

        INDICATOR_BINDINGS.forEach(({ checkboxIdSuffix, attributeName, optionKey }) => {
            const checkbox = row.querySelector(`#${checkboxIdSuffix}-${status.UniverseKey}`) as HTMLInputElement;
            if (!checkbox) return;

            checkbox.addEventListener('change', async () => {
                const checked = checkbox.checked;
                row.setAttribute(attributeName, String(checked));
                await this.SaveOption(rowView.currentStatus.UniverseKey, optionKey, checked);
            });
        });

        const fleetsTrackingCheckbox = row.querySelector(`#enable-fleets-tracking-${status.UniverseKey}`) as HTMLInputElement;
        if (fleetsTrackingCheckbox) {
            const initialValue = status.SidePanelOptions?.FleetTrackingEnabled ?? true;
            fleetsTrackingCheckbox.checked = initialValue;

            fleetsTrackingCheckbox.addEventListener('change', async () => {
                const checked = fleetsTrackingCheckbox.checked;
                await this.SaveOption(rowView.currentStatus.UniverseKey, 'FleetTrackingEnabled', checked);
            });
        }

        this.UpdateUniverseRow(rowView, status);
        return rowView;
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
            this.Refresh();
            button.disabled = false;
        }
    }

    private UpdateUniverseRow(rowView: UniverseRowView, status: SidePanelUniverseStatus): void {
        rowView.currentStatus = status;

        const parsedRefresh = status.LastRefreshAtIso ? Date.parse(status.LastRefreshAtIso) : NaN;
        rowView.refreshEpochMs = Number.isFinite(parsedRefresh) ? parsedRefresh : undefined;

        const currentThreshold = status.SidePanelOptions?.WarningThresholdMinutes ?? DEFAULT_WARNING_THRESHOLD_MINUTES;
        if (rowView.thresholdSelect.value !== String(currentThreshold)) {
            rowView.thresholdSelect.value = String(currentThreshold);
        }

        // Update the badges and tab presence attributes
        this.UpdateUniverseRowStatusBadges(rowView);

        const nextTitle = status.UniverseDisplayName ? `${status.UniverseDisplayName} (${status.UniverseKey})` : status.UniverseKey;
        if (rowView.title.textContent !== nextTitle) {
            rowView.title.textContent = nextTitle;
        }

        const nextRefreshText = `${Localizator.Translate('SidePanelLastRefreshLabel')}: ${this.FormatLastRefresh(status.LastRefreshAtIso)}`;
        if (rowView.lastRefresh.textContent !== nextRefreshText) {
            rowView.lastRefresh.textContent = nextRefreshText;
        }

        const updateAttribute = (el: HTMLElement, attrName: string, value: string) => {
            if (el.getAttribute(attrName) !== value) {
                el.setAttribute(attrName, value);
            }
        };

        const updateCounter = (el: HTMLElement, value: number) => {
            const strValue = String(value);
            if (el.textContent !== strValue) {
                updateAttribute(el, 'ogm-value', strValue);
                el.textContent = strValue;
            }
        };

        updateCounter(rowView.unreadMessagesValue, status.SidePanelUniverseCounters.NewMessages);
        updateCounter(rowView.unreadChatMessagesValue, status.SidePanelUniverseCounters.NewChatMessages);
        updateCounter(rowView.hostileFleetCountValue, status.SidePanelUniverseCounters.HostileFleetCount);
        updateCounter(rowView.friendlyFleetCountValue, status.SidePanelUniverseCounters.FriendlyFleetCount);
        updateCounter(rowView.ownFleetCountValue, status.SidePanelUniverseCounters.OwnFleetCount);

        const activeExpeditions = status.SidePanelUniverseCounters.ActiveExpeditions ?? 0;
        const maxExpeditionSlots = Math.max(status.SidePanelUniverseCounters.MaximumExpeditionSlots ?? 0, activeExpeditions)
        const expeditionsState = activeExpeditions <= 0 ? 'none' : activeExpeditions < maxExpeditionSlots ? 'partial' : 'full';

        const nextActiveText = String(activeExpeditions);
        if (rowView.expeditionsActive.textContent !== nextActiveText) {
            rowView.expeditionsActive.textContent = nextActiveText;
        }
        const nextMaxText = String(maxExpeditionSlots);
        if (rowView.expeditionsMax.textContent !== nextMaxText) {
            rowView.expeditionsMax.textContent = nextMaxText;
        }
        updateAttribute(rowView.expeditionsValue, 'ogm-max-value', nextMaxText);
        updateAttribute(rowView.expeditionsValue, 'ogm-value', nextActiveText);
        updateAttribute(rowView.expeditionsValue, 'ogm-state', expeditionsState);

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

    private NormalizeUniverseKey(universeKey: string): string {
        return (universeKey || '').trim().toLowerCase();
    }

    private EnsureDnDListeners(): void {
        if (this.dndListenersAttached) return;
        this.dndListenersAttached = true;

        const panel = this.panel;
        if (!panel) return;

        let indicator = document.querySelector('.drop-indicator-line') as HTMLElement | null;
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'drop-indicator-line';
            panel.appendChild(indicator);
        }

        interface DropTargetState {
            targetSection: 'favorites' | 'others';
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

        const applyReorder = async () => {
            const keyToMove = draggedKey || draggingItem?.getAttribute('data-universe-key');
            if (!keyToMove || !dropTargetState) {
                hideIndicator();
                return;
            }

            const mode = panel.getAttribute('data-mode') || 'list';
            const favContainer = document.getElementById('universe-list-favorites');
            const othersContainer = document.getElementById('universe-list-others');

            if (!favContainer || !othersContainer) return;

            if (mode === 'grid') {
                let favGrid = this.ExtractUniverseGridFromDOM(favContainer, keyToMove);
                let othersGrid = this.ExtractUniverseGridFromDOM(othersContainer, keyToMove);

                let targetGrid = dropTargetState.targetSection === 'favorites' ? favGrid : othersGrid;

                if (dropTargetState.type === 'new-col-first') {
                    targetGrid.unshift([keyToMove]);
                } else if (dropTargetState.type === 'new-col-last') {
                    targetGrid.push([keyToMove]);
                } else if (dropTargetState.type === 'inside') {
                    if (dropTargetState.targetKey) {
                        let inserted = false;
                        for (let c = 0; c < targetGrid.length; c++) {
                            const idx = targetGrid[c].indexOf(dropTargetState.targetKey);
                            if (idx !== -1) {
                                const insertIdx = dropTargetState.isBefore ? idx : idx + 1;
                                targetGrid[c].splice(insertIdx, 0, keyToMove);
                                inserted = true;
                                break;
                            }
                        }
                        if (!inserted) {
                            if (targetGrid.length === 0) targetGrid.push([keyToMove]);
                            else targetGrid[targetGrid.length - 1].push(keyToMove);
                        }
                    } else {
                        if (targetGrid.length === 0) targetGrid.push([keyToMove]);
                        else targetGrid[0].push(keyToMove);
                    }
                }

                const newLayout = new UniverseLayoutConfig({
                    favoriteGridOrder: favGrid.filter((c) => c.length > 0),
                    gridOrder: othersGrid.filter((c) => c.length > 0),
                });

                await serviceWorkerProtocolClient.SaveUniverseLayoutAsync(this.logger, newLayout);
            } else {
                let favList = this.ExtractUniverseListFromDOM(favContainer, keyToMove);
                let othersList = this.ExtractUniverseListFromDOM(othersContainer, keyToMove);

                let targetList = dropTargetState.targetSection === 'favorites' ? favList : othersList;

                if (dropTargetState.targetKey) {
                    const targetIdx = targetList.indexOf(dropTargetState.targetKey);
                    if (targetIdx !== -1) {
                        const insertIdx = dropTargetState.isBefore ? targetIdx : targetIdx + 1;
                        targetList.splice(insertIdx, 0, keyToMove);
                    } else {
                        targetList.push(keyToMove);
                    }
                } else {
                    targetList.push(keyToMove);
                }

                const newLayout = new UniverseLayoutConfig({
                    favoriteListOrder: favList,
                    listOrder: othersList,
                });

                await serviceWorkerProtocolClient.SaveUniverseLayoutAsync(this.logger, newLayout);
            }

            hideIndicator();
            draggingItem = null;
            draggedKey = null;
            dropTargetState = null;
            this.Refresh();
        };

        panel.addEventListener('dragstart', (event) => {
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

        let dragOverRafPending = false;
        let pendingDragOverEvent: DragEvent | null = null;

        const processDragOver = (event: DragEvent) => {
            const dragging = draggingItem || (panel.querySelector('.universe-item-box.dragging') as HTMLElement | null);
            if (!dragging || !indicator) return;

            const targetListContainer = (event.target as HTMLElement | null)?.closest('.universe-list') as HTMLElement | null;
            if (!targetListContainer) return;

            const sectionKey = targetListContainer.getAttribute('data-section') as 'favorites' | 'others';
            const mode = panel.getAttribute('data-mode') || 'list';
            const containerRect = targetListContainer.getBoundingClientRect();
            const panelRect = panel.getBoundingClientRect();

            if (mode === 'grid') {
                const colElements = Array.from(targetListContainer.querySelectorAll<HTMLElement>('.universe-column'));

                if (colElements.length === 0) {
                    indicator.style.top = `${containerRect.top - panelRect.top}px`;
                    indicator.style.left = `${containerRect.left - panelRect.left}px`;
                    indicator.style.width = '340px';
                    indicator.style.height = '4px';
                    indicator.style.display = 'block';

                    dropTargetState = { targetSection: sectionKey, type: 'inside', targetKey: undefined, isBefore: true };
                    return;
                }

                const firstColRect = colElements[0].getBoundingClientRect();
                const lastColRect = colElements[colElements.length - 1].getBoundingClientRect();
                const canCreateNewColumn = colElements.length < 4;

                const isFarLeft = canCreateNewColumn && (event.clientX < firstColRect.left + 25);
                const isFarRight = canCreateNewColumn && (event.clientX > containerRect.right - 35 || event.clientX > lastColRect.right - 25);

                if (isFarLeft) {
                    indicator.style.top = `${firstColRect.top - panelRect.top}px`;
                    indicator.style.left = `${firstColRect.left - panelRect.left - 4}px`;
                    indicator.style.width = '4px';
                    indicator.style.height = `${firstColRect.height}px`;
                    indicator.style.display = 'block';
                    dropTargetState = { targetSection: sectionKey, type: 'new-col-first' };
                    return;
                }

                if (isFarRight) {
                    indicator.style.top = `${lastColRect.top - panelRect.top}px`;
                    indicator.style.left = `${lastColRect.right - panelRect.left + 2}px`;
                    indicator.style.width = '4px';
                    indicator.style.height = `${lastColRect.height}px`;
                    indicator.style.display = 'block';
                    dropTargetState = { targetSection: sectionKey, type: 'new-col-last' };
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
                    indicator.style.top = `${targetColRect.top - panelRect.top}px`;
                    indicator.style.left = `${targetColRect.left - panelRect.left}px`;
                    indicator.style.width = `${targetColRect.width}px`;
                    indicator.style.height = '4px';
                    indicator.style.display = 'block';
                    dropTargetState = { targetSection: sectionKey, type: 'inside', targetKey: undefined, isBefore: true };
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
                    ? targetRect.top - panelRect.top - 4
                    : targetRect.bottom - panelRect.top + 2;

                indicator.style.top = `${topPos}px`;
                indicator.style.left = `${targetRect.left - panelRect.left}px`;
                indicator.style.width = `${targetRect.width}px`;
                indicator.style.height = '4px';
                indicator.style.display = 'block';

                dropTargetState = {
                    targetSection: sectionKey,
                    type: 'inside',
                    targetKey: targetItem.getAttribute('data-universe-key') || undefined,
                    isBefore,
                };
            } else {
                const target = (event.target as HTMLElement | null)?.closest('.universe-item-box') as HTMLElement | null;
                if (!target) {
                    indicator.style.top = `${containerRect.bottom - panelRect.top}px`;
                    indicator.style.left = `${containerRect.left - panelRect.left}px`;
                    indicator.style.width = `${containerRect.width}px`;
                    indicator.style.height = '3px';
                    indicator.style.display = 'block';

                    dropTargetState = { targetSection: sectionKey, type: 'inside', targetKey: undefined, isBefore: false };
                    return;
                }

                const targetRect = target.getBoundingClientRect();
                const isBefore = event.clientY < targetRect.top + targetRect.height / 2;
                const topPos = isBefore
                    ? targetRect.top - panelRect.top - 4
                    : targetRect.bottom - panelRect.top + 1;

                indicator.style.top = `${topPos}px`;
                indicator.style.left = `${targetRect.left - panelRect.left}px`;
                indicator.style.width = `${targetRect.width}px`;
                indicator.style.height = '3px';
                indicator.style.display = 'block';

                dropTargetState = {
                    targetSection: sectionKey,
                    type: 'inside',
                    targetKey: target.getAttribute('data-universe-key') || undefined,
                    isBefore,
                };
            }
        };

        panel.addEventListener('dragover', (event) => {
            const dragging = draggingItem || (panel.querySelector('.universe-item-box.dragging') as HTMLElement | null);
            if (!dragging || !indicator) return;

            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

            pendingDragOverEvent = event;
            if (dragOverRafPending) return;
            dragOverRafPending = true;
            requestAnimationFrame(() => {
                dragOverRafPending = false;
                if (pendingDragOverEvent) processDragOver(pendingDragOverEvent);
            });
        });

        panel.addEventListener('dragleave', (event) => {
            if (event.target === panel) hideIndicator();
        });

        panel.addEventListener('dragend', (event) => {
            const target = (event.target as HTMLElement | null)?.closest('.universe-item-box') as HTMLElement | null;
            target?.classList.remove('dragging');
            void applyReorder();
        });

        panel.addEventListener('drop', (event) => {
            event.preventDefault();
            void applyReorder();
        });
    }

    private ExtractUniverseGridFromDOM(container: HTMLElement, excludeKey?: string): string[][] {
        const columns = Array.from(container.querySelectorAll<HTMLElement>('.universe-column'));
        return columns
            .map((col) => {
                const items = Array.from(col.querySelectorAll<HTMLElement>('.universe-item-box'));
                return items
                    .map((item) => item.getAttribute('data-universe-key') || '')
                    .filter((k) => k && k !== excludeKey);
            })
            .filter((col) => col.length > 0);
    }

    private ExtractUniverseListFromDOM(container: HTMLElement, excludeKey?: string): string[] {
        const items = Array.from(container.querySelectorAll<HTMLElement>('.universe-item-box'));
        return items
            .map((item) => item.getAttribute('data-universe-key') || '')
            .filter((k) => k && k !== excludeKey);
    }

    private ClearDropIndicators(): void {
        document.querySelectorAll('.universe-item-box.drop-before, .universe-item-box.drop-after')
            .forEach((el) => el.classList.remove('drop-before', 'drop-after'));
    }

    private GetUniverseRowTemplate(universeKey: string): string {
        const indicatorSettingsHtml = INDICATOR_BINDINGS.map(({ checkboxIdSuffix, labelKey, icon, containerClass }) => `
                <div class="universe-setting-item ${containerClass}">
                  <label for="${checkboxIdSuffix}-${universeKey}" class="setting-item-label">
                    <span class="material-symbols-outlined" aria-hidden="true">${icon}</span>
                    <span class="setting-item-label-text">${Localizator.Translate(labelKey)}</span>
                  </label>
                  <input type="checkbox" id="${checkboxIdSuffix}-${universeKey}" class="setting-item-checkbox" />
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
              <span class="universe-value-group universe-value-group-expeditions expeditions-group">
                <span class="material-symbols-outlined" aria-hidden="true">explore</span>
                <span class="universe-value-label">${Localizator.Translate('SidePanelExpeditionsLabel')}</span>
                <span class="universe-value expeditions"><span class="expeditions-active"></span>/<span class="expeditions-max"></span></span>
              </span>
            </div>
          </div>
          <div class="universe-actions">
            <button type="button" class="universe-refresh-button refresh-tab" title="${Localizator.Translate('SidePanelReloadUniverseTab')}" aria-label="${Localizator.Translate('SidePanelReloadUniverseTab')}">
              <span class="material-symbols-outlined" aria-hidden="true">refresh</span>
            </button>
            <button type="button" class="universe-settings-button" title="${Localizator.Translate('SidePanelSettingsUniverse')}" aria-label="${Localizator.Translate('SidePanelSettingsUniverse')}">
              <span class="material-symbols-outlined" aria-hidden="true">settings</span>
            </button>
          </div>
          <div class="universe-settings">
            <span class="universe-settings-header">${Localizator.Translate('SidePanelSettingsUniverse')}</span>
            
            <div class="universe-settings-group general-settings-group">
              <div class="universe-settings-group-content">
                <div class="universe-setting-item threshold-setting">
                  <label for="universe-threshold-select-${universeKey}" class="setting-item-label">
                    <span class="material-symbols-outlined" aria-hidden="true">timer</span>
                    <span class="setting-item-label-text universe-threshold-label">${Localizator.Translate('SidePanelRefreshWarningThresholdLabel')}</span>
                  </label>
                  <select id="universe-threshold-select-${universeKey}" class="universe-threshold-select" aria-label="${Localizator.Translate('SidePanelRefreshWarningThresholdLabel')}"></select>
                </div>
              </div>
            </div>
            <div class="universe-settings-group indicators-settings-group">
              <span class="universe-settings-group-header">${Localizator.Translate('SidePanelSettingsGroupIndicators')}:</span>
              <div class="universe-settings-group-content">
                ${indicatorSettingsHtml}
              </div>
            </div>

            <div class="universe-settings-group events-tracking-group">
              <span class="universe-settings-group-header">${Localizator.Translate('SidePanelSettingsGroupEventsTracking')}:</span>
              <div class="universe-settings-group-content">
                <div class="universe-setting-item fleets-tracking">
                  <label for="enable-fleets-tracking-${universeKey}" class="setting-item-label">
                    <span class="material-symbols-outlined">event_upcoming</span>
                    <span class="setting-item-label-text">${Localizator.Translate('SidePanelSettingsEnableFleetsTracking')}</span>
                  </label>
                  <input type="checkbox" id="enable-fleets-tracking-${universeKey}" class="setting-item-checkbox" />
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