import { ClassBonus } from "../../../../model/bonus/classBonus";
import { ClassBonusDetail } from "../../../../model/bonus/classBonusDetail";
import { ClassBonusInfo } from "../../../../model/bonus/classBonusInfo";
import { CrawlerBonus } from "../../../../model/bonus/crawlerBonus";
import { DefenseBonus } from "../../../../model/bonus/defenseBonus";
import { ExpeditionBonus } from "../../../../model/bonus/expeditionBonus";
import { ExplorerClassBonus } from "../../../../model/bonus/explorerClassBonus";
import { LifeformBonuses } from "../../../../model/bonus/lifeformBonuses";
import { MinerClassBonus } from "../../../../model/bonus/minerClassBonus";
import { MiscBonus } from "../../../../model/bonus/miscBonus";
import { ProductionBonus } from "../../../../model/bonus/productionBonus";
import { ShipBonus } from "../../../../model/bonus/shipBonus";
import { SpeciesInfo } from "../../../../model/bonus/speciesInfo";
import { TechnologyBonus } from "../../../../model/bonus/technologyBonus";
import { WarriorClassBonus } from "../../../../model/bonus/warriorClassBonus";
import { Buff, BuffType, BuffScope, BUFF_TYPES } from "../../../../model/buff";
import { Coordinates } from "../../../../model/coordinates";
import { AllianceClass } from "../../../../model/enums/allianceClass";
import { LifeformType } from "../../../../model/enums/lifeformType";
import { PlayerClass } from "../../../../model/enums/playerClass";
import { BuildingType, DefenceType, LifeformBuildingType, LifeformResearchType, ResearchType, ShipType } from "../../../../model/enums/techTypes";
import { Moon } from "../../../../model/moon";
import { Officers } from "../../../../model/officers";
import { Planet } from "../../../../model/planet";
import { Production } from "../../../../model/production";
import { Resources } from "../../../../model/resources";

const SPECIES_TO_LIFEFORM: Record<number, LifeformType> = {
    701: LifeformType.Humans,
    702: LifeformType.Rocktal,
    703: LifeformType.Mechas,
    704: LifeformType.Kaelesh
};

export class OgameApiDataParser {

    public ParseOfficers(accountInfo: any): Officers | undefined {
        if (!accountInfo?.officers) return undefined;
        return new Officers({
            Admiral: accountInfo.admiral ?? false,
            Commander: accountInfo.commander ?? false,
            Engineer: accountInfo.engineer ?? false,
            Geologist: accountInfo.geologist ?? false,
            Technocrat: accountInfo.technocrat ?? false,
        });
    }

    public ParsePlayerClass(accountInfo: any): PlayerClass {
        return accountInfo?.characterClassId in PlayerClass ? accountInfo.characterClassId : PlayerClass.Unknown;
    }
    public ParseAllianceClass(accountInfo: any): AllianceClass {
        return accountInfo?.allianceClassId in AllianceClass ? accountInfo.allianceClassId : AllianceClass.Unknown;
    }

    public ParseResearches(accountInfo: any): Record<ResearchType, number> | undefined {
        if (!accountInfo?.researches) return undefined;
        return this.ToRecord<ResearchType>(ResearchType, accountInfo?.researches);
    }

    public ParseAccountBuffs(accountInfo: any): Buff[] | undefined {
        if (!accountInfo?.planets) return undefined;
        const firstPlanet = Object.values<any>(accountInfo?.planets ?? {})[0];
        if (!firstPlanet?.buffs) return undefined;
        const firstPlanetBuffs = (firstPlanet?.buffs ?? []).map((b: any) => this.ToBuff(b)) as Buff[];
        const accountScopeBuffs = firstPlanetBuffs.filter(x => x.Scope === BuffScope.Account);
        return accountScopeBuffs;
    }

