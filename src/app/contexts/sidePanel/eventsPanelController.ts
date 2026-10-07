import { Debouncer } from '../../async/debouncer';
import { TippyTooltipManager, TooltipBinding } from '../../dom/tippyTooltipManager';
import { Localizator } from '../../localization/localizator';
import { Logger } from '../../logging/logger';
import { UniverseFleetEventItem } from '../../messaging/data/universeFleetEventItem';
import { serviceWorkerProtocolClient } from '../../messaging/serviceWorkerProtocol';
import { MissionType } from '../../model/enums/missionType';
import { PositionType } from '../../model/enums/positionType';
import { FlyingFleetEvent } from '../../model/flyingFleetEvent';
import { IsFleetEventVisible } from '../../model/sidePanel/fleetEventFilters';
import { Position } from '../../model/position';
import { SidePanelUniverseStatus } from '../../model/sidePanel/sidePanelUniverseStatus';
import { UniverseSidePanelOptions } from '../../model/sidePanel/universeSidePanelOptions';
import { SidePanelGlobalOptions } from '../../model/sidePanel/sidePanelGlobalOptions';
import { LocalWindowTabsTracker } from './localWindowTabsTracker';
import { DEFAULT_WARNING_THRESHOLD_MINUTES, TAB_CHANGE_REFRESH_DEBOUNCE_MS, TabRelatedController } from './tabRelatedController';

export interface UniverseSection {
    universeKey: string;
    universeDisplayName: string;
    groups: UniverseFleetEventGroup[];
}

export interface UniverseFleetEventGroup {
    universeKey: string;
    universeDisplayName: string;
    events: UniverseFleetEventItem[];
}

export class EventsPanelController extends TabRelatedController {
    /** Interval (in minutes) between two timeline markers (e.g. 2:00 PM, 2:15 PM, ...) */
    private static readonly TIMELINE_INTERVAL_MINUTES = 15;
    /** Beyond this number of consecutive markers with no card, only the first and last are shown (compressed). */
    private static readonly MAX_TIMELINE_GRID_MARKERS = 2;

    //5 minutes range for grouping events together, if they have the same mission type and other criteria
    private static readonly EVENT_GROUP_TIME_RANGE = 5 * 60 * 1000;

    private container: HTMLElement | null = null;
    /** Target for dynamic rendering (event list), distinct from `container` so a re-render never
     *  overwrites the static toolbar (checkbox, etc.). */
    private renderTarget: HTMLElement | null = null;
    private timelineToggleCheckbox: HTMLInputElement | null = null;
    private lastCountdownTickTime = 0;
    private countdownElements: HTMLElement[] = [];
    private lastRenderSignature = ''; // Signature of the last render
    /** Cache of section header DOM elements, keyed by universeKey, rebuilt once per rebuild
     *  (RenderListMode) and reused by UpdateRefreshWarningStates / RefreshUniverseStatusBadgesOnly,
     *  which run every second — avoids re-scanning the whole DOM on each tick.
     *  A single universe can produce several distinct sections/headers (BuildUniverseSections only
     *  merges consecutive groups), hence the array rather than a single entry per key. */
    private headerRefsByUniverseKey = new Map<string, Array<{ header: HTMLElement; badgesContainer: HTMLElement | null; refreshButton: HTMLButtonElement | null }>>();
    /** If false, no timeline marker or grid connector is generated: only the cards follow each other. */
    private isTimelineVisible = true;
    /** Calendar day of the last timeline marker rendered, in DOM order. Shared between the outer timeline
     *  (between universe boxes) and the inner ones (inside a box), so a date badge is only shown when the
     *  day really changes compared to the marker visually just above it. Reset at each full render. */
    private lastMarkerDayKey: string | null = null;


    private readonly tooltipManager = new TippyTooltipManager({
        theme: 'ogame',
        showPendingSpinner: true,
        // this.container doesn't exist yet here (assigned in InitializeAsync());
        // so we pass a function resolved at tooltip-attach time.
        boundary: () => this.container ?? document.body,
    });
    private readonly universeStatusByKey = new Map<string, SidePanelUniverseStatus>();
    private readonly latestOptionsByKey = new Map<string, UniverseSidePanelOptions>();
    private lastFetchedEventItems: UniverseFleetEventItem[] = [];

    constructor(logger: Logger, localWindowTabsTracker: LocalWindowTabsTracker) {
        super(logger, localWindowTabsTracker);
    }

    protected async TabsChangedAsync(): Promise<void> {
        this.ApplyActiveUniverseAttribute();

        Debouncer.Debounce('events-panel-tabids-refresh', async () => {
            await this.RefreshUniverseStatusesAsync();
            this.RefreshUniverseStatusBadgesOnly();
            this.UpdateRefreshWarningStates();
        }, TAB_CHANGE_REFRESH_DEBOUNCE_MS, false);
    }

    public async InitializeAsync(): Promise<void> {
        this.container = document.getElementById('panel-events');
        this.renderTarget = document.getElementById('events-render-target') ?? this.container;

        await this.InitializeTimelineToggleAsync();
        this.AttachEventListener();
        this.InitializeTooltips();
        await this.RefreshAsync();
        this.StartAnimationLoop();
    }

    protected OnAnimationFrame(): void {
        this.UpdateCountdowns();
    }

