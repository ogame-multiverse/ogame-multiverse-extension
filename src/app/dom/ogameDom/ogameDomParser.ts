// import * as cheerio from 'cheerio';
import $ from 'jquery';
import { LocalizationStrings } from '../../../types/LocalizationStrings';
// import { DateUtils } from '../../dateUtils';
import { Logger } from '../../logging/logger';
import { Alliance } from '../../model/alliance';
import { Coordinates } from '../../model/coordinates';
// import { LifeformType } from '../../model/enums/lifeformType';
import { MissionType } from '../../model/enums/missionType';
import { PlayerClass } from '../../model/enums/playerClass';
import { PositionType } from '../../model/enums/positionType';
// import { StationBuildingTypes, SuppliesBuildingTypes, TechGroup } from '../../model/enums/techGroup';
import { ShipType } from '../../model/enums/techTypes';
import { Fleet } from '../../model/fleet';
import { FlyingFleetEvent } from '../../model/flyingFleetEvent';
import { Moon } from '../../model/moon';
import { Officers } from '../../model/officers';
import { Planet } from '../../model/planet';
import { Player } from '../../model/player';
import { Position } from '../../model/position';
// import { QueuedTech } from '../../model/queuedTech';
import { Resources } from '../../model/resources';
import { LocalizationData } from '../../model/save/localizationData';
import { Tech } from '../../model/tech';
import { NumberUtils } from '../../numberUtils';
import { OgameDomData } from './ogameDomData';
import { OgameMetadatas } from './ogameMetadatas';
import { ImperialProperty } from '../../model/imperialProperty';
import { DateUtils } from '../../dateUtils';

export class OgameDomParser {

    public Data: OgameDomData = new OgameDomData();
    constructor(private readonly localizationData: LocalizationData) {

    }

    // --- Utility Helpers ---