    public ParsePlanets(accountInfo: any): Planet[] {
        return Object.values<any>(accountInfo?.planets ?? {}).map((raw) => {
            const resources = this.ToResources(raw.resources);
            const planet = new Planet({
                Id: raw.id,
                Coordinates: this.ToCoordinates(raw),
                MoonId: raw.siblingId || undefined,
                LifeformType: raw.selectedSpeciesId ? SPECIES_TO_LIFEFORM[raw.selectedSpeciesId] : undefined,
                Resources: resources,
                Production: this.ToProduction(raw.production),
                Fleet: this.ToRecord<ShipType>(ShipType, raw.ships),
                Defence: this.ToRecord<DefenceType>(DefenceType, raw.defenses),
                Buildings: this.ToRecord<BuildingType>(BuildingType, raw.buildings),
                Buffs: ((raw.buffs ?? []).map((b: any) => this.ToBuff(b)) as Buff[]).filter(x => x.Scope === BuffScope.Planet),
                LifeformBuildings: this.ToRecord<LifeformBuildingType>(LifeformBuildingType, raw.speciesBuildings),
                LifeformResearch: this.ToRecord<LifeformResearchType>(LifeformResearchType, raw.speciesResearches),
                AvailableEnergy: resources.Energy
            });
            planet.Population = raw.resources?.population;
            return planet;
        });
    }

    public ParseMoons(accountInfo: any): Moon[] {
        return Object.values<any>(accountInfo?.moons ?? {}).map((raw) => {
            const buildings = this.ToRecord<BuildingType>(BuildingType, raw.buildings);
            return new Moon({
                Id: raw.id,
                PlanetId: raw.siblingId ?? 0,
                Coordinates: this.ToCoordinates(raw),
                Resources: this.ToResources(raw.resources),
                Production: this.ToProduction(raw.production),
                Fleet: this.ToRecord<ShipType>(ShipType, raw.ships),
                Defence: this.ToRecord<DefenceType>(DefenceType, raw.defenses),
                Buildings: buildings,
                Buffs: ((raw.buffs ?? []).map((b: any) => this.ToBuff(b)) as Buff[]).filter(x => x.Scope === BuffScope.Moon),
                JumpGateLevel: buildings[BuildingType.JumpGate]
            });
        });
    }

    private ToRecord<K extends number>(enumObj: object, src?: Record<string, number>): Record<K, number> {
        const out = {} as Record<K, number>;
        for (const key of Object.values(enumObj).filter((v): v is number => typeof v === "number")) {
            out[key as K] = Number(src?.[key] ?? 0);
        }
        return out;
    }

    private ToResources(raw: any): Resources {
        return new Resources({
            Metal: raw?.metal ?? 0,
            Crystal: raw?.crystal ?? 0,
            Deuterium: raw?.deuterium ?? 0,
            Energy: raw?.energy ?? 0
        });
    }

    private ToProduction(raw: any): Production {
        const hourly = this.ToResources(raw);
        const scale = (f: number) =>
            new Resources({ Metal: hourly.Metal * f, Crystal: hourly.Crystal * f, Deuterium: hourly.Deuterium * f, Energy: hourly.Energy });
        return new Production({ Hourly: hourly, Daily: scale(24), Weekly: scale(168) });
    }

    private ToCoordinates(raw: any): Coordinates {
        return new Coordinates(true, `${raw.galaxy}:${raw.system}:${raw.position}`);
    }

    private ToPercentRatio(value: unknown): number {
        if (typeof value === "number") return value / 100;
        if (typeof value !== "string") return 0;
        const match = /^(.*?)(?:[.,](\d{1,2}))?$/.exec(value.replace("%", "").trim());
        if (!match) return 0;
        const parsed = parseFloat(`${match[1].replace(/[.,\s]/g, "")}.${match[2] ?? "0"}`);
        return isNaN(parsed) ? 0 : parsed / 100;
    }

    private ToBuff(raw: any): Buff {
        const { scope, type, bonus } = this.buffTypeFromUuid(raw.itemUuid);
        return new Buff({
            Scope: scope,
            Type: type,
            Bonus: bonus,
            ItemUuid: raw.itemUuid,
            Name: raw.name,
            BuffEnd: raw.buffEnd ?? undefined
        });
    }

    private buffTypeFromUuid(uuid: string): { scope: BuffScope, type: BuffType, bonus: number } {
        return BUFF_TYPES[uuid] ?? { scope: BuffScope.Unknown, type: BuffType.Unknown, bonus: 0 };
    }

    public ParseTechsLocalizations(lifeformBonuses: any): Record<number, string> | undefined {
        const technologies = lifeformBonuses?.static?.technologies;
        if (!technologies || typeof technologies !== 'object') {
            return undefined;
        }

        const result: Record<number, string> = {};

        for (const tech of Object.values<any>(technologies)) {
            if (tech?.id && tech?.name) {
                result[tech.id] = String(tech.name).trim();
            }
        }

        return result;
    }