    private AttachEventListener(): void {
        if (!this.container) return;

        this.container.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;

            const actionTarget = target.closest('.universe-status-badge, .universe-refresh-button');
            if (actionTarget) {
                const header = actionTarget.closest<HTMLElement>('.universe-section-header');
                const universeKey = header?.dataset.universeKey;
                const status = universeKey ? this.universeStatusByKey.get(universeKey) : undefined;

                if (status) {
                    void this.HandleUniverseTabIconClickAsync(
                        this.logger,
                        status,
                        actionTarget as HTMLElement,
                        this.localWindowTabsTracker.WindowId,
                        () => this.RefreshAsync()
                    );
                }
            }
        });

    }

    /**
     * Wires up the "show timeline" checkbox: reads the global option persisted on the service
     * worker side, applies it to the checkbox's initial state, then, on every change, saves the
     * new value (which triggers a broadcast from the service worker to all open side panels,
     * including this one in return) and forces a full re-render (since the group structure hasn't
     * changed, the render signature would otherwise stay identical).
     */
    private async InitializeTimelineToggleAsync(): Promise<void> {
        this.timelineToggleCheckbox = document.getElementById('events-timeline-toggle-checkbox') as HTMLInputElement | null;
        if (!this.timelineToggleCheckbox) return;

        try {
            const options = await serviceWorkerProtocolClient.GetSidePanelGlobalOptionsAsync(this.logger);
            this.ApplyTimelineVisible(options.EventsTimelineVisible, false);
        } catch (error) {
            this.logger.error('Failed to retrieve global side panel options', error);
        }

        this.timelineToggleCheckbox.addEventListener('change', async () => {
            const isVisible = this.timelineToggleCheckbox!.checked;
            this.ApplyTimelineVisible(isVisible, true);
            await serviceWorkerProtocolClient.SaveSidePanelGlobalOptionsAsync(this.logger, new SidePanelGlobalOptions({ EventsTimelineVisible: isVisible }));
        });
    }

    /**
     * Updates the local state and the checkbox, then forces a re-render if the value changed
     * locally, or if explicitly requested (change initiated by this instance).
     */
    private ApplyTimelineVisible(visible: boolean, forceRerender: boolean): void {
        const hasChanged = this.isTimelineVisible !== visible;
        this.isTimelineVisible = visible;
        if (this.timelineToggleCheckbox) this.timelineToggleCheckbox.checked = visible;

        if (forceRerender || hasChanged) {
            this.lastRenderSignature = '';
            this.RebuildAndRenderEvents();
        }
    }

    /**
     * To be called from the broadcast handler (e.g. in the sidepanel bootstrap, via
     * sidePanelBroadcastProtocolRegistrar.OnUpdateSidePanelGlobalOptions) when ANOTHER side panel
     * changed this option, so this one updates on the fly.
     */
    public OnSidePanelGlobalOptionsUpdated(options: SidePanelGlobalOptions): void {
        this.ApplyTimelineVisible(options.EventsTimelineVisible, false);
    }

    public UpdateSingleUniverseOptions(universeKey: string, options: UniverseSidePanelOptions): void {
        if (!universeKey || !options) return;

        this.latestOptionsByKey.set(universeKey, options);

        const status = this.universeStatusByKey.get(universeKey);
        if (!status) {
            void this.RefreshAsync();
            return;
        }

        const wasEnabled = status.SidePanelOptions?.FleetTrackingEnabled ?? false;
        const previousFilters = JSON.stringify(status.SidePanelOptions?.FleetEventFilters ?? {});
        status.SidePanelOptions = options;
        this.UpdateRefreshWarningStates();

        // The render signature ignores ownership/ghost flags: force a re-render only when the filters really changed.
        if (previousFilters !== JSON.stringify(options.FleetEventFilters ?? {})) this.lastRenderSignature = '';

        if (!wasEnabled && (options.FleetTrackingEnabled ?? false)) {
            void this.RefreshAsync();
            return;
        }
        this.RebuildAndRenderEvents();
    }


    /**
     * Rebuild the event groups and re-render the events list based on the current universe statuses and visibility settings.
     */
    private RebuildAndRenderEvents(): void {
        const visibleItems = this.lastFetchedEventItems.filter((item) => {
            const options = this.universeStatusByKey.get(item.universeKey)?.SidePanelOptions;
            if (!(options?.FleetTrackingEnabled ?? false)) return false;
            return IsFleetEventVisible(item.event, options?.FleetEventFilters);
        });

        const groups = this.GroupEvents(visibleItems);
        this.RenderListMode(groups);
    }

    public UpdateSingleUniverseFleetEvents(universeKey: string, flyingFleetEvents: FlyingFleetEvent[]): void {
        if (!universeKey) return;

        const universeDisplayName = this.lastFetchedEventItems.find((item) => item.universeKey === universeKey)?.universeDisplayName;
        if (!universeDisplayName && flyingFleetEvents.length > 0) {
            void this.RefreshAsync();
            return;
        }

        const otherItems = this.lastFetchedEventItems.filter((item) => item.universeKey !== universeKey);
        const universeItems: UniverseFleetEventItem[] = flyingFleetEvents.map((event) => ({
            universeKey,
            universeDisplayName: universeDisplayName!,
            event,
        }));

        this.lastFetchedEventItems = [...otherItems, ...universeItems];
        this.RebuildAndRenderEvents();
        void this.RefreshUniverseStatusesAsync().then(() => {
            this.RefreshUniverseStatusBadgesOnly();
            this.UpdateRefreshWarningStates();
        });
    }

    public ApplyActiveUniverseAttribute(): void {
        const activeTabUrls = this.localWindowTabsTracker.GetActiveLocalTabUrls();
        const activeUniverseIds = activeTabUrls.map(url => this.extractUniverseId(url));

        const eventCards = this.container?.querySelectorAll<HTMLElement>('.event-card') ?? [];
        eventCards.forEach((card) => {
            const cardUniverseId = card.dataset.universeId;
            const universeIsActive = cardUniverseId ? activeUniverseIds.includes(cardUniverseId) : false;
            if (cardUniverseId && universeIsActive) {
                card.setAttribute('data-universe-active', 'true');
            } else {
                card.removeAttribute('data-universe-active');
            }
        });
    }

    private extractUniverseId(url: string): string | null {
        const match = url.match(/s\d+-[a-z]+/i);
        return match ? match[0] : null;
    }

    private async RefreshUniverseStatusesAsync(): Promise<void> {
        const fresh = await this.GetFreshUniverseStatusesAsync();
        this.universeStatusByKey.clear();
        fresh.forEach((status, key) => {
            const latestOptions = this.latestOptionsByKey.get(key);
            if (latestOptions) status.SidePanelOptions = latestOptions;
            this.universeStatusByKey.set(key, status);
        });
    }

    private RefreshUniverseStatusBadgesOnly(): void {
        this.headerRefsByUniverseKey.forEach((refs, universeKey) => {
            const status = this.universeStatusByKey.get(universeKey);
            const presence = this.ComputeUniverseTabPresence(status?.TabIds || []);
            const badgesHtml = this.BuildUniverseStatusBadgesHtml(presence);

            refs.forEach(({ badgesContainer }) => {
                if (!badgesContainer) return;
                if (badgesContainer.innerHTML !== badgesHtml) {
                    badgesContainer.innerHTML = badgesHtml;
                }
            });
        });
    }

    public async RefreshUniverseStatusesAndWarningsAsync(): Promise<void> {
        await this.RefreshUniverseStatusesAsync();
        this.RefreshUniverseStatusBadgesOnly();
        this.UpdateRefreshWarningStates();
    }

    private UpdateRefreshWarningStates(): void {
        this.headerRefsByUniverseKey.forEach((refs, universeKey) => {
            const status = this.universeStatusByKey.get(universeKey);
            if (!status) return;

            const threshold = status.SidePanelOptions?.WarningThresholdMinutes ?? DEFAULT_WARNING_THRESHOLD_MINUTES;
            const shouldWarn = this.ShouldShowRefreshWarning(status, threshold);

            refs.forEach(({ refreshButton }) => {
                refreshButton?.classList.toggle('universe-refresh-warning', shouldWarn);
            });
        });
    }

    public async RefreshAsync(): Promise<void> {
        if (!this.container) return;

        this.ApplyActiveUniverseAttribute();
        Debouncer.Debounce('events-panel-refresh', async () => {
            await this.localWindowTabsTracker.RefreshAsync();
            await this.RefreshUniverseStatusesAsync();

            const items = await serviceWorkerProtocolClient.GetAllFlyingFleetEventsAsync(this.logger);
            this.lastFetchedEventItems = items;
            this.RebuildAndRenderEvents();
        }, 100, false);
    }

    private GroupEvents(items: UniverseFleetEventItem[]): UniverseFleetEventGroup[] {
        const itemsByUniverse = new Map<string, UniverseFleetEventItem[]>();
        for (const item of items) {
            const list = itemsByUniverse.get(item.universeKey) || [];
            list.push(item);
            itemsByUniverse.set(item.universeKey, list);
        }

        const allGroups: UniverseFleetEventGroup[] = [];

        for (const [universeKey, universeItems] of itemsByUniverse.entries()) {
            universeItems.sort((a, b) => (a.event.ArrivalTime ?? 0) - (b.event.ArrivalTime ?? 0));

            let currentGroup: UniverseFleetEventGroup | null = null;

            for (const item of universeItems) {
                const arrivalTime = item.event.ArrivalTime ?? 0;

                if (currentGroup) {
                    const firstEvent = currentGroup.events[0].event;
                    const firstArrivalTime = firstEvent.ArrivalTime ?? 0;

                    const matchesCriteria =
                        item.event.MissionType === firstEvent.MissionType &&
                        item.event.IsReturn === firstEvent.IsReturn &&
                        item.event.IsOwnFleet === firstEvent.IsOwnFleet &&
                        item.event.IsGhost === firstEvent.IsGhost &&
                        (arrivalTime - firstArrivalTime <= EventsPanelController.EVENT_GROUP_TIME_RANGE);

                    if (matchesCriteria) {
                        currentGroup.events.push(item);
                        continue;
                    } else {
                        allGroups.push(currentGroup);
                        currentGroup = null;
                    }
                }

                currentGroup = {
                    universeKey,
                    universeDisplayName: item.universeDisplayName,
                    events: [item]
                };
            }

            if (currentGroup) {
                allGroups.push(currentGroup);
            }
        }

        return allGroups.sort((a, b) => (a.events[0].event.ArrivalTime ?? 0) - (b.events[0].event.ArrivalTime ?? 0));
    }

    private RenderListMode(groups: UniverseFleetEventGroup[]): void {
        if (!this.renderTarget) return;

        if (groups.length === 0) {
            this.lastRenderSignature = '';
            this.headerRefsByUniverseKey.clear();
            this.countdownElements = [];
            this.tooltipManager.DestroyAll();
            this.renderTarget.innerHTML = `<div class="events-empty">${Localizator.Translate('NoEventsDetected')}</div>`;
            return;
        }

        // Generate a signature for the current groups to detect if the structure has changed.
        const newSignature = this.ComputeGroupsSignature(groups);
        if (newSignature === this.lastRenderSignature) {
            // Identical structure, no need to re-render.
            return;
        }
        this.lastRenderSignature = newSignature;

        this.tooltipManager.DestroyAll();

        const sections = this.BuildUniverseSections(groups);

        const html = `
      <div class="events-list">
        ${this.BuildSectionsWithTimelineHtml(sections)}
      </div>
    `;

        this.renderTarget.innerHTML = html;
        this.RebuildHeaderRefsCache();
        this.CacheCountdownElements();
        this.ApplyActiveUniverseAttribute();
        this.InitializeTooltips();
    }

    private CacheCountdownElements(): void {
        this.countdownElements = this.container
            ? Array.from(this.container.querySelectorAll<HTMLElement>('.event-countdown[data-arrival-time], .event-card, .event-sub-card'))
            : [];
    }

    private RebuildHeaderRefsCache(): void {
        this.headerRefsByUniverseKey.clear();
        if (!this.container) return;

        const headers = this.container.querySelectorAll<HTMLElement>('.universe-section-header');
        headers.forEach((header) => {
            const universeKey = header.dataset.universeKey;
            if (!universeKey) return;

            const refs = this.headerRefsByUniverseKey.get(universeKey) || [];
            refs.push({
                header,
                badgesContainer: header.querySelector<HTMLElement>('.universe-status-badges'),
                refreshButton: header.querySelector<HTMLButtonElement>('.universe-refresh-button'),
            });
            this.headerRefsByUniverseKey.set(universeKey, refs);
        });
    }

    /**
     * Builds the list with, between sections, time markers linked by a rail:
     * - a rail connector is inserted between EVERY item (start marker, sections, markers),
     *   solid by default;
     * - between the end of one section and the start of the next, a marker is shown for EVERY
     *   TIMELINE_INTERVAL_MINUTES boundary actually crossed (e.g. 10:00 PM, 10:15 PM, 10:30 PM, ...),
     *   rather than an arbitrary time; the grid thus stays valid regardless of the chosen interval;
     * - if too many boundaries separate two sections (no card "fills" that interval), only the
     *   first and last boundaries are shown, linked by a dashed connector to signal that time
     *   has been "compressed" there.
     */
    private BuildSectionsWithTimelineHtml(sections: UniverseSection[]): string {
        const parts: string[] = [];

        const pushItem = (html: string, dashedConnectorBefore = false): void => {
            if (parts.length > 0 && this.isTimelineVisible) {
                parts.push(this.BuildRailConnectorHtml(dashedConnectorBefore));
            }
            parts.push(html);
        };

        // A marker only shows its date when it lands on a different day than the previous marker
        // rendered (the very first marker never shows one, since it has nothing to compare against).
        // The tracker is shared with the markers built inside universe boxes (see lastMarkerDayKey).
        this.lastMarkerDayKey = null;
        const pushMarker = (timestampMs: number, dashedConnectorBefore = false): void => {
            const dayKey = this.GetDayKey(timestampMs);
            const showDate = this.lastMarkerDayKey !== null && dayKey !== this.lastMarkerDayKey;
            this.lastMarkerDayKey = dayKey;

            if (showDate) {
                pushItem(this.BuildTimelineDateMarkerHtml(timestampMs), dashedConnectorBefore);
                pushItem(this.BuildTimelineMarkerHtml(timestampMs));
            } else {
                pushItem(this.BuildTimelineMarkerHtml(timestampMs), dashedConnectorBefore);
            }
        };

        // Start marker: the current time, reference point at the top of the timeline.
        // Deliberately alone: we never insert a grid boundary right after it, so as to
        // never have two labels stuck together at the very top of the timeline.
        if (this.isTimelineVisible) {
            pushMarker(Date.now());
        }

        let previousEnd: number | null = null;

        for (const section of sections) {
            const { start, end } = this.GetSectionTimeRange(section);

            if (this.isTimelineVisible && previousEnd !== null) {
                this.PushGridMarkers(pushMarker, previousEnd, start);
            }

            pushItem(this.BuildUniverseSectionHtml(section));
            previousEnd = end;
        }

        if (this.isTimelineVisible && previousEnd !== null) {
            const trailingMarkerTime = this.CeilToInterval(previousEnd, EventsPanelController.TIMELINE_INTERVAL_MINUTES);
            pushMarker(trailingMarkerTime);
        }

        return parts.join('');
    }

    /**
     * Returns the instants aligned on the grid (multiples of TIMELINE_INTERVAL_MINUTES), strictly
     * between fromMs (exclusive) and toMs (exclusive): 10:00 PM, 10:15 PM, 10:30 PM, ... These are
     * the instants — not the actual card times — that must appear on the axis so the grid boundaries
     * are respected regardless of the interval's value.
     */
    private GetGridBoundariesBetween(fromMs: number, toMs: number, intervalMinutes: number): number[] {
        const intervalMs = intervalMinutes * 60000;
        const boundaries: number[] = [];

        // First boundary strictly after fromMs (even if fromMs falls exactly on a boundary).
        let next = (Math.floor(fromMs / intervalMs) + 1) * intervalMs;

        while (next < toMs) {
            boundaries.push(next);
            next += intervalMs;
        }

        return boundaries;
    }

    /**
     * Inserts a marker for each grid boundary crossed between two instants. Beyond
     * MAX_TIMELINE_GRID_MARKERS consecutive boundaries, only the first and last are shown,
     * linked by a dashed connector.
     */
    private PushGridMarkers(
        pushMarker: (timestampMs: number, dashedConnectorBefore?: boolean) => void,
        fromMs: number,
        toMs: number
    ): void {
        const boundaries = this.GetGridBoundariesBetween(fromMs, toMs, EventsPanelController.TIMELINE_INTERVAL_MINUTES);
        if (boundaries.length === 0) return;

        const isCompressed = boundaries.length > EventsPanelController.MAX_TIMELINE_GRID_MARKERS;
        const displayedBoundaries = isCompressed
            ? [boundaries[0], boundaries[boundaries.length - 1]]
            : boundaries;

        displayedBoundaries.forEach((timestamp, index) => {
            pushMarker(timestamp, isCompressed && index === 1);
        });
    }

    private BuildRailConnectorHtml(dashed: boolean, compact: boolean = false): string {
        const classes = ['events-timeline-rail-segment'];
        if (dashed) classes.push('dashed');
        if (compact) classes.push('compact');
        return `<div class="${classes.join(' ')}"></div>`;
    }

    private GetSectionTimeRange(section: UniverseSection): { start: number; end: number } {
        let start = Infinity;
        let end = -Infinity;

        for (const group of section.groups) {
            const firstArrivalTime = group.events[0]?.event.ArrivalTime ?? 0;
            const lastArrivalTime = group.events[group.events.length - 1]?.event.ArrivalTime ?? 0;
            start = Math.min(start, firstArrivalTime);
            end = Math.max(end, lastArrivalTime);
        }

        return { start, end };
    }

    private CeilToInterval(timestampMs: number, intervalMinutes: number): number {
        const intervalMs = intervalMinutes * 60000;
        return Math.ceil(timestampMs / intervalMs) * intervalMs;
    }

    /**
     * Calendar-day identifier (independent of the time-of-day) used to detect when two
     * timeline markers fall on different days.
     */
    private GetDayKey(timestampMs: number): string {
        const date = new Date(timestampMs);
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }

    /** "28/09" or, for today/tomorrow, "28/09 (Demain)" style labels, reusing the same
     *  relative-day wording as FormatExactTime. */
    private FormatMarkerDateLabel(timestampMs: number): string {
        const date = new Date(timestampMs);
        const now = new Date();

        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / (24 * 60 * 60 * 1000));

        const dateStr = date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });

        if (dayDiff === 0) return `${dateStr} (${Localizator.Translate('Today')})`;
        if (dayDiff === 1) return `${dateStr} (${Localizator.Translate('Tomorrow')})`;
        return dateStr;
    }

    private BuildTimelineMarkerHtml(timestampMs: number): string {
        const timeLabel = new Date(timestampMs).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

        return `
      <div class="events-timeline-marker" data-timestamp="${timestampMs}">
        <span class="events-timeline-time-badge">${timeLabel}</span>
      </div>
    `;
    }

    /** A standalone marker on the rail, distinct from the time marker, shown whenever the
     *  timeline crosses into a new calendar day. */
    private BuildTimelineDateMarkerHtml(timestampMs: number): string {
        return `
      <div class="events-timeline-marker events-timeline-date-marker" data-timestamp="${timestampMs}">
        <span class="events-timeline-date-badge">${this.FormatMarkerDateLabel(timestampMs)}</span>
      </div>
    `;
    }

    private ComputeGroupsSignature(groups: UniverseFleetEventGroup[]): string {
        return groups.map(g => {
            const first = g.events[0]?.event;
            const last = g.events[g.events.length - 1]?.event;
            return `${g.universeKey}_${first?.MissionType}_${first?.IsReturn}_${g.events.length}_${first?.ArrivalTime}_${last?.ArrivalTime}`;
        }).join('|');
    }

    /**
     * Attach tooltips to all event cards based on the hidden sub-events data.
     * @returns
     */
    private InitializeTooltips(): void {
        if (!this.container) return;

        const cardContainers = Array.from(this.container.querySelectorAll<HTMLElement>('.event-card-container'));

        const bindings = cardContainers.map((cardContainer): TooltipBinding | null => {
            const card = cardContainer.querySelector<HTMLElement>('.event-card');
            const subEventsDataEl = cardContainer.querySelector<HTMLElement>('.event-sub-events-data');

            if (!card || !subEventsDataEl) return null;

            return {
                target: card,
                content: `<div class="event-tooltip-content-container"><div class="event-tooltip-content ${subEventsDataEl.className}">${subEventsDataEl.innerHTML}</div></div>`,
                interactive: true,
                delay: [500, 0],
            };
        });

        this.tooltipManager.AttachAll(bindings);
    }

    private BuildUniverseSections(groups: UniverseFleetEventGroup[]): UniverseSection[] {
        const sections: UniverseSection[] = [];

        for (const group of groups) {
            const lastSection = sections[sections.length - 1];

            if (lastSection && lastSection.universeKey === group.universeKey) {
                lastSection.groups.push(group);
            } else {
                sections.push({
                    universeKey: group.universeKey,
                    universeDisplayName: group.universeDisplayName,
                    groups: [group]
                });
            }
        }

        return sections;
    }

    private BuildUniverseSectionHtml(section: UniverseSection): string {
        const status = this.universeStatusByKey.get(section.universeKey);
        const presence = this.ComputeUniverseTabPresence(status?.TabIds || []);
        const badgesHtml = this.BuildUniverseStatusBadgesHtml(presence);
        const threshold = status?.SidePanelOptions?.WarningThresholdMinutes ?? DEFAULT_WARNING_THRESHOLD_MINUTES;
        const shouldWarn = status ? this.ShouldShowRefreshWarning(status, threshold) : false;

        return `
      <div class="universe-section" data-universe-key="${section.universeKey}">
        <div class="universe-section-header" data-universe-key="${section.universeKey}">
          <div class="universe-status-badges" aria-hidden="true">${badgesHtml}</div>
          <span class="universe-title">${section.universeDisplayName} (${section.universeKey})</span>
          <button type="button" class="universe-refresh-button refresh-tab ${shouldWarn ? 'universe-refresh-warning' : ''}">
            <span class="material-symbols-outlined" aria-hidden="true">refresh</span>
          </button>
        </div>
        <div class="universe-section-content">
          ${this.BuildSectionGroupsWithTimelineHtml(section.groups)}
        </div>
      </div>
    `;
    }

    /**
     * Same logic as BuildSectionsWithTimelineHtml, but inside a single universe box, between its
     * different card groups. A universe box represents a single coherent batch: its surrounding
     * border is therefore never broken, we just insert time markers inside it.
     */
    private BuildSectionGroupsWithTimelineHtml(groups: UniverseFleetEventGroup[]): string {
        const parts: string[] = [];

        const pushItem = (html: string, dashedConnectorBefore = false): void => {
            if (parts.length > 0 && this.isTimelineVisible) {
                parts.push(this.BuildRailConnectorHtml(dashedConnectorBefore, true));
            }
            parts.push(html);
        };

        // Same day-tracking as BuildSectionsWithTimelineHtml, and deliberately the SAME tracker:
        // the markers of this box are rendered between the outer ones, in DOM order.
        const pushMarker = (timestampMs: number, dashedConnectorBefore = false): void => {
            const dayKey = this.GetDayKey(timestampMs);
            const showDate = this.lastMarkerDayKey !== null && dayKey !== this.lastMarkerDayKey;
            this.lastMarkerDayKey = dayKey;

            if (showDate) {
                pushItem(this.BuildTimelineDateMarkerHtml(timestampMs), dashedConnectorBefore);
                pushItem(this.BuildTimelineMarkerHtml(timestampMs));
            } else {
                pushItem(this.BuildTimelineMarkerHtml(timestampMs), dashedConnectorBefore);
            }
        };

        let previousEnd: number | null = null;

        for (const group of groups) {
            const { start, end } = this.GetGroupTimeRange(group);

            if (this.isTimelineVisible && previousEnd !== null) {
                this.PushGridMarkers(pushMarker, previousEnd, start);
            }

            pushItem(this.BuildEventGroupCardHtml(group));
            previousEnd = end;
        }

        return parts.join('');
    }

    private GetGroupTimeRange(group: UniverseFleetEventGroup): { start: number; end: number } {
        const firstArrivalTime = group.events[0]?.event.ArrivalTime ?? 0;
        const lastArrivalTime = group.events[group.events.length - 1]?.event.ArrivalTime ?? 0;
        return { start: firstArrivalTime, end: lastArrivalTime };
    }

    private BuildEventGroupCardHtml(group: UniverseFleetEventGroup): string {
        const isGroup = group.events.length > 1;
        const firstItem = group.events[0];
        const lastItem = group.events[group.events.length - 1];

        const firstArrivalTime = firstItem.event.ArrivalTime ?? 0;
        const lastArrivalTime = lastItem.event.ArrivalTime ?? 0;

        const { event } = firstItem;
        const { missionTypeName, missionTypeIcon, eventClasses, ownership, ownershipClass } = this.GetMissionTypeNameIconAndClass(event);

        const shortLabelHtml = this.GetGroupShortLabel(group);

        const groupKey = `${group.universeKey}_${event.MissionType}_${event.IsReturn}_${firstArrivalTime}`;
        const isArrived = lastArrivalTime <= Date.now();

        const ownershipTagHtml = `<span class="event-ownership-tag ${ownershipClass}">${ownership}</span>`;

        const returnTagHtml = event.IsReturn ? `<span class="event-return-tag">${Localizator.Translate('Return')}</span>` : '';
        const ghostTagHtml = event.IsGhost ? `<span class="event-ghost-tag">${Localizator.Translate('Ghost')}</span>` : '';

        const headerTagsHtml = `
      <div class="event-header">
        ${returnTagHtml}
        ${ghostTagHtml}
        <span class="event-mission-tag">${missionTypeName}</span>
        ${ownershipTagHtml}
      </div>
    `;

        const isFirstFinished = firstArrivalTime <= Date.now();
        const isLastFinished = lastArrivalTime <= Date.now();

        const timerBadgeHtml = isGroup
            ? `<div class="event-timer-badge group-range">
           <span class="event-countdown ${isFirstFinished ? 'finished' : ''}" data-arrival-time="${firstArrivalTime}">${this.FormatTimeRemaining(firstArrivalTime)}</span>
           <span class="material-symbols-outlined timer-separator">arrow_downward</span>
           <span class="event-countdown ${isLastFinished ? 'finished' : ''}" data-arrival-time="${lastArrivalTime}">${this.FormatTimeRemaining(lastArrivalTime)}</span>
         </div>`
            : `<div class="event-timer-badge">
           <span class="event-countdown ${isFirstFinished ? 'finished' : ''}" data-arrival-time="${firstArrivalTime}">${this.FormatTimeRemaining(firstArrivalTime)}</span>
         </div>`;

        const eventCountHtml = group.events.length > 1 ? `<span class="event-count">${group.events.length}</span>` : '';

        const iconBadgeHtml = `
      <div class="event-icon-badge">
        <span class="material-symbols-outlined">${missionTypeIcon}</span>
        ${eventCountHtml}
      </div>
    `;

        const subEventsHtml = group.events.map(item => this.BuildSubEventCardHtml(item)).join('');

        return `
      <div class="event-card-container ${isGroup ? 'has-group' : ''}" data-group-key="${groupKey}">
        <div class="event-card ${eventClasses} ${isArrived ? 'finished' : ''}" 
             data-universe-id="${group.universeKey}"
             data-arrival-time="${firstArrivalTime}" 
             data-last-arrival-time="${lastArrivalTime}">
          ${iconBadgeHtml}
          <!--<div class="event-details">-->
            ${headerTagsHtml}
            <div class="event-label">${shortLabelHtml}</div>
          <!--</div>-->
          ${timerBadgeHtml}
        </div>
        <div class="event-sub-events-data ${eventClasses} ${ownershipClass}" style="display: none;">
          <div class="event-tooltip-header">
            ${iconBadgeHtml}
            ${headerTagsHtml}
          </div>
          <div class="event-tooltip-subevents">
            ${subEventsHtml}
          </div>
        </div>
      </div>
    `;
    }

    private BuildSubEventCardHtml(item: UniverseFleetEventItem): string {
        const { event } = item;
        const labelHtml = this.GetShortLabel(event);
        const arrivalTime = event.ArrivalTime ?? 0;
        const isArrived = arrivalTime <= Date.now();

        return `
      <div class="event-sub-card ${isArrived ? 'finished' : ''}" data-arrival-time="${arrivalTime}">
        <span class="event-exact-time">${this.FormatExactTime(arrivalTime)}</span>
        <div class="sub-label">${labelHtml}</div>
        <div class="sub-timer">
          <span class="event-countdown ${isArrived ? 'finished' : ''}" data-arrival-time="${arrivalTime}">${this.FormatTimeRemaining(arrivalTime)}</span>
        </div>
      </div>
    `;
    }

    private StripHtml(html: string): string {
        return html.replace(/<[^>]*>/g, '').trim();
    }

    private GetPositionTypeIcon(position?: Position): string {
        if (!position) return 'scatter_plot';
        if (position.Type === PositionType.Moon) return 'bedtime';
        return position.Coordinates?.Position === 16 ? 'scatter_plot' : 'globe';
    }

    private BuildPositionSpan(text: string, typeIcon?: string): string {
        const iconHtml = typeIcon ? `<span class="position-type material-symbols">${typeIcon}</span>` : '';
        return `<span class="position-text">${iconHtml}${text}</span>`;
    }

    private GetGroupShortLabel(group: UniverseFleetEventGroup): string {
        if (group.events.length === 1) {
            return this.GetShortLabel(group.events[0].event);
        }

        const events = group.events.map(item => item.event);
        const firstEvent = events[0];

        const firstOriginStr = this.FormatPosition(firstEvent.Origin);
        const firstDestStr = this.FormatPosition(firstEvent.Destination);

        const allSameOrigin = events.every(e => this.FormatPosition(e.Origin) === firstOriginStr);
        const allSameDestination = events.every(e => this.FormatPosition(e.Destination) === firstDestStr);

        const asterisk = '<span class="material-symbols-outlined">asterisk</span>';

        const originDisplay = allSameOrigin
            ? this.BuildPositionSpan(firstOriginStr, this.GetPositionTypeIcon(firstEvent.Origin))
            : this.BuildPositionSpan(asterisk);
        const destDisplay = allSameDestination
            ? this.BuildPositionSpan(firstDestStr, this.GetPositionTypeIcon(firstEvent.Destination))
            : this.BuildPositionSpan(asterisk);

        const isReturn = firstEvent.IsReturn;
        const left = isReturn ? destDisplay : originDisplay;
        const right = isReturn ? originDisplay : destDisplay;
        const arrowIcon = `<span class="material-symbols-outlined">${isReturn ? 'arrow_left_alt' : 'arrow_right_alt'}</span>`;

        return `${left} ${arrowIcon} ${right}`;
    }

    private GetShortLabel(event: FlyingFleetEvent): string {
        const origin = this.FormatPosition(event.Origin);
        const destination = this.FormatPosition(event.Destination);

        if (origin && destination) {
            const icon = `<span class="material-symbols-outlined">${event.IsReturn ? 'arrow_left_alt' : 'arrow_right_alt'}</span>`;
            const originTypeIcon = event.Origin.Type === PositionType.Moon ? 'bedtime' : event.Origin.Coordinates.Position === 16 ? 'scatter_plot' : 'globe';
            const originSpan = `<span class="position-text"><span class="position-type material-symbols">${originTypeIcon}</span>${origin}</span>`;

            const destinationTypeIcon = event.Destination.Type === PositionType.Moon ? 'bedtime' : event.Destination.Coordinates.Position === 16 ? 'scatter_plot' : 'globe';
            const destinationSpan = `<span class="position-text"><span class="position-type material-symbols">${destinationTypeIcon}</span>${destination}</span>`;

            if (event.IsReturn) {
                return `${destinationSpan} ${icon} ${originSpan}`;
            }
            else return `${originSpan} ${icon} ${destinationSpan}`;
        }

        const originOrDest = event.Origin || event.Destination;
        const originOrDestText = origin || destination;
        const originOrDestTypeIcon = originOrDest ? originOrDest.Type === PositionType.Moon ? 'bedtime' : originOrDest.Coordinates.System === 16 ? 'scatter_plot' : 'globe' : 'scatter_plot';
        return originOrDestText ? `<span class="position-text"><span class="position-type material-symbols">${originOrDestTypeIcon}</span>${originOrDestText}</span>` : '';
    }

    private FormatPosition(position?: Position): string {
        if (!position || !position.Coordinates) return '';
        const coords = position.Coordinates;
        const coordsText = coords.Galaxy !== undefined && coords.System !== undefined && coords.Position !== undefined
            ? `[${coords.Galaxy}:${coords.System}:${coords.Position}]`
            : '';
        const nameText = position.Coordinates?.Position !== 16 && position.Name ? position.Name.trim() : undefined;

        const coordsSpan = coordsText ? `<span class="position-coords">${coordsText}</span>` : '';
        const nameSpan = nameText ? `<span class="position-name">${nameText}</span>` : '';

        return `${coordsSpan}${nameSpan}`;
    }

    private GetMissionTypeNameIconAndClass(event: FlyingFleetEvent): { missionTypeName: string, missionTypeIcon: string, eventClasses: string, ownership: string, ownershipClass: string } {
        const classes: string[] = [];
        let missionTypeName: string;
        let missionTypeIcon: string;
        let ownership: string = Localizator.Translate(event.IsOwnFleet ? 'Own' : 'Hostile');
        let ownershipClass: string = `event-${event.IsOwnFleet ? 'own' : 'hostile'}`;
        switch (event.MissionType) {
            case MissionType.Spy:
                classes.push('event-spy');
                missionTypeName = Localizator.Translate('Spy');
                missionTypeIcon = 'visibility';
                break;
            case MissionType.Harvest:
                classes.push('event-recycle');
                missionTypeName = Localizator.Translate('Harvest');
                missionTypeIcon = 'recycling';
                break;
            case MissionType.Colonisation:
                classes.push('event-colonisation');
                missionTypeName = Localizator.Translate('Colonisation');
                missionTypeIcon = 'public';
                break;
            case MissionType.Deployment:
                classes.push('event-deployment');
                missionTypeName = Localizator.Translate('Deployment');
                missionTypeIcon = 'flight_land';
                break;
            case MissionType.Attack:
                missionTypeName = Localizator.Translate('Attack');
                missionTypeIcon = 'swords';
                classes.push('event-attack');
                break;
            case MissionType.AcsAttack:
                missionTypeName = Localizator.Translate('AcsAttack');
                missionTypeIcon = 'swords';
                classes.push('event-acs-attack');
                break;
            case MissionType.Transport:
                missionTypeName = Localizator.Translate('Transport');
                missionTypeIcon = 'connecting_airports';
                classes.push('event-transport');
                if (!event.IsOwnFleet) {
                    ownership = Localizator.Translate('Friendly');
                    ownershipClass = 'event-friendly';
                }

                break;
            case MissionType.AcsDefend:
                missionTypeName = Localizator.Translate('AcsDefend');
                missionTypeIcon = 'security';
                classes.push('event-acs-defend');
                if (!event.IsOwnFleet) {
                    ownership = Localizator.Translate('Friendly');
                    ownershipClass = 'event-friendly';
                }
                break;
            case MissionType.MoonDestruction:
                missionTypeName = Localizator.Translate('MoonDestruction');
                missionTypeIcon = 'bedtime_off';
                classes.push('event-moon-destruction');
                break;
            case MissionType.MissileAttack:
                missionTypeName = Localizator.Translate('MissileAttack');
                missionTypeIcon = 'bomb';
                classes.push('event-missile-attack');
                break;
            case MissionType.Expedition:
                missionTypeName = Localizator.Translate('Expedition');
                missionTypeIcon = 'explore';
                classes.push('event-expedition');
                break;
            case MissionType.Exploration:
                missionTypeName = Localizator.Translate('Exploration');
                missionTypeIcon = 'indeterminate_question_box';
                classes.push('event-exploration');

                //Ogame consider exploration fleet as friendly, even if it's your own fleet.
                ownership = Localizator.Translate('Friendly');
                ownershipClass = 'event-friendly';
                break;
            case MissionType.AnomalyEncounter:
                missionTypeName = Localizator.Translate('AnomalyEncounter');
                missionTypeIcon = 'hexagon';
                classes.push('event-anomaly-encounter');
                break;
            case MissionType.AcsAnomalyEncounter:
                missionTypeName = Localizator.Translate('AcsAnomalyEncounter');
                missionTypeIcon = 'hexagon';
                // Keep the base anomaly styling and add a dedicated class for the grouped variant.
                classes.push('event-anomaly-encounter', 'event-acs-anomaly-encounter');
                break;
            case MissionType.AnomalyRewardDelivery:
                missionTypeName = Localizator.Translate('AnomalyRewardDelivery');
                missionTypeIcon = 'redeem';
                classes.push('event-anomaly-reward-delivery');
                if (!event.IsOwnFleet) {
                    ownership = Localizator.Translate('Friendly');
                    ownershipClass = 'event-friendly';
                }

                break;
            default:
                missionTypeName = Localizator.Translate('Unknown');
                missionTypeIcon = 'scatter_plot';
                break;
        }

        classes.push(ownershipClass);
        if (event.IsReturn) classes.push('event-return');
        if (event.IsGhost) classes.push('event-ghost');

        return {
            missionTypeName,
            missionTypeIcon,
            eventClasses: classes.join(' '),
            ownership,
            ownershipClass,
        }
    }

    private UpdateCountdowns(): void {
        if (!this.container) return;

        const now = Date.now();
        if (now - this.lastCountdownTickTime < 900) return;
        this.lastCountdownTickTime = now;

        const tooltipElements = document.querySelectorAll<HTMLElement>(
            '.tippy-box .event-countdown[data-arrival-time], .tippy-box .event-sub-card'
        );
        const elements = tooltipElements.length > 0
            ? [...this.countdownElements, ...Array.from(tooltipElements)]
            : this.countdownElements;

        elements.forEach(el => {
            if (el.classList.contains('event-countdown')) {
                const arrivalTime = parseInt(el.dataset.arrivalTime || '0', 10);
                if (arrivalTime > 0) {
                    el.textContent = this.FormatTimeRemaining(arrivalTime);
                    el.classList.toggle('finished', arrivalTime - now <= 0);
                }
                return;
            }

            const lastArrivalTime = parseInt(el.dataset.lastArrivalTime || el.dataset.arrivalTime || '0', 10);
            el.classList.toggle('finished', lastArrivalTime - now <= 0);
        });

        this.UpdateRefreshWarningStates();
    }

    private FormatExactTime(arrivalTimeMs: number): string {
        if (!arrivalTimeMs) return '';
        const date = new Date(arrivalTimeMs);
        const now = new Date();

        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / (24 * 60 * 60 * 1000));

        const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        let dayPrefix: string;
        if (dayDiff === 0) dayPrefix = Localizator.Translate('Today');
        else if (dayDiff === 1) dayPrefix = Localizator.Translate('Tomorrow');
        else dayPrefix = date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });

        return `${dayPrefix} ${timeStr}`;
    }

    private FormatTimeRemaining(arrivalTimeMs: number): string {
        const diffMs = arrivalTimeMs - Date.now();
        if (diffMs <= 0) return Localizator.Translate('Finished');

        const totalSeconds = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (days > 0) {
            return `${days}j ${hours.toString().padStart(2, '0')}h`;
        }
        if (hours > 0) {
            return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
        }
        return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }
}