    private static ExtractCpFromHref(href: string | undefined): number {
        if (!href) return 0;
        const match = href.match(/[?&]cp=(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    private static ParseDigits(text: string | undefined): number | undefined {
        if (!text) return undefined;
        const cleaned = text.replace(/[^0-9]/g, '');
        return cleaned ? parseInt(cleaned, 10) : undefined;
    }


    // --- Public Methods ---

    public AnalyzeDom(logger: Logger) {

        // const hasLifeforms = $('.lifeform').length > 0;

        const { player, alliance } = this.GetPlayerAndAlliance(logger);
        const { planets, moons } = this.GetPlanetListData(logger);

        // const { energyProduction, availableEnergy } = this.AnalyseEnergyProduction(logger);

        const domData = new OgameDomData({
            OGameVersion: OgameMetadatas.OGameVersion(),
            // HasLifeforms: hasLifeforms,
            // Position: this.GetPosition(logger),
            Player: player,
            Alliance: alliance,
            Planets: planets,
            Moons: moons,
            // QueuedTechs: this.AnalyseQueuedTechs(logger),
            Officers: this.AnalyseOfficers(logger),
            // LifeformType: this.AnalyseLifeformType(logger),
            // Resources: this.AnalyseResources(logger),
            // AvailableEnergy: availableEnergy,
            // EnergyProduction: energyProduction
            PaseDateISO: DateUtils.NowAsIsoString(),
        });

        // Store the analysis result in the instance for later retrieval, and merge with any existing analysis result to preserve previous data.
        this.Data = Object.assign(this.Data ?? {}, domData);
    }





    public AnalyseFleetCounters(): { hostile: number; friendly: number; own: number } {
        let hostile = 0, friendly = 0, own = 0;
        const $root = $('#eventboxFilled');

        if ($root.length > 0) {
            const parseCount = (selector: string): number => {
                const match = $root.find(selector).text().trim().match(/\d+/);
                return match ? Math.max(0, parseInt(match[0], 10)) : 0;
            };

            const hasAnyCounter = $root.find('.event_list .undermark, .event_list .middlemark, .event_list .overmark').length > 0;
            own = hasAnyCounter ? parseCount('.event_list .undermark') : 0;
            friendly = hasAnyCounter ? parseCount('.event_list .middlemark') : 0;
            hostile = hasAnyCounter ? parseCount('.event_list .overmark') : 0;
        }

        return { hostile, friendly, own };
    }

    public AnalyseMessageCounters(): { messages: number; chat: number } {
        const $container = $('#newmessagesindicatorcomponent');
        const $root = $container.length > 0 ? $container : $(document.body);

        const parseSingle = ($el: JQuery<HTMLElement>): number => {
            const attrs = ['data-new-messages', 'data-count', 'data-value', 'aria-label', 'title'];
            for (const attrName of attrs) {
                const attr = ($el.attr(attrName) || '').trim();
                const match = attr.match(/\d+/);
                if (match) return Math.max(0, parseInt(match[0], 10));
            }

            const textToParse = $el.find('.newCount').text().trim() || $el.text().trim();
            const match = textToParse.match(/\d+/);
            return match ? Math.max(0, parseInt(match[0], 10)) : 0;
        };

        const parseCount = ($parent: JQuery<HTMLElement>, selectors: string[]): number => {
            let max = 0;
            selectors.forEach((selector) => {
                $parent.find(selector).each((_, el) => {
                    const count = parseSingle($(el));
                    if (count > max) max = count;
                });
            });
            return max;
        };

        return {
            messages: parseCount($root, ['.messagesIndicator']),
            chat: parseCount($root, ['.chatIndicator'])
        };
    }

    public AnalyseFlyings(logger: Logger, removeFinished: boolean, eventListHtml: string): FlyingFleetEvent[];
    public AnalyseFlyings(logger: Logger, removeFinished: boolean, root?: ParentNode | Document): FlyingFleetEvent[];
    public AnalyseFlyings(logger: Logger, removeFinished: boolean, input: string | ParentNode | Document = document): FlyingFleetEvent[] {
        logger.debug('Parsing flying fleets from DOM');

        const root: ParentNode | Document = typeof input === 'string'
            ? new DOMParser().parseFromString(input, 'text/html')
            : input;

        const $rows = $(root as any).find('#eventContent tr.eventFleet');
        const rows = $rows.length > 0 ? $rows.toArray() : Array.from(root.querySelectorAll('#eventContent tr.eventFleet'));

        // Grouped attacks are identified by the `tr.allianceAttack` header row.
        const allianceAttackUnionIds = OgameDomParser.GetAllianceAttackUnionIds(root);

        const events: FlyingFleetEvent[] = [];
        const hasRecallByEventId = new Map<number, boolean>();
        // Union id (grouped attack / grouped anomaly encounter) of each parsed row, used to merge the going flights.
        const unionIdByEvent = new Map<FlyingFleetEvent, string>();

        rows.forEach((row) => {
            const $el = $(row as any);
            const idMatch = ($el.attr('id') || '').match(/eventRow-(\d+)/);
            const id = idMatch ? Number(idMatch[1]) : undefined;

            if (id !== undefined) {
                hasRecallByEventId.set(id, $el.find('a.recallFleet').length > 0);
            }

            const returnFlight = $el.attr('data-return-flight') === 'true';
            let missionType = parseInt($el.attr('data-mission-type') || '0', 10);

            const belongsToUnion = OgameDomParser.BelongsToAllianceAttack($el, allianceAttackUnionIds);

            // Only the going flights can be grouped; return flights are never grouped.
            if (!returnFlight) {
                // Rows of a grouped attack keep data-mission-type="1" (Attack),
                // so we reclassify them as AcsAttack.
                if (missionType === MissionType.Attack && belongsToUnion) {
                    missionType = MissionType.AcsAttack;
                }
                // Rows of a grouped anomaly encounter: the first fleet is 14 (AnomalyEncounter), the following
                // ones are 13, all flagged with the `acsAnomalyIcon` icon.
                else if (OgameDomParser.IsAcsAnomalyEncounterRow($el, missionType, belongsToUnion)) {
                    missionType = MissionType.AcsAnomalyEncounter;
                }
            }
            else {
                // A return flight is never grouped: OGame may keep the grouped code on it (2 = AcsAttack),
                // so we always bring it back to the plain mission.
                if (missionType === MissionType.AcsAttack) {
                    missionType = MissionType.Attack;
                }
                // The return flight of a fleet of a grouped anomaly encounter may carry the follower code (13):
                // it is a plain AnomalyEncounter return.
                else if (missionType === MissionType.AcsAnomalyEncounter && $el.find('.acsAnomalyIcon').length > 0) {
                    missionType = MissionType.AnomalyEncounter;
                }
            }

            const arrivalSec = Number($el.attr('data-arrival-time') || '0');
            const arrival = isNaN(arrivalSec) ? undefined : arrivalSec * 1000;

            const originPos = this.ParseFlightPosition($el.find('.originFleet'), $el.find('.coordsOrigin'));
            const destPos = this.ParseFlightPosition($el.find('.destFleet'), $el.find('.destCoords'));

            const $tip = $el.find('.icon_movement span[data-tooltip-title], .icon_movement_reserve span[data-tooltip-title], .icon_movement span[title], .icon_movement_reserve span[title]').first();
            const tooltipRaw = $tip.length ? $tip.attr('data-tooltip-title') || $tip.attr('title') || '' : '';

            const parsed = this.ParseFleetDetailsFromHtmlTooltip(
                tooltipRaw,
                this.localizationData?.LocalizationStrings,
                this.localizationData?.TechsLocalizations
            );

            const fleetCountRaw = $el.find('td.detailsFleet span').first().text() || $el.find('td.detailsFleet').first().text() || '';
            const fleetCount = OgameDomParser.ParseDigits(fleetCountRaw);

            const origin = returnFlight ? destPos : originPos;
            const destination = returnFlight ? originPos : destPos;

            let isOwnFleet = returnFlight ? true // If it's a return flight, we assume it's our own fleet returning to us
                : origin.Coordinates.IsOwn; // If it's a going flight, we check if the origin is our own planet/moon

            const isGhost = OgameDomParser.IsGhostEvent(missionType, isOwnFleet, returnFlight, origin, destination, parsed.fleet, parsed.cargo);

            const flyingEvent = new FlyingFleetEvent({
                Id: id,
                IsReturn: returnFlight,
                IsOwnFleet: isOwnFleet,
                MissionType: missionType,
                ArrivalTime: arrival,
                FleetCount: fleetCount,
                Origin: origin,
                Destination: destination,
                Fleet: parsed.fleet,
                Cargo: parsed.cargo,
                IsGhost: isGhost,
            });
            events.push(flyingEvent);

            const unionId = OgameDomParser.GetUnionId($el);
            if (unionId !== undefined) unionIdByEvent.set(flyingEvent, unionId);
        });

        // Going flights of a grouped attack / grouped anomaly encounter are a single fleet: merge them.
        // Return flights are left untouched (one event per returning fleet).
        const mergedEvents = OgameDomParser.MergeGroupedGoingEvents(events, unionIdByEvent, hasRecallByEventId);

        this.CorrelateFleetEvents(mergedEvents, hasRecallByEventId);

        const result = removeFinished
            ? mergedEvents.filter((e) => !e.ArrivalTime || e.ArrivalTime > Date.now())
            : mergedEvents;
        logger.debug(`Found ${result.length} flight events (removeFinished=${removeFinished})`);

        return result;
    }


    public ParseFleetDetailsFromHtmlTooltip(
        tooltipRaw: string,
        localizationStrings: LocalizationStrings | undefined,
        techsLocalizations: Record<number, string> | undefined,
    ): { fleet?: Fleet; shipCount: number; cargo?: Resources; cargoFood?: number } {
        if (!tooltipRaw) return { shipCount: 0 };

        // Input can be either real HTML or HTML-encoded text (e.g. &lt;div ...&gt;).
        // Try both representations and keep the first one containing fleet rows.
        const decodedHtml = $('<textarea/>').html(tooltipRaw).text();
        const htmlCandidates = Array.from(new Set([tooltipRaw, decodedHtml].map((s) => (s ?? '').trim()).filter((s) => !!s)));

        let $rows = $();
        for (const html of htmlCandidates) {
            const $candidateContainer = $('<div/>').html(html);
            const $candidateRows = $candidateContainer.find('table.fleetinfo tr');
            if ($candidateRows.length > 0) {
                $rows = $candidateRows;
                break;
            }
        }
        if ($rows.length === 0) return { shipCount: 0 };

        const parseValue = (raw: string): number => {
            const v = (raw ?? '').toString().trim();
            if (!v) return 0;
            if (localizationStrings) {
                return NumberUtils.FromLocalisedFormattedString(localizationStrings, v, true) || 0;
            }
            // fallback: keep digits only (handles 18.632.524.396, 270 603, etc.)
            const digitsOnly = v.replace(/[^0-9-]/g, '');
            const n = Number(digitsOnly);
            return Number.isFinite(n) ? n : 0;
        };

        const normalizeName = (s: string): string =>
            (s ?? '')
                .trim()
                .replace(/\s+/g, ' ')
                .replace(/:$/g, '')
                // normalize apostrophes used by OGame translations (sometimes backtick)
                .replace(/[’']/g, '`')
                .normalize('NFKC');

        const findTechIdByName = (name: string): number | undefined => {
            const exact = LocalizationData.GetTechIdFromName(name, techsLocalizations);
            if (exact !== undefined) return exact;
            if (!techsLocalizations) return undefined;
            const needle = normalizeName(name);
            for (const [idStr, localizedName] of Object.entries(techsLocalizations)) {
                if (normalizeName(localizedName) === needle) return Number(idStr);
            }
            return undefined;
        };

        // Collect all rows having a td.value.
        const parsedRows: Array<{ label: string; value: number }> = [];
        $rows.each((_, tr) => {
            const $tr = $(tr as any);
            const $valueTd = $tr.find('td.value');
            if ($valueTd.length === 0) return;
            const value = parseValue($valueTd.text());

            // OGKush uses the first cell as label (and removes trailing ':')
            const $labelTd = $tr.find('td:not(.value)').first();
            const label = normalizeName(($labelTd.text() || '').replace(/:$/g, ''));
            if (!label) return;

            parsedRows.push({ label, value });
        });
        if (parsedRows.length === 0) return { shipCount: 0 };

        const ships = Tech.DefaultFleet();
        let hasAnyShip = false;
        const cargo = new Resources({});
        let hasAnyCargo = false;
        let cargoFood: number | undefined;

        const getNormalizedAscii = (value: string): string =>
            normalizeName(value)
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');

        const cargoLabelsByType: Record<'metal' | 'crystal' | 'deuterium', string | undefined> = {
            metal: techsLocalizations?.[901],
            crystal: techsLocalizations?.[902],
            deuterium: techsLocalizations?.[903],
        };

        const resolveCargoTypeFromLabel = (label: string): 'metal' | 'crystal' | 'deuterium' | 'food' | undefined => {
            const normalizedLabel = getNormalizedAscii(label);

            if (cargoLabelsByType.metal && normalizedLabel === getNormalizedAscii(cargoLabelsByType.metal)) return 'metal';
            if (cargoLabelsByType.crystal && normalizedLabel === getNormalizedAscii(cargoLabelsByType.crystal)) return 'crystal';
            if (cargoLabelsByType.deuterium && normalizedLabel === getNormalizedAscii(cargoLabelsByType.deuterium)) return 'deuterium';

            if (normalizedLabel.includes('metal')) return 'metal';
            if (normalizedLabel.includes('crystal') || normalizedLabel.includes('cristal') || normalizedLabel.includes('kristall')) return 'crystal';
            if (normalizedLabel.includes('deuterium') || normalizedLabel.includes('deuterio') || normalizedLabel.includes('deuter')) return 'deuterium';
            if (normalizedLabel.includes('food') || normalizedLabel.includes('nourriture') || normalizedLabel.includes('nahrung')) return 'food';

            return undefined;
        };

        const nonShipRows: Array<{ label: string; value: number }> = [];
        for (const row of parsedRows) {
            const techId = findTechIdByName(row.label);
            if (techId !== undefined && (ShipType as any)[techId] !== undefined) {
                ships[techId as ShipType] = row.value;
                if (row.value > 0) hasAnyShip = true;
            } else {
                nonShipRows.push(row);
            }
        }

        // Prefer label-based matching first (works with/without food row), then fallback to tail order.
        for (const row of nonShipRows) {
            const cargoType = resolveCargoTypeFromLabel(row.label);
            if (cargoType === 'metal') cargo.Metal = row.value;
            if (cargoType === 'crystal') cargo.Crystal = row.value;
            if (cargoType === 'deuterium') cargo.Deuterium = row.value;
            if (cargoType === 'food') cargoFood = row.value;
        }

        const hasDetectedCargoLabels = cargo.Metal > 0 || cargo.Crystal > 0 || cargo.Deuterium > 0 || cargoFood !== undefined;
        if (!hasDetectedCargoLabels) {
            const positionalCargoRows = nonShipRows.slice(-4);
            const positionalCargoValues = positionalCargoRows.map((r) => r.value);

            if (positionalCargoValues.length >= 4) {
                cargo.Metal = positionalCargoValues[0];
                cargo.Crystal = positionalCargoValues[1];
                cargo.Deuterium = positionalCargoValues[2];
                cargoFood = positionalCargoValues[3];
            } else if (positionalCargoValues.length >= 3) {
                cargo.Metal = positionalCargoValues[0];
                cargo.Crystal = positionalCargoValues[1];
                cargo.Deuterium = positionalCargoValues[2];
            }
        }

        hasAnyCargo = cargo.Metal > 0 || cargo.Crystal > 0 || cargo.Deuterium > 0;

        const fleet = hasAnyShip ? new Fleet({ Ships: ships }) : undefined;

        return {
            fleet: fleet,
            shipCount: Fleet.Count(fleet),
            cargo: hasAnyCargo ? cargo : undefined,
            cargoFood,
        };
    }


    // --- Private Analyzers ---

    private ParseFlightPosition($nameNode: JQuery<HTMLElement>, $coordsNode: JQuery<HTMLElement>): Position {
        const coordsText = $coordsNode.find('a').text() || $coordsNode.text() || '';
        const normalizedCoords = Coordinates.Normalize(coordsText);
        const name = $nameNode.length > 0 ? $nameNode.text().trim() : undefined;
        const isPlanet = $nameNode.length > 0 && $nameNode.find('.planet').length > 0;
        const isMoon = $nameNode.length > 0 && $nameNode.find('.moon').length > 0;

        const spaceObjects = isPlanet ? this.Data?.Planets ?? [] : isMoon ? this.Data?.Moons ?? [] : [];
        const matchedImperialProperty: ImperialProperty | undefined = isPlanet
            ? spaceObjects.find((p) => Coordinates.AreSame(p.Coordinates, { Full: normalizedCoords }))
            : isMoon
                ? spaceObjects.find((m) => Coordinates.AreSame(m.Coordinates, { Full: normalizedCoords }))
                : undefined;
        const matchedId = matchedImperialProperty?.Id;

        return new Position({
            Id: matchedId,
            Name: matchedImperialProperty?.Name ?? name,
            Coordinates: new Coordinates(matchedId !== undefined, normalizedCoords),
            Type: isMoon ? PositionType.Moon : isPlanet ? PositionType.Planet : undefined,
        });
    }

    /**
     * Detects "ghost" events: movements of our own fleet that don't actually impact
     * our resources/units (e.g. espionage probe to/from a moon at position 16,
     * recycler returning to a moon after a harvest, etc.).
     */
    private static IsGhostEvent(missionType: MissionType, isOwnFleet: boolean, isReturn: boolean, origin: Position, destination: Position, fleet: Fleet | undefined, cargo: Resources | undefined): boolean {
        if (missionType === MissionType.Spy) {
            return isOwnFleet
                && !Fleet.IsOnlyComposedOf(fleet, ShipType.EspionageProbe)
                && ((!isReturn && origin?.Type === PositionType.Moon && destination?.Coordinates?.Position === 16) || (isReturn && destination?.Type === PositionType.Moon && origin?.Coordinates?.Position === 16));
        }
        else if (missionType === MissionType.Harvest) {
            return isOwnFleet && !Fleet.IsOnlyComposedOf(fleet, ShipType.Recycler) && (isReturn ? destination : origin)?.Type === PositionType.Moon;
        }
        else if (missionType === MissionType.Colonisation) {
            return isOwnFleet && !Fleet.IsOnlyComposedOf(fleet, ShipType.ColonyShip) && (isReturn ? destination : origin)?.Type === PositionType.Moon;
        }
        else if (missionType === MissionType.Deployment) {
            return isOwnFleet && isReturn && origin?.Type === PositionType.Moon && origin?.Coordinates?.IsOwn && Resources.GetTotal(cargo) > 0;
        }
        else return false;
    }

    private CorrelateFleetEvents(events: FlyingFleetEvent[], hasRecallByEventId: Map<number, boolean>): void {
        const goings = events.filter((e) => !e.IsReturn && e.Id !== undefined && e.ArrivalTime !== undefined);
        const returns = events.filter((e) => e.IsReturn && e.Id !== undefined && e.ArrivalTime !== undefined);

        // A grouped going flight (AcsAttack / AcsAnomalyEncounter) comes back as a plain Attack / AnomalyEncounter.
        const baseMission = (m: MissionType): MissionType =>
            m === MissionType.AcsAttack ? MissionType.Attack
                : m === MissionType.AcsAnomalyEncounter ? MissionType.AnomalyEncounter
                    : m;

        const isSamePath = (goEvent: FlyingFleetEvent, returnEvent: FlyingFleetEvent): boolean => {
            if (baseMission(returnEvent.MissionType) !== baseMission(goEvent.MissionType) || !returnEvent.ArrivalTime || !goEvent.ArrivalTime) return false;
            if (returnEvent.ArrivalTime <= goEvent.ArrivalTime || goEvent.Id === undefined || returnEvent.Id === undefined || returnEvent.Id <= goEvent.Id) return false;

            const swapped = Position.AreSame(returnEvent.Origin, goEvent.Destination) && Position.AreSame(returnEvent.Destination, goEvent.Origin);
            const identical = Position.AreSame(returnEvent.Origin, goEvent.Origin) && Position.AreSame(returnEvent.Destination, goEvent.Destination);
            return swapped || identical;
        };

        const fleetSignature = (e: FlyingFleetEvent): string => {
            const ships = e.Fleet?.Ships;
            if (!ships) return '';
            return Object.entries(ships)
                .map(([k, v]) => [Number(k), Number(v)] as const)
                .filter(([_, v]) => Number.isFinite(v) && v > 0)
                .sort((a, b) => a[0] - b[0])
                .map(([k, v]) => `${k}:${v}`)
                .join('|');
        };

        const usedGoIds = new Set<number>();
        const usedReturnIds = new Set<number>();
        const sortedReturns = [...returns].sort((a, b) => (a.ArrivalTime ?? 0) - (b.ArrivalTime ?? 0));

        for (const returnEvent of sortedReturns) {
            if (returnEvent.Id === undefined || returnEvent.ArrivalTime === undefined || usedReturnIds.has(returnEvent.Id)) continue;

            const baseCandidates = goings.filter((g) => g.Id !== undefined && g.ArrivalTime !== undefined && !usedGoIds.has(g.Id) && isSamePath(g, returnEvent));
            const returnSig = fleetSignature(returnEvent);
            let candidates = baseCandidates;

            if (returnEvent.FleetCount !== undefined) {
                const countMatches = baseCandidates.filter((g) => g.FleetCount === returnEvent.FleetCount);
                if (countMatches.length > 0) candidates = countMatches;
            }

            if (candidates.length > 1 && returnSig) {
                const sigMatches = candidates.filter((g) => fleetSignature(g) === returnSig);
                if (sigMatches.length > 0) candidates = sigMatches;
            }

            candidates.sort((a, b) => (b.ArrivalTime ?? 0) - (a.ArrivalTime ?? 0));

            if (returnEvent.MissionType === MissionType.Expedition || returnEvent.MissionType === MissionType.AnomalyEncounter) {
                const holdingCandidate = candidates[0];
                const recallCandidate = candidates.find((g) => g.Id !== undefined && hasRecallByEventId.get(g.Id) === true);

                const linkGoIds = new Set<number>();
                if (holdingCandidate?.Id !== undefined) linkGoIds.add(holdingCandidate.Id);
                if (recallCandidate?.Id !== undefined) linkGoIds.add(recallCandidate.Id);

                if (linkGoIds.size === 0) continue;

                returnEvent.RelatedId = holdingCandidate?.Id ?? recallCandidate?.Id;
                for (const goId of linkGoIds) {
                    const goEvent = candidates.find((g) => g.Id === goId);
                    if (goEvent) {
                        goEvent.RelatedId = returnEvent.Id;
                        usedGoIds.add(goId);
                    }
                }
                usedReturnIds.add(returnEvent.Id);
                continue;
            }

            const goEvent = candidates[0];
            if (goEvent?.Id !== undefined) {
                goEvent.RelatedId = returnEvent.Id;
                returnEvent.RelatedId = goEvent.Id;
                usedGoIds.add(goEvent.Id);
                usedReturnIds.add(returnEvent.Id);
            }
        }
    }

    /**
     * Retrieves the union IDs of grouped attacks (ACS) present in the events list.
     * A grouped attack's header row carries the `allianceAttack` class as well as a
     * `unionunionXXX` class (and an `eventRow-unionXXX` id).
     */
    private static GetAllianceAttackUnionIds(root: ParentNode | Document): Set<string> {
        const unionIds = new Set<string>();

        const $headers = $(root as any).find('#eventContent tr.allianceAttack');
        const headers = $headers.length > 0
            ? $headers.toArray()
            : Array.from(root.querySelectorAll('#eventContent tr.allianceAttack'));

        headers.forEach((header) => {
            const $header = $(header as any);

            const classMatch = ($header.attr('class') || '').match(/(?:^|\s)unionunion(\d+)(?=\s|$)/);
            if (classMatch) {
                unionIds.add(classMatch[1]);
                return;
            }

            // Fallback: the header row's id (`eventRow-unionXXX`).
            const idMatch = ($header.attr('id') || '').match(/eventRow-union(\d+)/);
            if (idMatch) unionIds.add(idMatch[1]);
        });

        return unionIds;
    }

    /** Extracts the union id (`unionXXX` class) of a fleet row, if it belongs to a group. */
    private static GetUnionId($el: JQuery<HTMLElement>): string | undefined {
        for (const cls of ($el.attr('class') || '').split(/\s+/)) {
            const match = cls.match(/^union(\d+)$/);
            if (match) return match[1];
        }
        return undefined;
    }

    /**
     * Merges the going events of each grouped attack (AcsAttack) / grouped anomaly encounter
     * (AcsAnomalyEncounter) into a single event: ships and cargo are summed, fleet count is summed.
     * The merged event keeps the id, times and positions of the first fleet of the group.
     * Return events and ungrouped events are returned as is.
     */
    private static MergeGroupedGoingEvents(
        events: FlyingFleetEvent[],
        unionIdByEvent: Map<FlyingFleetEvent, string>,
        hasRecallByEventId: Map<number, boolean>
    ): FlyingFleetEvent[] {
        const isMergeable = (e: FlyingFleetEvent): boolean =>
            !e.IsReturn
            && unionIdByEvent.has(e)
            && (e.MissionType === MissionType.AcsAttack || e.MissionType === MissionType.AcsAnomalyEncounter);
        const groupKey = (e: FlyingFleetEvent): string => `${unionIdByEvent.get(e)}|${e.MissionType}`;

        const groups = new Map<string, FlyingFleetEvent[]>();
        for (const e of events) {
            if (!isMergeable(e)) continue;
            const key = groupKey(e);
            const group = groups.get(key);
            if (group) group.push(e);
            else groups.set(key, [e]);
        }

        const result: FlyingFleetEvent[] = [];
        for (const e of events) {
            if (!isMergeable(e)) {
                result.push(e);
                continue;
            }

            const group = groups.get(groupKey(e))!;
            if (group[0] !== e) continue; // already represented by the first event of its group
            result.push(group.length === 1 ? e : OgameDomParser.MergeEvents(group, hasRecallByEventId));
        }
        return result;
    }

    private static MergeEvents(group: FlyingFleetEvent[], hasRecallByEventId: Map<number, boolean>): FlyingFleetEvent {
        const first = group[0];

        let ships: any;
        let cargo: Resources | undefined;
        let fleetCount: number | undefined;

        for (const e of group) {
            if (e.Fleet?.Ships) {
                ships ??= Tech.DefaultFleet();
                for (const [shipId, count] of Object.entries(e.Fleet.Ships)) {
                    const n = Number(count);
                    if (Number.isFinite(n) && n > 0) ships[shipId] = (ships[shipId] ?? 0) + n;
                }
            }

            if (e.Cargo) {
                cargo ??= new Resources({});
                cargo.Metal = (cargo.Metal ?? 0) + (e.Cargo.Metal ?? 0);
                cargo.Crystal = (cargo.Crystal ?? 0) + (e.Cargo.Crystal ?? 0);
                cargo.Deuterium = (cargo.Deuterium ?? 0) + (e.Cargo.Deuterium ?? 0);
            }

            if (e.FleetCount !== undefined) fleetCount = (fleetCount ?? 0) + e.FleetCount;
        }

        // The recall of any member of the group must remain detectable through the merged event id.
        if (first.Id !== undefined) {
            hasRecallByEventId.set(first.Id, group.some((e) => e.Id !== undefined && hasRecallByEventId.get(e.Id) === true));
        }

        return new FlyingFleetEvent({
            Id: first.Id,
            IsReturn: first.IsReturn,
            IsOwnFleet: first.IsOwnFleet,
            MissionType: first.MissionType,
            ArrivalTime: first.ArrivalTime,
            FleetCount: fleetCount,
            Origin: first.Origin,
            Destination: first.Destination,
            Fleet: ships ? new Fleet({ Ships: ships }) : undefined,
            Cargo: cargo,
            IsGhost: first.IsGhost,
        });
    }

    /**
     * Indicates whether a going fleet row is part of a grouped anomaly encounter.
     * The row must carry a mission code of the anomaly family (14, or 13 for the following fleets) and
     * either belong to a `unionXXX` group or display the `acsAnomalyIcon` icon.
     */
    private static IsAcsAnomalyEncounterRow($el: JQuery<HTMLElement>, rawMissionType: number, belongsToUnion: boolean): boolean {
        const isAnomalyFamily = rawMissionType === MissionType.AnomalyEncounter
            || rawMissionType === MissionType.AcsAnomalyEncounter;
        if (!isAnomalyFamily) return false;

        return belongsToUnion || $el.find('.acsAnomalyIcon').length > 0;
    }

    /**
     * Indicates whether a fleet row belongs to one of the detected grouped attacks.
     * These rows carry a `unionXXX` class matching the `allianceAttack` header.
     */
    private static BelongsToAllianceAttack($el: JQuery<HTMLElement>, unionIds: Set<string>): boolean {
        if (unionIds.size === 0) return false;

        const classes = ($el.attr('class') || '').split(/\s+/);
        return classes.some((cls) => {
            const match = cls.match(/^union(\d+)$/);
            return match !== null && unionIds.has(match[1]);
        });
    }
    /*
    private GetPosition(logger: Logger): Position {
        logger.debug('Parsing position data');
        const position = new Position({
            Id: OgameMetadatas.CurrentPositionId(),
            Name: OgameMetadatas.CurrentPositionName(),
            Coordinates: OgameMetadatas.CurrentPositionCoordinates(),
            Type: OgameMetadatas.CurrentPositionType(),
        });

        // Update the analysis result with the parsed position
        if (this.Data) {
            this.Data.Position = position;
        }
        return position;
    }
    */
    /*
    private AnalyseLifeformType(logger: Logger): LifeformType | undefined {
        logger.debug('Parsing lifeform type');
        const lifeformElement = $('#top #lifeform .lifeform-item-icon');

        let lifeformType: LifeformType | undefined;
        if (lifeformElement.hasClass('lifeform1')) lifeformType = LifeformType.Humans;
        else if (lifeformElement.hasClass('lifeform2')) lifeformType = LifeformType.Rocktal;
        else if (lifeformElement.hasClass('lifeform3')) lifeformType = LifeformType.Mechas;
        else if (lifeformElement.hasClass('lifeform4')) lifeformType = LifeformType.Kaelesh;
        else lifeformType = undefined;


        if (this.Data) {
            this.Data.LifeformType = lifeformType;
        }

        return lifeformType;
    }
    */
    /*
    private AnalyseResources(logger: Logger): Resources {
        logger.debug('Parsing resources data');
        const domResources = $('#resourcesbarcomponent #resources .resource_tile');
        const resources = new Resources({
            Metal: parseInt(domResources.find('#resources_metal').attr('data-raw') || '0', 10),
            Crystal: parseInt(domResources.find('#resources_crystal').attr('data-raw') || '0', 10),
            Deuterium: parseInt(domResources.find('#resources_deuterium').attr('data-raw') || '0', 10),
        });

        // Update the analysis result with the parsed resources
        if (this.Data) {
            this.Data.Resources = resources;
        }

        return resources;
    }
    */
    /*
    AnalyseEnergyProduction(logger: Logger): { energyProduction: number; availableEnergy: number } {
        logger.debug('Parsing energy production data');
        const energyTooltip = $('#resources #energy_box')?.attr('data-tooltip-title') || '';
        let energyProduction = 0;
        let availableEnergy = 0;
        if (energyTooltip) {
            try {
                const $ = cheerio.load(energyTooltip);
                const parts = energyTooltip.split('|');
                const html = parts.length > 1 ? parts.slice(1).join('|') : energyTooltip;
                const $tmp = $('<div>').html(html);

                const getLineValue = (lineIndex: number): number => {
                    const spanText = $tmp.find('tr').eq(lineIndex).find('td span').first().text().trim();
                    if (spanText) {
                        return parseInt(spanText.replace(/\s/g, '').replace(',', '').replace('.', ''), 10) || 0;
                    }
                    return 0;
                };

                energyProduction = getLineValue(1);
                availableEnergy = getLineValue(0);
            } catch (e) {
                energyProduction = 0;
                availableEnergy = 0;
            }
        }
        else logger.debug('Energy tooltip not found, defaulting energy production and available energy to 0');

        // Update the analysis result with the parsed energy production and available energy
        if (this.Data) {
            this.Data.EnergyProduction = energyProduction;
            this.Data.AvailableEnergy = availableEnergy;
        }

        return { energyProduction, availableEnergy };
    }
    */

    private AnalyseOfficers(logger: Logger): Officers {
        logger.debug('Parsing officers data');
        const domOfficers = $('#officers');
        const isAll = domOfficers.hasClass('all');

        const officers = new Officers({
            Commander: isAll || domOfficers.find('.commander.on').length > 0,
            Engineer: isAll || domOfficers.find('.engineer.on').length > 0,
            Admiral: isAll || domOfficers.find('.admiral.on').length > 0,
            Geologist: isAll || domOfficers.find('.geologist.on').length > 0,
            Technocrat: isAll || domOfficers.find('.technocrat.on').length > 0,
        });

        // Update the analysis result with the parsed officers
        if (this.Data) {
            this.Data.Officers = officers;
        }

        return officers;
    }


    private GetPlayerAndAlliance(logger: Logger): { player: Player; alliance: Alliance | undefined } {
        logger.debug('Parsing alliance data');
        const allianceId = OgameMetadatas.AllianceId();
        const alliance = allianceId !== undefined
            ? new Alliance({ Id: allianceId, Name: OgameMetadatas.AllianceName(), Tag: OgameMetadatas.AllianceTag() })
            : undefined;

        logger.debug('Parsing player class data');
        const charClass = $('#characterclass .characterclass');
        const playerClass = charClass.hasClass('explorer') ? PlayerClass.Explorer
            : charClass.hasClass('warrior') ? PlayerClass.Warrior
                : charClass.hasClass('miner') ? PlayerClass.Miner
                    : PlayerClass.Unknown;

        logger.debug('Parsing player data');
        const player = new Player({
            Id: OgameMetadatas.PlayerId(),
            Name: OgameMetadatas.PlayerName(),
            AllianceId: allianceId,
            Class: playerClass,
        });

        // Update the analysis result with the parsed player and alliance
        if (this.Data) {
            this.Data.Player = player;
            this.Data.Alliance = alliance;
        }

        return { player, alliance };
    }


    private GetPlanetListData(logger: Logger): { planets: Planet[]; moons: Moon[] } {
        const planets: Planet[] = [];
        const moons: Moon[] = [];

        logger.debug('Parsing planet list data');
        $('#planetList .smallplanet').each((_, element) => {
            const $el = $(element);
            const coordinates = new Coordinates(true, $el.find('.planet-koords').text().trim());

            const planetLink = $el.find('a.planetlink');
            const planetId = OgameDomParser.ExtractCpFromHref(planetLink.attr('href'));
            const planet = new Planet({
                Id: planetId,
                Name: planetLink.find('.planet-name').text().trim(),
                Coordinates: coordinates,
            });

            const moonLink = $el.find('a.moonlink');
            if (moonLink.length > 0) {
                const moonId = OgameDomParser.ExtractCpFromHref(moonLink.attr('href'));
                const moon = new Moon({
                    Id: moonId,
                    Name: moonLink.find('img.icon-moon').attr('alt') || '',
                    Coordinates: coordinates,
                    JumpGateLevel: parseInt(moonLink.attr('data-jumpgatelevel') || '0', 10),
                    PlanetId: planet.Id,
                });

                planet.MoonId = moon.Id;
                moons.push(moon);
            }

            planets.push(planet);
        });

        // Update the analysis result with the parsed planets and moons
        if (this.Data) {
            this.Data.Planets = planets;
            this.Data.Moons = moons;
        }

        return { planets, moons };
    }
    /*
    private AnalyseQueuedTechs(logger: Logger): QueuedTech[] {
        const queuedTechs: QueuedTech[] = [];

        const detectQueuedTechFromPlanetList = ($element: JQuery<HTMLElement>, positionId: number, positionType: PositionType): QueuedTech | undefined => {
            const $constructionIcon = $element.find(positionType === PositionType.Planet ? '.constructionIcon:not(.moon)' : '.constructionIcon.moon');
            if ($constructionIcon.length === 0) return undefined;

            const technName = $constructionIcon.attr('data-tooltip-title');
            const techId = LocalizationData.GetTechIdFromName(technName, this.localizationData.TechsLocalizations);
            const techGroup = !techId ? undefined : SuppliesBuildingTypes.includes(techId) ? TechGroup.Supply : StationBuildingTypes.includes(techId) ? TechGroup.Station : undefined;

            logger.debug(`Detected queued tech on ${positionType === PositionType.Planet ? 'planet' : 'moon'}: ${technName} (id: ${techId}, group: ${techGroup})`);
            return new QueuedTech({ PositionId: positionId, TechId: techId, TechName: technName, TechGroup: techGroup });
        };

        logger.debug('Parsing planet list data');
        $('#planetList .smallplanet').each((_, element) => {
            const $el = $(element);
            const planetId = OgameDomParser.ExtractCpFromHref($el.find('a.planetlink').attr('href'));

            const queuedTechPlanet = detectQueuedTechFromPlanetList($el, planetId, PositionType.Planet);
            if (queuedTechPlanet) queuedTechs.push(queuedTechPlanet);

            const moonLink = $el.find('a.moonlink');
            if (moonLink.length > 0) {
                const moonId = OgameDomParser.ExtractCpFromHref(moonLink.attr('href'));
                const queuedTechMoon = detectQueuedTechFromPlanetList($el, moonId, PositionType.Moon);
                if (queuedTechMoon) queuedTechs.push(queuedTechMoon);
            }
        });

        try {
            const currentPositionId = OgameMetadatas.CurrentPositionId();
            const currentPositionType = OgameMetadatas.CurrentPositionType();

            const parseToLevel = ($root: JQuery<HTMLElement>): number | undefined => OgameDomParser.ParseDigits($root.find('.level').first().text());

            const parseEndDate = ($root: JQuery<HTMLElement>): string | undefined => {
                const endTimeTimestamp = $root.find('.timer time.countdown[data-end]').first().attr('data-end');
                return endTimeTimestamp ? DateUtils.TimestampToIsoString(endTimeTimestamp) : undefined;
            };

            const parseTechIdFromQueuePic = ($queuePic: JQuery<HTMLElement>, lifeformClass = false): number | undefined => {
                if ($queuePic.length === 0) return undefined;
                if (lifeformClass) {
                    const clsMatch = ($queuePic.attr('class') || '').match(/lifeformTech(\d+)/);
                    return clsMatch ? parseInt(clsMatch[1], 10) : undefined;
                }
                const altMatch = ($queuePic.attr('alt') || '').match(/_(\d+)/);
                if (altMatch) return parseInt(altMatch[1], 10);

                const onClick = ($queuePic.parent() as any).attr('onclick') || '';
                const ocMatch = onClick.match(/\((\d+)(?:,\s*\d+)?\)/) || onClick.match(/\((\d+)/);
                return ocMatch ? parseInt(ocMatch[1], 10) : undefined;
            };

            const addOrUpdate = (item: QueuedTech) => {
                if (!item.PositionId || !item.TechId) return;
                const existing = queuedTechs.find((qt) => qt.PositionId === item.PositionId && qt.TechId === item.TechId);
                if (existing) {
                    if (item.FromLevel) existing.FromLevel = item.FromLevel;
                    if (item.ToLevel) existing.ToLevel = item.ToLevel;
                    if (item.TechName) existing.TechName = item.TechName;
                    if (item.TechGroup) existing.TechGroup = item.TechGroup;
                    if (item.EndDate) existing.EndDate = item.EndDate;
                } else {
                    queuedTechs.push(item);
                }
            };

            const addBuildingFrom = ($component: JQuery<HTMLElement>, group: TechGroup | undefined, lifeform = false, requirePlanet = false) => {
                if ($component.length === 0 || (requirePlanet && currentPositionType === PositionType.Moon)) return;
                const $queuePic = $component.find('.queuePic').first();
                if ($queuePic.length === 0) return;

                const techId = parseTechIdFromQueuePic($queuePic, lifeform);
                if (currentPositionId === undefined || techId === undefined) return;

                const resolvedGroup = group ?? ((SuppliesBuildingTypes as any[]).includes(techId) ? TechGroup.Supply : (StationBuildingTypes as any[]).includes(techId) ? TechGroup.Station : undefined);
                addOrUpdate(new QueuedTech({
                    PositionId: currentPositionId,
                    TechId: techId,
                    TechGroup: resolvedGroup,
                    ToLevel: parseToLevel($component),
                    EndDate: parseEndDate($component),
                }));
            };

            addBuildingFrom($('#productionboxbuildingcomponent'), undefined, false, false);
            addBuildingFrom($('#productionboxlfbuildingcomponent'), TechGroup.LifeformBuildings, true, true);
            addBuildingFrom($('#productionboxresearchcomponent'), TechGroup.Research, false, false);
            addBuildingFrom($('#productionboxlfresearchcomponent'), TechGroup.LifeformResearch, true, true);
        } catch (e) {
            logger.error('GetQueuedTechs: failed to parse production boxes', e);
        }

        // Update the analysis result with the parsed queued techs
        if (this.Data) {
            this.Data.QueuedTechs = queuedTechs;
        }

        return queuedTechs;
    }
    */
}