    public ParseLifeformBonuses(lifeformBonuses: any): LifeformBonuses | undefined {
        const rawData = lifeformBonuses?.data;
        if (!rawData || typeof rawData !== 'object') return undefined;

        // 1. Species
        const species: Record<number, SpeciesInfo> = {};
        for (const s of lifeformBonuses?.speciesInformation ?? []) {
            const id = Number(s.id);
            if (!isNaN(id)) {
                species[id] = new SpeciesInfo({
                    Level: Number(s.level ?? 0),
                    Xp: Number(s.xp ?? 0),
                    XpToNextLevel: Number(s.xpToNextLevel ?? 0),
                    Bonus: Number(s.bonus ?? 0)
                });
            }
        }

        // 2. Production & Resources
        const res = rawData.resources ?? {};
        const productionBonus = new ProductionBonus({
            Metal: Number(res.metal?.totalBonus?.metal ?? 0),
            Crystal: Number(res.crystal?.totalBonus?.crystal ?? 0),
            Deuterium: Number(res.deuterium?.totalBonus?.deuterium ?? 0),
            Energy: Number(res.energy?.totalBonus?.energy ?? 0),
            Population: Number(res.population?.totalBonus?.population ?? 0),
            Food: Number(res.food?.totalBonus?.food ?? 0),
            Storage: Number(res.storage?.totalBonus?.storage ?? 0)
        });

        // 3. Ships & Defenses
        const shipsBonus: Record<number, ShipBonus> = {};
        if (rawData.ships) {
            for (const [id, item] of Object.entries<any>(rawData.ships)) {
                const b = item.totalBonus ?? {};
                shipsBonus[Number(id)] = new ShipBonus({
                    Armor: Number(b.armor ?? 0),
                    Shield: Number(b.shield ?? 0),
                    Weapon: Number(b.weapon ?? 0),
                    Speed: Number(b.speed ?? 0),
                    Cargo: Number(b.cargo ?? 0),
                    Fuel: Number(b.fuel ?? 0)
                });
            }
        }

        const defensesBonus: Record<number, DefenseBonus> = {};
        if (rawData.defenses) {
            for (const [id, item] of Object.entries<any>(rawData.defenses)) {
                const b = item.totalBonus ?? {};
                defensesBonus[Number(id)] = new DefenseBonus({
                    Armor: Number(b.armor ?? 0),
                    Shield: Number(b.shield ?? 0),
                    Weapon: Number(b.weapon ?? 0)
                });
            }
        }

        // 4. Expedition
        const exp = rawData.expedition ?? {};
        const expeditionBonus = new ExpeditionBonus({
            ShipResultBooster: Number(exp.ShipResultBooster?.totalBonus?.ShipResultBooster ?? 0),
            DMBooster: Number(exp.DMBooster?.totalBonus?.DMBooster ?? 0),
            EnemyReducer: Number(exp.EnemyReducer?.totalBonus?.EnemyReducer ?? 0),
            FleetLostReducer: Number(exp.FleetLostReducer?.totalBonus?.FleetLostReducer ?? 0),
            ResultBooster: Number(exp.ResultBooster?.totalBonus?.ResultBooster ?? 0),
            SpeedBooster: Number(exp.SpeedBooster?.totalBonus?.SpeedBooster ?? 0)
        });

        // 5. Cost / Time Reductions
        const costRed = rawData.costreduction ?? {};
        const techCost: Record<number, number> = {};
        const techTime: Record<number, number> = {};

        for (const [key, item] of Object.entries<any>(costRed)) {
            const techId = Number(key);
            if (!isNaN(techId)) {
                techCost[techId] = Number(item.totalBonus?.cost ?? 0);
                techTime[techId] = Number(item.totalBonus?.time ?? 0);
            }
        }

        // 6. Misc
        const misc = rawData.misc ?? {};
        const miscBonus = new MiscBonus({
            DiscoveryBonus: Number(misc.discoveryBonus?.totalBonus?.discoveryBonus ?? 0),
            FuelPayback: Number(misc.fuelPayback?.totalBonus?.fuelPayback ?? 0),
            PhalanxRangeBoost: Number(misc.phalanxRangeBoost?.totalBonus?.phalanxRangeBoost ?? 0),
            BuggyBonus: new CrawlerBonus({
                Production: Number(misc.buggyBonus?.totalBonus?.buggyBonus ?? 0),
                Consumption: Number(misc.buggyBonus?.totalBonus?.consumption ?? 0)
            })
        });

        // 7. Character Classes (601: Mineur, 602: Guerrier, 603: Explorateur)
        const classes = rawData.characterclasses ?? {};

        const minerNode = classes['601'] ?? {};
        const warriorNode = classes['602'] ?? {};
        const explorerNode = classes['603'] ?? {};

        const classBonus = new ClassBonus({
            MinerInfo: this.parseClassBonusInfo(minerNode),
            WarriorInfo: this.parseClassBonusInfo(warriorNode),
            ExplorerInfo: this.parseClassBonusInfo(explorerNode),

            Miner: this.parseMinerBonus(minerNode.details ?? []),
            Warrior: this.parseWarriorBonus(warriorNode.details ?? []),
            Explorer: this.parseExplorerBonus(explorerNode.details ?? [])
        });

        return new LifeformBonuses({
            species,
            productionBonus,
            shipsBonus,
            defensesBonus,
            expeditionBonus,
            technologyCostReduction: new TechnologyBonus(techCost),
            technologyTimeReduction: new TechnologyBonus(techTime),
            classBonus,
            miscBonus
        });
    }

