import { MissionType } from '../enums/missionType';
import { FlyingFleetEvent } from '../flyingFleetEvent';

export type FleetOwnership = 'own' | 'friendly' | 'hostile';

export type FleetFilterCategory = 'military' | 'civil' | 'anomaly';

/** Section headers of the matrix, in display order. Rows without category are displayed first, without header. */
export const FLEET_FILTER_CATEGORIES: Array<{ key: FleetFilterCategory; labelKey: string }> = [
    { key: 'military', labelKey: 'SidePanelFleetFilterCategoryMilitary' },
    { key: 'civil', labelKey: 'SidePanelFleetFilterCategoryCivil' },
    { key: 'anomaly', labelKey: 'SidePanelFleetFilterCategoryAnomaly' },
];

export interface FleetEventFilterGroup {
    /** Stable key persisted in UniverseSidePanelOptions.FleetEventFilters (never rename it). */
    key: string;
    /** Translation key of the row label. */
    labelKey: string;
    /** Mission types handled by this row (e.g. Attack + AcsAttack). */
    missionTypes: MissionType[];
    /** Columns for which a checkbox exists; other combinations cannot happen. */
    ownerships: FleetOwnership[];
    /** Section of the matrix; undefined = ungrouped row (displayed right after the Ghost row). */
    category?: FleetFilterCategory;
}

/** Rows of the filters matrix. MissionType.Unknown is deliberately absent: such events are always shown. */
export const FLEET_EVENT_FILTER_GROUPS: FleetEventFilterGroup[] = [
    // Ungrouped
    { key: 'Expedition', labelKey: 'Expedition', missionTypes: [MissionType.Expedition], ownerships: ['own'] },
    // Military
    { key: 'Attack', labelKey: 'Attack', missionTypes: [MissionType.Attack, MissionType.AcsAttack], ownerships: ['own', 'hostile'], category: 'military' },
    { key: 'Spy', labelKey: 'Spy', missionTypes: [MissionType.Spy], ownerships: ['own', 'hostile'], category: 'military' },
    { key: 'MoonDestruction', labelKey: 'MoonDestruction', missionTypes: [MissionType.MoonDestruction], ownerships: ['own', 'hostile'], category: 'military' },
    { key: 'MissileAttack', labelKey: 'MissileAttack', missionTypes: [MissionType.MissileAttack], ownerships: ['own', 'hostile'], category: 'military' },
    { key: 'AcsDefend', labelKey: 'AcsDefend', missionTypes: [MissionType.AcsDefend], ownerships: ['own', 'friendly'], category: 'military' },
    // Civil
    { key: 'Transport', labelKey: 'Transport', missionTypes: [MissionType.Transport], ownerships: ['own', 'friendly'], category: 'civil' },
    { key: 'Deployment', labelKey: 'Deployment', missionTypes: [MissionType.Deployment], ownerships: ['own'], category: 'civil' },
    { key: 'Harvest', labelKey: 'Harvest', missionTypes: [MissionType.Harvest], ownerships: ['own'], category: 'civil' },
    { key: 'Colonisation', labelKey: 'Colonisation', missionTypes: [MissionType.Colonisation], ownerships: ['own'], category: 'civil' },
    { key: 'Exploration', labelKey: 'Exploration', missionTypes: [MissionType.Exploration], ownerships: ['friendly'], category: 'civil' },
    // Anomalies
    { key: 'Anomaly', labelKey: 'AnomalyEncounter', missionTypes: [MissionType.AnomalyEncounter, MissionType.AcsAnomalyEncounter], ownerships: ['own'], category: 'anomaly' },
    { key: 'AnomalyRewardDelivery', labelKey: 'AnomalyRewardDelivery', missionTypes: [MissionType.AnomalyRewardDelivery], ownerships: ['friendly'], category: 'anomaly' },
];

/** Ghost row: single checkbox (own column). Checked = ghost fleets are always shown, whatever the mission filters. */
export const GHOST_FILTER_KEY = 'Ghost:own';

const GROUP_BY_MISSION_TYPE = new Map<MissionType, FleetEventFilterGroup>(
    FLEET_EVENT_FILTER_GROUPS.flatMap((group) => group.missionTypes.map((missionType) => [missionType, group] as [MissionType, FleetEventFilterGroup]))
);

/** Keys of every checkbox of the matrix (Ghost included), used by the "check all / uncheck all" buttons. */
export function GetAllFleetFilterKeys(): string[] {
    return [
        GHOST_FILTER_KEY,
        ...FLEET_EVENT_FILTER_GROUPS.flatMap((group) => group.ownerships.map((ownership) => BuildFleetFilterKey(group.key, ownership))),
    ];
}

export function BuildFleetFilterKey(groupKey: string, ownership: FleetOwnership): string {
    return `${groupKey}:${ownership}`;
}

/** A missing key means "checked" (default). */
export function IsFleetFilterEnabled(filters: Record<string, boolean> | undefined, filterKey: string): boolean {
    return filters?.[filterKey] ?? true;
}

/** Ownership of an event, as displayed in the events panel (OGame considers exploration fleets as friendly, even your own). */
export function GetFleetOwnership(event: FlyingFleetEvent): FleetOwnership {
    switch (event.MissionType) {
        case MissionType.Exploration:
            return 'friendly';
        case MissionType.Transport:
        case MissionType.AcsDefend:
        case MissionType.AnomalyRewardDelivery:
            return event.IsOwnFleet ? 'own' : 'friendly';
        default:
            return event.IsOwnFleet ? 'own' : 'hostile';
    }
}

/** Whether an event must be displayed according to the universe filters. Returns, in order:
 *  1. true for ghost fleets while the Ghost box is checked (whatever the mission type);
 *  2. true when the mission type / ownership combination has no checkbox (Unknown, impossible cases);
 *  3. otherwise the value of the matching checkbox. */
export function IsFleetEventVisible(event: FlyingFleetEvent, filters: Record<string, boolean> | undefined): boolean {
    if (event.IsGhost && IsFleetFilterEnabled(filters, GHOST_FILTER_KEY)) return true;

    const group = GROUP_BY_MISSION_TYPE.get(event.MissionType);
    if (!group) return true;

    const ownership = GetFleetOwnership(event);
    if (!group.ownerships.includes(ownership)) return true;

    return IsFleetFilterEnabled(filters, BuildFleetFilterKey(group.key, ownership));
}