    private parseClassBonusInfo(node: any): ClassBonusInfo {
        if (!node) return new ClassBonusInfo();

        const details = (node.details ?? []).map(
            (d: any) =>
                new ClassBonusDetail({
                    name: d.name,
                    nameKey: d.nameKey,
                    withBonus: d.withBonus,
                    withBonusValue: d.withBonusValue,
                    withoutBonus: d.withoutBonus,
                    withoutBonusValue: d.withoutBonusValue
                })
        );

        const TotalBonus = Number(node.totalBonus?.characterClass ?? 0);

        return new ClassBonusInfo({
            Details: details,
            TotalBonus: TotalBonus
        });
    }

    private parseExplorerBonus(details: any[]): ExplorerClassBonus {
        const map = new Map<string, any>(details.map(d => [d.nameKey, d.withBonusValue]));
        return new ExplorerClassBonus({
            research: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_RESEARCH_NAME")),
            expedition: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_EXPEDITION_NAME")),
            colonization: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_COLONIZATION_NAME")),
            expeditionSlots: Number(map.get("LOCA_CHARACTER_CLASS_BONUS_EXPEDITION_SLOT_NAME") ?? 0),
            enemyReduction: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_EXPEDITION_ENEMY_REDUCTION_NAME")),
            phalanxRange: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_PHALANX_RANGE_NAME")),
            plunderInactive: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_PLUNDER_INACTIVE_NAME"))
        });
    }

    private parseMinerBonus(details: any[]): MinerClassBonus {
        const map = new Map<string, any>(details.map(d => [d.nameKey, d.withBonusValue]));
        return new MinerClassBonus({
            resourceProduction: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_RESOURCE_NAME")),
            energyProduction: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_ENERGY_NAME")),
            crawlerBonus: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_RESOURCE_BUGGY_NAME")),
            transporterSpeed: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_TRADINGSHIP_SPEED_NAME")),
            transporterCargo: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_TRADINGSHIP_CARGO_CAPACITY_NAME")),
            maxCrawlerBonus: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_MAX_BUGGY_NAME"))
        });
    }

    private parseWarriorBonus(details: any[]): WarriorClassBonus {
        const map = new Map<string, any>(details.map(d => [d.nameKey, d.withBonusValue]));
        return new WarriorClassBonus({
            combatShipSpeed: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_COMBATSHIP_SPEED_NAME")),
            recyclerSpeed: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_RECYCLER_SPEED_NAME")),
            recyclerCargo: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_RECYCLING_CARGO_CAPACITY_NAME")),
            fuelConsumption: this.ToPercentRatio(map.get("LOCA_CHARACTER_CLASS_BONUS_FUEL_CONSUMPTION_NAME")),
            combatResearch: Number(map.get("LOCA_CHARACTER_CLASS_BONUS_COMBAT_RESEARCH_NAME") ?? 0),
            fleetSlots: Number(map.get("LOCA_CHARACTER_CLASS_BONUS_FLEET_SLOT_NAME") ?? 0),
            moonFields: Number(map.get("LOCA_CHARACTER_CLASS_BONUS_MOON_FIELD_NAME") ?? 0)
        });
    }
}