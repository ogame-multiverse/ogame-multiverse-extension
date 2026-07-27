import { ResourcesCost } from "./resourcesCost";
import { LifeformType } from "./enums/lifeformType";
import { TechType, BuildingType, ResearchType, LifeformBuildingType, LifeformResearchType, DefenceType, ShipType } from "./enums/techTypes";
export class Tech {
  public Type: TechType;
  public LifeformType?: LifeformType;
  public Id: number;
  public Name: string;
  public BaseCost: ResourcesCost;
  public RequiredLabLevel: number;
  constructor(data: Partial<Tech>) {
    this.Type = data.Type;
    this.LifeformType = data.LifeformType;
    this.Id = data.Id;
    this.Name = data.Name;
    this.BaseCost = data.BaseCost || new ResourcesCost({});
    this.RequiredLabLevel = data.RequiredLabLevel || 0;
  }

  public static GetLifeformBuildings(lifeformType: LifeformType): Tech[] {
    return Techs.filter((t) => t.Type === TechType.LifeformBuilding && t.LifeformType === lifeformType);
  }

  public static Get(id: number): Tech | undefined {
    return Techs.find((t) => t.Id === id);
  }

  public static DefaultFleet(): Record<ShipType, number> {
    const fleet: Record<ShipType, number> = {
      [ShipType.SmallCargoShip]: 0,
      [ShipType.LargeCargoShip]: 0,
      [ShipType.LightFighter]: 0,
      [ShipType.HeavyFighter]: 0,
      [ShipType.Cruiser]: 0,
      [ShipType.Battleship]: 0,
      [ShipType.ColonyShip]: 0,
      [ShipType.Recycler]: 0,
      [ShipType.EspionageProbe]: 0,
      [ShipType.Bomber]: 0,
      [ShipType.SolarSatellite]: 0,
      [ShipType.Destroyer]: 0,
      [ShipType.DeathStar]: 0,
      [ShipType.Battlecruiser]: 0,
      [ShipType.Crawler]: 0,
      [ShipType.Reaper]: 0,
      [ShipType.Pathfinder]: 0,
    };
    return fleet;
  }

  public static DefaultDefence(): Record<DefenceType, number> {
    const defence: Record<DefenceType, number> = {
      [DefenceType.RocketLauncher]: 0,
      [DefenceType.LightLaser]: 0,
      [DefenceType.HeavyLaser]: 0,
      [DefenceType.GaussCannon]: 0,
      [DefenceType.IonCannon]: 0,
      [DefenceType.PlasmaTurret]: 0,
      [DefenceType.SmallShieldDome]: 0,
      [DefenceType.LargeShieldDome]: 0,
      [DefenceType.AntiBallisticMissiles]: 0,
      [DefenceType.InterplanetaryMissiles]: 0,
    };
    return defence;
  }
}



export const Techs: Tech[] = [
  /* BUILDINGS */

  // Supplies
  new Tech({ Type: TechType.Building, Id: BuildingType.MetalMine, Name: "Metal Mine", BaseCost: new ResourcesCost({ Metal: 60, Crystal: 15, Deuterium: 0, ResourcesFactor: 1.5, EnergyConsumption: 10, EnergyConsumptionFactor: 1.1 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.CrystalMine, Name: "Crystal Mine", BaseCost: new ResourcesCost({ Metal: 48, Crystal: 24, Deuterium: 0, ResourcesFactor: 1.6, EnergyConsumption: 10, EnergyConsumptionFactor: 1.1 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.DeuteriumSynthesizer, Name: "Deuterium Synthesizer", BaseCost: new ResourcesCost({ Metal: 225, Crystal: 75, Deuterium: 0, ResourcesFactor: 1.5, EnergyConsumption: 20, EnergyConsumptionFactor: 1.1 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.SolarPlant, Name: "Solar Plant", BaseCost: new ResourcesCost({ Metal: 75, Crystal: 30, Deuterium: 0, ResourcesFactor: 1.5 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.FusionPlant, Name: "Fusion Reactor", BaseCost: new ResourcesCost({ Metal: 900, Crystal: 360, Deuterium: 180, ResourcesFactor: 1.8, DeuteriumConsumption: 10, DeuteriumConsumptionFactor: 1.1 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.MetalStorage, Name: "Metal Storage", BaseCost: new ResourcesCost({ Metal: 1000, Crystal: 0, Deuterium: 0, ResourcesFactor: 2 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.CrystalStorage, Name: "Crystal Storage", BaseCost: new ResourcesCost({ Metal: 1000, Crystal: 500, Deuterium: 0, ResourcesFactor: 2 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.DeuteriumStorage, Name: "Deuterium storage", BaseCost: new ResourcesCost({ Metal: 1000, Crystal: 1000, Deuterium: 0, ResourcesFactor: 2 }) }),

  // Facilities
  new Tech({ Type: TechType.Building, Id: BuildingType.RoboticsFactory, Name: "Robotic Factory", BaseCost: new ResourcesCost({ Metal: 400, Crystal: 120, Deuterium: 200, ResourcesFactor: 2 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.NaniteFactory, Name: "Nanite Factory", BaseCost: new ResourcesCost({ Metal: 1000000, Crystal: 500000, Deuterium: 100000, ResourcesFactor: 2 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.Shipyard, Name: "Shipyard", BaseCost: new ResourcesCost({ Metal: 400, Crystal: 200, Deuterium: 100, ResourcesFactor: 2 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.ResearchLab, Name: "Research Lab", BaseCost: new ResourcesCost({ Metal: 200, Crystal: 400, Deuterium: 200, ResourcesFactor: 2 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.Terraformer, Name: "Terraformer", BaseCost: new ResourcesCost({ Metal: 0, Crystal: 50000, Deuterium: 100000, Energy: 1000, ResourcesFactor: 2, EnergyFactor: 2 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.AllianceDepot, Name: "Alliance Depot", BaseCost: new ResourcesCost({ Metal: 20000, Crystal: 40000, Deuterium: 0, ResourcesFactor: 2 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.RepairDock, Name: "Space Dock", BaseCost: new ResourcesCost({ Metal: 200, Crystal: 0, Deuterium: 50, Energy: 50, ResourcesFactor: 5, EnergyFactor: 2.5 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.MissileSilo, Name: "Missile Silo", BaseCost: new ResourcesCost({ Metal: 20000, Crystal: 20000, Deuterium: 1000, ResourcesFactor: 2 }) }),

  // Moon
  new Tech({ Type: TechType.Building, Id: BuildingType.MoonBase, Name: "Lunar Base", BaseCost: new ResourcesCost({ Metal: 20000, Crystal: 40000, Deuterium: 20000, ResourcesFactor: 2 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.SensorPhalanx, Name: "Phalanx", BaseCost: new ResourcesCost({ Metal: 20000, Crystal: 40000, Deuterium: 20000, ResourcesFactor: 2 }) }),
  new Tech({ Type: TechType.Building, Id: BuildingType.JumpGate, Name: "Star gate", BaseCost: new ResourcesCost({ Metal: 2000000, Crystal: 4000000, Deuterium: 2000000, ResourcesFactor: 2 }) }),


  /* RESEARCH */

  new Tech({ Type: TechType.Research, Id: ResearchType.Espionage, Name: "Espionnage Technology", BaseCost: new ResourcesCost({ Metal: 200, Crystal: 1000, Deuterium: 200, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 3}),
  new Tech({ Type: TechType.Research, Id: ResearchType.Computer, Name: "Computer Technology", BaseCost: new ResourcesCost({ Metal: 0, Crystal: 400, Deuterium: 600, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 1 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.Weapons, Name: "Weapons Technology", BaseCost: new ResourcesCost({ Metal: 800, Crystal: 200, Deuterium: 0, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 4 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.Shielding, Name: "Shielding Technology", BaseCost: new ResourcesCost({ Metal: 200, Crystal: 600, Deuterium: 0, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 3 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.Armour, Name: "Armour Technology", BaseCost: new ResourcesCost({ Metal: 1000, Crystal: 0, Deuterium: 0, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 2 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.Energy, Name: "Energy Technology", BaseCost: new ResourcesCost({ Metal: 0, Crystal: 800, Deuterium: 400, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 1 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.Hyperspace, Name: "Hyperspace Technology", BaseCost: new ResourcesCost({ Metal: 0, Crystal: 4000, Deuterium: 2000, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 7 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.CombustionDrive, Name: "Combustion Drive", BaseCost: new ResourcesCost({ Metal: 400, Crystal: 0, Deuterium: 600, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 1 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.ImpulseDrive, Name: "Impulse Drive", BaseCost: new ResourcesCost({ Metal: 2000, Crystal: 4000, Deuterium: 600, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 2 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.HyperspaceDrive, Name: "Hyperspace Drive", BaseCost: new ResourcesCost({ Metal: 10000, Crystal: 20000, Deuterium: 6000, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 7 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.Laser, Name: "Laser Technology", BaseCost: new ResourcesCost({ Metal: 200, Crystal: 100, Deuterium: 0, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 1 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.Ion, Name: "Ion Technology", BaseCost: new ResourcesCost({ Metal: 1000, Crystal: 300, Deuterium: 100, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 4 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.Plasma, Name: "Plasma Technology", BaseCost: new ResourcesCost({ Metal: 2000, Crystal: 4000, Deuterium: 1000, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 4 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.IntergalacticResearchNetwork, Name: "Intergalactic Research Network", BaseCost: new ResourcesCost({ Metal: 240000, Crystal: 400000, Deuterium: 160000, ResourcesFactor: 2, TimeFactor: 2 }), RequiredLabLevel: 10 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.Astrophysics, Name: "Astrophysics", BaseCost: new ResourcesCost({ Metal: 4000, Crystal: 8000, Deuterium: 4000, ResourcesFactor: 1.75, TimeFactor: 2 }), RequiredLabLevel: 3 }),
  new Tech({ Type: TechType.Research, Id: ResearchType.Graviton, Name: "Graviton Technology", BaseCost: new ResourcesCost({ Metal: 0, Crystal: 0, Deuterium: 0, Energy: 300000, ResourcesFactor: 2, EnergyFactor: 3, TimeFactor: 2 }), RequiredLabLevel: 12 }),


  /* LIFEFORM BUILDINGS */

  // Humans
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Humans, Id: LifeformBuildingType.Humans_Quarters, Name: "Residental Sector", BaseCost: new ResourcesCost({ Metal: 7, Crystal: 2, Deuterium: 0, ResourcesFactor: 1.2, Time: 40, TimeFactor: 1.21 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Humans, Id: LifeformBuildingType.Humans_Farm, Name: "Biosphere Farm", BaseCost: new ResourcesCost({ Metal: 5, Crystal: 2, Deuterium: 0, Energy: 8, ResourcesFactor: 1.23, EnergyFactor: 1.02, Time: 40, TimeFactor: 1.25 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Humans, Id: LifeformBuildingType.Humans_TechBuilding, Name: "Research Centre", BaseCost: new ResourcesCost({ Metal: 20000, Crystal: 25000, Deuterium: 10000, ResourcesFactor: 1.3, Time: 16000, TimeFactor: 1.25, EnergyConsumption: 10, EnergyConsumptionFactor: 1.08 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Humans, Id: LifeformBuildingType.Humans_School, Name: "Academy of Sciences", BaseCost: new ResourcesCost({ Metal: 5000, Crystal: 3200, Deuterium: 1500, ResourcesFactor: 1.7, Time: 16000, TimeFactor: 1.6, Population: 20000000, PopulationFactor: 1.1, EnergyConsumption: 15, EnergyConsumptionFactor: 1.25 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Humans, Id: LifeformBuildingType.Humans_HighSchool, Name: "Neuro-Calibration Centre", BaseCost: new ResourcesCost({ Metal: 50000, Crystal: 40000, Deuterium: 50000, ResourcesFactor: 1.7, Time: 64000, TimeFactor: 1.7, Population: 100000000, PopulationFactor: 1.1, EnergyConsumption: 30, EnergyConsumptionFactor: 1.25 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Humans, Id: LifeformBuildingType.Humans_ResourceBooster_Metal, Name: "High Energy Smelting", BaseCost: new ResourcesCost({ Metal: 9000, Crystal: 6000, Deuterium: 3000, ResourcesFactor: 1.5, Time: 2000, TimeFactor: 1.3, EnergyConsumption: 40, EnergyConsumptionFactor: 1.1 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Humans, Id: LifeformBuildingType.Humans_LifeSupport, Name: "Food Silo", BaseCost: new ResourcesCost({ Metal: 25000, Crystal: 13000, Deuterium: 7000, ResourcesFactor: 1.09, Time: 12000, TimeFactor: 1.17 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Humans, Id: LifeformBuildingType.Humans_ResourceBooster_CrystalDeuterium, Name: "Fusion-Powered Production", BaseCost: new ResourcesCost({ Metal: 50000, Crystal: 25000, Deuterium: 15000, ResourcesFactor: 1.5, Time: 28000, TimeFactor: 1.2, EnergyConsumption: 80, EnergyConsumptionFactor: 1.1 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Humans, Id: LifeformBuildingType.Humans_LifeSupport_Advanced, Name: "Skyscraper", BaseCost: new ResourcesCost({ Metal: 75000, Crystal: 20000, Deuterium: 25000, ResourcesFactor: 1.09, Time: 40000, TimeFactor: 1.2, EnergyConsumption: 50, EnergyConsumptionFactor: 1.02 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Humans, Id: LifeformBuildingType.Humans_ResourceBooster_Food, Name: "Biotech Lab", BaseCost: new ResourcesCost({ Metal: 150000, Crystal: 30000, Deuterium: 15000, ResourcesFactor: 1.12, Time: 52000, TimeFactor: 1.2, EnergyConsumption: 60, EnergyConsumptionFactor: 1.03 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Humans, Id: LifeformBuildingType.Humans_TechTreeBooster, Name: "Metropolis", BaseCost: new ResourcesCost({ Metal: 80000, Crystal: 35000, Deuterium: 60000, ResourcesFactor: 1.5, Time: 90000, TimeFactor: 1.3, EnergyConsumption: 90, EnergyConsumptionFactor: 1.05 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Humans, Id: LifeformBuildingType.Humans_LifeFormProtection, Name: "Planetary Shield", BaseCost: new ResourcesCost({ Metal: 250000, Crystal: 125000, Deuterium: 125000, ResourcesFactor: 1.15, Time: 95000, TimeFactor: 1.2, EnergyConsumption: 100, EnergyConsumptionFactor: 1.02 }) }),

  // Rock'tal
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Rocktal, Id: LifeformBuildingType.Rocktal_Quarters, Name: "Meditation Enclave", BaseCost: new ResourcesCost({ Metal: 9, Crystal: 3, Deuterium: 0, ResourcesFactor: 1.2, Time: 40, TimeFactor: 1.21 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Rocktal, Id: LifeformBuildingType.Rocktal_Farm, Name: "Crystal Farm", BaseCost: new ResourcesCost({ Metal: 7, Crystal: 2, Deuterium: 0, Energy: 10, ResourcesFactor: 1.2, EnergyFactor: 1.03, Time: 40, TimeFactor: 1.21 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Rocktal, Id: LifeformBuildingType.Rocktal_TechBuilding, Name: "Rune Technologium", BaseCost: new ResourcesCost({ Metal: 40000, Crystal: 10000, Deuterium: 15000, ResourcesFactor: 1.3, Time: 16000, TimeFactor: 1.25, EnergyConsumption: 15, EnergyConsumptionFactor: 1.1 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Rocktal, Id: LifeformBuildingType.Rocktal_School, Name: "Rune Forge", BaseCost: new ResourcesCost({ Metal: 5000, Crystal: 3800, Deuterium: 1000, ResourcesFactor: 1.7, Time: 16000, TimeFactor: 1.6, EnergyConsumption: 20, EnergyConsumptionFactor: 1.35, Population: 16000000, PopulationFactor: 1.14 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Rocktal, Id: LifeformBuildingType.Rocktal_HighSchool, Name: "Oriktorium", BaseCost: new ResourcesCost({ Metal: 50000, Crystal: 40000, Deuterium: 50000, ResourcesFactor: 1.65, Time: 64000, TimeFactor: 1.7, EnergyConsumption: 60, EnergyConsumptionFactor: 1.3, Population: 90000000, PopulationFactor: 1.1 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Rocktal, Id: LifeformBuildingType.Rocktal_ResourceBooster_Metal, Name: "Magma Forge", BaseCost: new ResourcesCost({ Metal: 10000, Crystal: 8000, Deuterium: 1000, ResourcesFactor: 1.4, Time: 2000, TimeFactor: 1.3, EnergyConsumption: 40, EnergyConsumptionFactor: 1.1 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Rocktal, Id: LifeformBuildingType.Rocktal_EnergyManipulator, Name: "Disruption Chamber", BaseCost: new ResourcesCost({ Metal: 20000, Crystal: 15000, Deuterium: 10000, ResourcesFactor: 1.2, Time: 16000, TimeFactor: 1.25 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Rocktal, Id: LifeformBuildingType.Rocktal_CostReductionRocktalBuildings, Name: "Megalith", BaseCost: new ResourcesCost({ Metal: 50000, Crystal: 35000, Deuterium: 15000, ResourcesFactor: 1.5, Time: 40000, TimeFactor: 1.4, EnergyConsumption: 80, EnergyConsumptionFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Rocktal, Id: LifeformBuildingType.Rocktal_ResourceBooster_Crystal, Name: "Crystal Refinery", BaseCost: new ResourcesCost({ Metal: 85000, Crystal: 44000, Deuterium: 25000, ResourcesFactor: 1.4, Time: 40000, TimeFactor: 1.2, EnergyConsumption: 90, EnergyConsumptionFactor: 1.1 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Rocktal, Id: LifeformBuildingType.Rocktal_ResourceBooster_Deuterium, Name: "Deuterium Synthesiser", BaseCost: new ResourcesCost({ Metal: 120000, Crystal: 50000, Deuterium: 20000, ResourcesFactor: 1.4, Time: 52000, TimeFactor: 1.2, EnergyConsumption: 90, EnergyConsumptionFactor: 1.1 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Rocktal, Id: LifeformBuildingType.Rocktal_CostReductionProductionBuildings, Name: "Mineral Research Centre", BaseCost: new ResourcesCost({ Metal: 250000, Crystal: 150000, Deuterium: 100000, ResourcesFactor: 1.8, Time: 90000, TimeFactor: 1.3, EnergyConsumption: 120, EnergyConsumptionFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Rocktal, Id: LifeformBuildingType.Rocktal_RecycleAttackerFleet, Name: "Advanced Recycling Plant", BaseCost: new ResourcesCost({ Metal: 250000, Crystal: 125000, Deuterium: 125000, ResourcesFactor: 1.5, Time: 95000, TimeFactor: 1.3, EnergyConsumption: 100, EnergyConsumptionFactor: 1.1 }) }),

  // Mechas
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Mechas, Id: LifeformBuildingType.Mechas_Quarters, Name: "Assembly Line", BaseCost: new ResourcesCost({ Metal: 6, Crystal: 2, Deuterium: 0, ResourcesFactor: 1.21, Time: 40, TimeFactor: 1.22 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Mechas, Id: LifeformBuildingType.Mechas_Farm, Name: "Fusion Cell Factory", BaseCost: new ResourcesCost({ Metal: 5, Crystal: 2, Deuterium: 0, Energy: 8, ResourcesFactor: 1.18, EnergyFactor: 1.02, Time: 48, TimeFactor: 1.2 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Mechas, Id: LifeformBuildingType.Mechas_TechBuilding, Name: "Robotics Research Centre", BaseCost: new ResourcesCost({ Metal: 30000, Crystal: 20000, Deuterium: 10000, ResourcesFactor: 1.3, Time: 16000, TimeFactor: 1.25, EnergyConsumption: 13, EnergyConsumptionFactor: 1.08 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Mechas, Id: LifeformBuildingType.Mechas_School, Name: "Update Network", BaseCost: new ResourcesCost({ Metal: 5000, Crystal: 3800, Deuterium: 1000, ResourcesFactor: 1.8, Time: 16000, TimeFactor: 1.6, EnergyConsumption: 10, EnergyConsumptionFactor: 1.2, Population: 40000000, PopulationFactor: 1.1 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Mechas, Id: LifeformBuildingType.Mechas_HighSchool, Name: "Quantum Computer Centre", BaseCost: new ResourcesCost({ Metal: 50000, Crystal: 40000, Deuterium: 50000, ResourcesFactor: 1.8, Time: 64000, TimeFactor: 1.7, EnergyConsumption: 40, EnergyConsumptionFactor: 1.2, Population: 130000000, PopulationFactor: 1.1 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Mechas, Id: LifeformBuildingType.Mechas_ProductionSpeedShips, Name: "Automatised Assembly Centre", BaseCost: new ResourcesCost({ Metal: 7500, Crystal: 7000, Deuterium: 1000, ResourcesFactor: 1.3, Time: 2000, TimeFactor: 1.3, EnergyConsumption: 40, EnergyConsumptionFactor: 1.1 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Mechas, Id: LifeformBuildingType.Mechas_TechTreeBooster, Name: "High-Performance Transformer", BaseCost: new ResourcesCost({ Metal: 35000, Crystal: 15000, Deuterium: 10000, ResourcesFactor: 1.5, Time: 16000, TimeFactor: 1.4, EnergyConsumption: 40, EnergyConsumptionFactor: 1.05 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Mechas, Id: LifeformBuildingType.Mechas_ResourceBooster, Name: "Microchip Assembly Line", BaseCost: new ResourcesCost({ Metal: 50000, Crystal: 20000, Deuterium: 30000, ResourcesFactor: 1.07, Time: 12000, TimeFactor: 1.17, EnergyConsumption: 40, EnergyConsumptionFactor: 1.01 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Mechas, Id: LifeformBuildingType.Mechas_LifeSupport, Name: "Production Assembly Hall", BaseCost: new ResourcesCost({ Metal: 100000, Crystal: 10000, Deuterium: 3000, ResourcesFactor: 1.14, Time: 40000, TimeFactor: 1.3, EnergyConsumption: 80, EnergyConsumptionFactor: 1.04 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Mechas, Id: LifeformBuildingType.Mechas_ResourceBooster_Deuterium, Name: "High-Performance Synthesiser", BaseCost: new ResourcesCost({ Metal: 100000, Crystal: 40000, Deuterium: 20000, ResourcesFactor: 1.5, Time: 52000, TimeFactor: 1.2, EnergyConsumption: 60, EnergyConsumptionFactor: 1.1 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Mechas, Id: LifeformBuildingType.Mechas_TechTreeBooster_Alt, Name: "Chip Mass Production", BaseCost: new ResourcesCost({ Metal: 55000, Crystal: 50000, Deuterium: 30000, ResourcesFactor: 1.5, Time: 50000, TimeFactor: 1.3, EnergyConsumption: 70, EnergyConsumptionFactor: 1.05 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Mechas, Id: LifeformBuildingType.Mechas_SpaceDockExtender, Name: "Nano Repair Bots", BaseCost: new ResourcesCost({ Metal: 250000, Crystal: 125000, Deuterium: 125000, ResourcesFactor: 1.4, Time: 95000, TimeFactor: 1.4, EnergyConsumption: 100, EnergyConsumptionFactor: 1.05 }) }),

  // Kaelesh
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Kaelesh, Id: LifeformBuildingType.Kaelesh_Quarters, Name: "Sanctuary", BaseCost: new ResourcesCost({ Metal: 4, Crystal: 3, Deuterium: 0, ResourcesFactor: 1.21, Time: 40, TimeFactor: 1.22 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Kaelesh, Id: LifeformBuildingType.Kaelesh_Farm, Name: "Antimatter Condenser", BaseCost: new ResourcesCost({ Metal: 6, Crystal: 3, Deuterium: 0, Energy: 9, ResourcesFactor: 1.2, EnergyFactor: 1.02, Time: 40, TimeFactor: 1.22 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Kaelesh, Id: LifeformBuildingType.Kaelesh_TechBuilding, Name: "Vortex Chamber", BaseCost: new ResourcesCost({ Metal: 20000, Crystal: 15000, Deuterium: 15000, ResourcesFactor: 1.3, Time: 16000, TimeFactor: 1.25, EnergyConsumption: 10, EnergyConsumptionFactor: 1.08 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Kaelesh, Id: LifeformBuildingType.Kaelesh_School, Name: "Halls of Realisation", BaseCost: new ResourcesCost({ Metal: 7500, Crystal: 5000, Deuterium: 800, ResourcesFactor: 1.8, Time: 16000, TimeFactor: 1.7, EnergyConsumption: 15, EnergyConsumptionFactor: 1.3, Population: 30000000, PopulationFactor: 1.1 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Kaelesh, Id: LifeformBuildingType.Kaelesh_HighSchool, Name: "Forum of Transcendence", BaseCost: new ResourcesCost({ Metal: 60000, Crystal: 30000, Deuterium: 50000, ResourcesFactor: 1.8, Time: 64000, TimeFactor: 1.8, EnergyConsumption: 30, EnergyConsumptionFactor: 1.3, Population: 100000000, PopulationFactor: 1.1 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Kaelesh, Id: LifeformBuildingType.Kaelesh_LifeSupport, Name: "Antimatter Convector", BaseCost: new ResourcesCost({ Metal: 8500, Crystal: 5000, Deuterium: 3000, ResourcesFactor: 1.25, Time: 2000, TimeFactor: 1.35 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Kaelesh, Id: LifeformBuildingType.Kaelesh_LifeSupportAndResearch, Name: "Cloning Laboratory", BaseCost: new ResourcesCost({ Metal: 15000, Crystal: 15000, Deuterium: 5000, ResourcesFactor: 1.2, Time: 12000, TimeFactor: 1.2 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Kaelesh, Id: LifeformBuildingType.Kaelesh_LifeSupport_Alt, Name: "Chrysalis Accelerator", BaseCost: new ResourcesCost({ Metal: 75000, Crystal: 25000, Deuterium: 30000, ResourcesFactor: 1.05, Time: 16000, TimeFactor: 1.18, EnergyConsumption: 30, EnergyConsumptionFactor: 1.03 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Kaelesh, Id: LifeformBuildingType.Kaelesh_PlanetFieldsBooster, Name: "Bio Modifier", BaseCost: new ResourcesCost({ Metal: 87500, Crystal: 25000, Deuterium: 30000, ResourcesFactor: 1.2, Time: 40000, TimeFactor: 1.2, EnergyConsumption: 40, EnergyConsumptionFactor: 1.02 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Kaelesh, Id: LifeformBuildingType.Kaelesh_UnlockCondition, Name: "Psionic Modulator", BaseCost: new ResourcesCost({ Metal: 150000, Crystal: 30000, Deuterium: 30000, ResourcesFactor: 1.4, Time: 52000, TimeFactor: 1.8, EnergyConsumption: 140, EnergyConsumptionFactor: 1.05 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Kaelesh, Id: LifeformBuildingType.Kaelesh_ProductionSpeedShips, Name: "Ship Manufacturing Hall", BaseCost: new ResourcesCost({ Metal: 75000, Crystal: 50000, Deuterium: 55055, ResourcesFactor: 1.2, Time: 90000, TimeFactor: 1.3, EnergyConsumption: 90, EnergyConsumptionFactor: 1.04 }) }),
  new Tech({ Type: TechType.LifeformBuilding, LifeformType: LifeformType.Kaelesh, Id: LifeformBuildingType.Kaelesh_MoonChanceIncrease, Name: "Supra Refractor", BaseCost: new ResourcesCost({ Metal: 500000, Crystal: 250000, Deuterium: 250000, ResourcesFactor: 1.4, Time: 95000, TimeFactor: 1.3, EnergyConsumption: 100, EnergyConsumptionFactor: 1.05 }) }),



  /* LIFEFORM RESEARCH */


  // Humans
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_Discoverer, Name: "Intergalactic Envoys", BaseCost: new ResourcesCost({ Metal: 5000, Crystal: 2500, Deuterium: 500, ResourcesFactor: 1.3, Time: 1000, TimeFactor: 1.2 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_ProductionBooster, Name: "High-Performance Extractors", BaseCost: new ResourcesCost({ Metal: 7000, Crystal: 10000, Deuterium: 5000, ResourcesFactor: 1.5, Time: 2000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_BaseStatsBooster, Name: "Fusion Drives", BaseCost: new ResourcesCost({ Metal: 15000, Crystal: 10000, Deuterium: 5000, ResourcesFactor: 1.3, Time: 2500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_CostReduction, Name: "Stealth Field Generator", BaseCost: new ResourcesCost({ Metal: 20000, Crystal: 15000, Deuterium: 7500, ResourcesFactor: 1.3, Time: 3500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_DenCapacityBooster, Name: "Orbital Den", BaseCost: new ResourcesCost({ Metal: 25000, Crystal: 20000, Deuterium: 10000, ResourcesFactor: 1.3, Time: 4500, TimeFactor: 1.2 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_ResearchSpeed, Name: "Research AI", BaseCost: new ResourcesCost({ Metal: 35000, Crystal: 25000, Deuterium: 15000, ResourcesFactor: 1.5, Time: 5000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_CostReduction_2, Name: "High-Performance Terraformer", BaseCost: new ResourcesCost({ Metal: 70000, Crystal: 40000, Deuterium: 20000, ResourcesFactor: 1.3, Time: 8000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_ProductionBooster_2, Name: "Enhanced Production Technologies", BaseCost: new ResourcesCost({ Metal: 80000, Crystal: 50000, Deuterium: 20000, ResourcesFactor: 1.5, Time: 6000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_BaseStatsBooster_2, Name: "Light Fighter Mk II", BaseCost: new ResourcesCost({ Metal: 320000, Crystal: 240000, Deuterium: 100000, ResourcesFactor: 1.5, Time: 6500, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_BaseStatsBooster_3, Name: "Cruiser Mk II", BaseCost: new ResourcesCost({ Metal: 320000, Crystal: 240000, Deuterium: 100000, ResourcesFactor: 1.5, Time: 7000, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_ResearchSpeed_2, Name: "Improved Lab Technology", BaseCost: new ResourcesCost({ Metal: 120000, Crystal: 30000, Deuterium: 25000, ResourcesFactor: 1.5, Time: 7500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_CostReduction_3, Name: "Plasma Terraformer", BaseCost: new ResourcesCost({ Metal: 100000, Crystal: 40000, Deuterium: 30000, ResourcesFactor: 1.3, Time: 10000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_CostReduction_4, Name: "Low-Temperature Drives", BaseCost: new ResourcesCost({ Metal: 200000, Crystal: 100000, Deuterium: 100000, ResourcesFactor: 1.3, Time: 8500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_BaseStatsBooster_4, Name: "Bomber Mk II", BaseCost: new ResourcesCost({ Metal: 160000, Crystal: 120000, Deuterium: 50000, ResourcesFactor: 1.5, Time: 9000, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_CostReduction_5, Name: "Destroyer Mk II", BaseCost: new ResourcesCost({ Metal: 160000, Crystal: 120000, Deuterium: 50000, ResourcesFactor: 1.5, Time: 9500, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_BaseStatsBooster_5, Name: "Battlecruiser Mk II", BaseCost: new ResourcesCost({ Metal: 320000, Crystal: 240000, Deuterium: 100000, ResourcesFactor: 1.5, Time: 10000, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_ResearchSpeed_3, Name: "Robot Assistants", BaseCost: new ResourcesCost({ Metal: 300000, Crystal: 180000, Deuterium: 120000, ResourcesFactor: 1.5, Time: 11000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Humans, Id: LifeformResearchType.Humans_CostReduction_6, Name: "Supercomputer", BaseCost: new ResourcesCost({ Metal: 500000, Crystal: 300000, Deuterium: 200000, ResourcesFactor: 1.2, Time: 13000, TimeFactor: 1.3 }) }),

  // Rock'tal
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_ProductionBooster, Name: "Volcanic Batteries", BaseCost: new ResourcesCost({ Metal: 10000, Crystal: 6000, Deuterium: 1000, ResourcesFactor: 1.5, Time: 1000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_ProductionBooster_2, Name: "Acoustic Scanning", BaseCost: new ResourcesCost({ Metal: 7500, Crystal: 12500, Deuterium: 5000, ResourcesFactor: 1.5, Time: 2000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_ProductionBooster_3, Name: "High Energy Pump Systems", BaseCost: new ResourcesCost({ Metal: 15000, Crystal: 10000, Deuterium: 5000, ResourcesFactor: 1.5, Time: 2500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_BaseStatsBooster, Name: "Cargo Hold Expansion (Civilian Ships)", BaseCost: new ResourcesCost({ Metal: 20000, Crystal: 15000, Deuterium: 7500, ResourcesFactor: 1.3, Time: 3500, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_ProductionBooster_4, Name: "Magma-Powered Production", BaseCost: new ResourcesCost({ Metal: 25000, Crystal: 20000, Deuterium: 10000, ResourcesFactor: 1.5, Time: 4500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_ProductionBooster_5, Name: "Geothermal Power Plants", BaseCost: new ResourcesCost({ Metal: 50000, Crystal: 50000, Deuterium: 20000, ResourcesFactor: 1.5, Time: 5000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_ProductionBooster_6, Name: "Depth Sounding", BaseCost: new ResourcesCost({ Metal: 70000, Crystal: 40000, Deuterium: 20000, ResourcesFactor: 1.5, Time: 5500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_BaseStatsBooster_2, Name: "Ion Crystal Enhancement (Heavy Fighter)", BaseCost: new ResourcesCost({ Metal: 160000, Crystal: 120000, Deuterium: 50000, ResourcesFactor: 1.5, Time: 6000, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_CostReduction, Name: "Improved Stellarator", BaseCost: new ResourcesCost({ Metal: 75000, Crystal: 55000, Deuterium: 25000, ResourcesFactor: 1.5, Time: 6500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_ProductionBooster_7, Name: "Hardened Diamond Drill Heads", BaseCost: new ResourcesCost({ Metal: 85000, Crystal: 40000, Deuterium: 35000, ResourcesFactor: 1.5, Time: 7000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_ProductionBooster_8, Name: "Seismic Mining Technology", BaseCost: new ResourcesCost({ Metal: 120000, Crystal: 30000, Deuterium: 25000, ResourcesFactor: 1.5, Time: 7500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_ProductionBooster_9, Name: "Magma-Powered Pump Systems", BaseCost: new ResourcesCost({ Metal: 100000, Crystal: 40000, Deuterium: 30000, ResourcesFactor: 1.5, Time: 8000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_ImprovedCrawler, Name: "Ion Crystal Modules", BaseCost: new ResourcesCost({ Metal: 200000, Crystal: 100000, Deuterium: 100000, ResourcesFactor: 1.2, Time: 8500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_CostReduction_2, Name: "Optimised Silo Construction Method", BaseCost: new ResourcesCost({ Metal: 220000, Crystal: 110000, Deuterium: 110000, ResourcesFactor: 1.3, Time: 9000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_CostReduction_3, Name: "Diamond Energy Transmitter", BaseCost: new ResourcesCost({ Metal: 240000, Crystal: 120000, Deuterium: 120000, ResourcesFactor: 1.3, Time: 9500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_BaseStatsBooster_3, Name: "Obsidian Shield Reinforcement", BaseCost: new ResourcesCost({ Metal: 250000, Crystal: 250000, Deuterium: 250000, ResourcesFactor: 1.4, Time: 10000, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_CostReduction_4, Name: "Rune Shields", BaseCost: new ResourcesCost({ Metal: 500000, Crystal: 300000, Deuterium: 200000, ResourcesFactor: 1.5, Time: 13000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Rocktal, Id: LifeformResearchType.Rocktal_CharacterClassBooster, Name: "Rock’tal Collector Enhancement", BaseCost: new ResourcesCost({ Metal: 300000, Crystal: 180000, Deuterium: 120000, ResourcesFactor: 1.7, Time: 11000, TimeFactor: 1.4 }) }),

  // Mechas
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_ProductionBooster, Name: "Catalyser Technology", BaseCost: new ResourcesCost({ Metal: 10000, Crystal: 6000, Deuterium: 1000, ResourcesFactor: 1.5, Time: 1000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_BaseStatsBooster, Name: "Plasma Drive", BaseCost: new ResourcesCost({ Metal: 7500, Crystal: 12500, Deuterium: 5000, ResourcesFactor: 1.3, Time: 2000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_ShipFuelConsumption, Name: "Efficiency Module", BaseCost: new ResourcesCost({ Metal: 15000, Crystal: 10000, Deuterium: 5000, ResourcesFactor: 1.5, Time: 2500, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_CostReduction, Name: "Depot AI", BaseCost: new ResourcesCost({ Metal: 20000, Crystal: 15000, Deuterium: 7500, ResourcesFactor: 1.3, Time: 3500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_BaseStatsBooster_2, Name: "General Overhaul (Light Fighter)", BaseCost: new ResourcesCost({ Metal: 160000, Crystal: 120000, Deuterium: 50000, ResourcesFactor: 1.5, Time: 4500, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_ProductionBooster_2, Name: "Automated Transport Lines", BaseCost: new ResourcesCost({ Metal: 50000, Crystal: 50000, Deuterium: 20000, ResourcesFactor: 1.5, Time: 5000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_CostReduction_2, Name: "Improved Drone AI", BaseCost: new ResourcesCost({ Metal: 70000, Crystal: 40000, Deuterium: 20000, ResourcesFactor: 1.3, Time: 5500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_BaseStatsBooster_3, Name: "Experimental Recycling Technology", BaseCost: new ResourcesCost({ Metal: 160000, Crystal: 120000, Deuterium: 50000, ResourcesFactor: 1.5, Time: 6000, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_BaseStatsBooster_4, Name: "General Overhaul (Cruiser)", BaseCost: new ResourcesCost({ Metal: 160000, Crystal: 120000, Deuterium: 50000, ResourcesFactor: 1.5, Time: 6500, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_FleetReturnDeuterium, Name: "Slingshot Autopilot", BaseCost: new ResourcesCost({ Metal: 85000, Crystal: 40000, Deuterium: 35000, ResourcesFactor: 1.2, Time: 7000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_CostReduction_3, Name: "High-Temperature Superconductors", BaseCost: new ResourcesCost({ Metal: 120000, Crystal: 30000, Deuterium: 25000, ResourcesFactor: 1.3, Time: 7500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_BaseStatsBooster_5, Name: "General Overhaul (Battleship)", BaseCost: new ResourcesCost({ Metal: 160000, Crystal: 120000, Deuterium: 50000, ResourcesFactor: 1.5, Time: 8000, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_ProductionBooster_3, Name: "Artificial Swarm Intelligence", BaseCost: new ResourcesCost({ Metal: 200000, Crystal: 100000, Deuterium: 100000, ResourcesFactor: 1.5, Time: 8500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_BaseStatsBooster_6, Name: "General Overhaul (Battlecruiser)", BaseCost: new ResourcesCost({ Metal: 160000, Crystal: 120000, Deuterium: 50000, ResourcesFactor: 1.5, Time: 9000, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_BaseStatsBooster_7, Name: "General Overhaul (Bomber)", BaseCost: new ResourcesCost({ Metal: 320000, Crystal: 240000, Deuterium: 100000, ResourcesFactor: 1.5, Time: 9500, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_BaseStatsBooster_8, Name: "General Overhaul (Destroyer)", BaseCost: new ResourcesCost({ Metal: 320000, Crystal: 240000, Deuterium: 100000, ResourcesFactor: 1.5, Time: 10000, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_CostReduction_4, Name: "Experimental Weapons Technology", BaseCost: new ResourcesCost({ Metal: 500000, Crystal: 300000, Deuterium: 200000, ResourcesFactor: 1.5, Time: 13000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Mechas, Id: LifeformResearchType.Mechas_CharacterClassBooster, Name: "Mechan General Enhancement", BaseCost: new ResourcesCost({ Metal: 300000, Crystal: 180000, Deuterium: 120000, ResourcesFactor: 1.7, Time: 11000, TimeFactor: 1.4 }) }),

  // Kaelesh
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_ShipFuelConsumption, Name: "Heat Recovery", BaseCost: new ResourcesCost({ Metal: 10000, Crystal: 6000, Deuterium: 1000, ResourcesFactor: 1.5, Time: 1000, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_ProductionBooster, Name: "Sulphide Process", BaseCost: new ResourcesCost({ Metal: 7500, Crystal: 12500, Deuterium: 5000, ResourcesFactor: 1.5, Time: 2000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_ExpeditionFleetLossReduction, Name: "Psionic Network", BaseCost: new ResourcesCost({ Metal: 15000, Crystal: 10000, Deuterium: 5000, ResourcesFactor: 1.5, Time: 2500, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_ExpeditionShipsFoundBooster, Name: "Telekinetic Tractor Beam", BaseCost: new ResourcesCost({ Metal: 20000, Crystal: 15000, Deuterium: 7500, ResourcesFactor: 1.5, Time: 3500, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_ExpeditionBooster, Name: "Enhanced Sensor Technology", BaseCost: new ResourcesCost({ Metal: 25000, Crystal: 20000, Deuterium: 10000, ResourcesFactor: 1.5, Time: 4500, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_BaseStatsBooster, Name: "Neuromodal Compressor", BaseCost: new ResourcesCost({ Metal: 50000, Crystal: 50000, Deuterium: 20000, ResourcesFactor: 1.3, Time: 5000, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_ExpeditionFleetLossReduction_2, Name: "Neuro-Interface", BaseCost: new ResourcesCost({ Metal: 70000, Crystal: 40000, Deuterium: 20000, ResourcesFactor: 1.5, Time: 5500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_PhalanxRangeBooster, Name: "Interplanetary Analysis Network", BaseCost: new ResourcesCost({ Metal: 80000, Crystal: 50000, Deuterium: 20000, ResourcesFactor: 1.2, Time: 6000, TimeFactor: 1.2 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_BaseStatsBooster_2, Name: "Overclocking (Heavy Fighter)", BaseCost: new ResourcesCost({ Metal: 320000, Crystal: 240000, Deuterium: 100000, ResourcesFactor: 1.5, Time: 6500, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_ExpeditionSpeedBooster, Name: "Telekinetic Drive", BaseCost: new ResourcesCost({ Metal: 85000, Crystal: 40000, Deuterium: 35000, ResourcesFactor: 1.2, Time: 7000, TimeFactor: 1.2 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_ExpeditionBooster_2, Name: "Sixth Sense", BaseCost: new ResourcesCost({ Metal: 120000, Crystal: 30000, Deuterium: 25000, ResourcesFactor: 1.5, Time: 7500, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_ProductionBooster_2, Name: "Psychoharmoniser", BaseCost: new ResourcesCost({ Metal: 100000, Crystal: 40000, Deuterium: 30000, ResourcesFactor: 1.5, Time: 8000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_ResearchSpeed, Name: "Efficient Swarm Intelligence", BaseCost: new ResourcesCost({ Metal: 200000, Crystal: 100000, Deuterium: 100000, ResourcesFactor: 1.5, Time: 8500, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_BaseStatsBooster_3, Name: "Overclocking (Large Cargo)", BaseCost: new ResourcesCost({ Metal: 160000, Crystal: 120000, Deuterium: 50000, ResourcesFactor: 1.5, Time: 9000, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_ExpeditionDMIncrease, Name: "Gravitation Sensors", BaseCost: new ResourcesCost({ Metal: 240000, Crystal: 120000, Deuterium: 120000, ResourcesFactor: 1.5, Time: 9500, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_BaseStatsBooster_4, Name: "Overclocking (Battleship)", BaseCost: new ResourcesCost({ Metal: 320000, Crystal: 240000, Deuterium: 100000, ResourcesFactor: 1.5, Time: 10000, TimeFactor: 1.4 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_CostReduction, Name: "Psionic Shield Matrix", BaseCost: new ResourcesCost({ Metal: 500000, Crystal: 300000, Deuterium: 200000, ResourcesFactor: 1.5, Time: 13000, TimeFactor: 1.3 }) }),
  new Tech({ Type: TechType.LifeformResearch, LifeformType: LifeformType.Kaelesh, Id: LifeformResearchType.Kaelesh_CharacterClassBooster, Name: "Kaelesh Discoverer Enhancement", BaseCost: new ResourcesCost({ Metal: 300000, Crystal: 180000, Deuterium: 120000, ResourcesFactor: 1.7, Time: 11000, TimeFactor: 1.4 }) }),

  /* SHIPS */

  // Ships
  new Tech({ Type: TechType.Ship, Id: ShipType.SmallCargoShip, Name: "Small Cargo Ship", BaseCost: new ResourcesCost({ Metal: 2000, Crystal: 2000, Deuterium: 0 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.LargeCargoShip, Name: "Large Cargo Ship", BaseCost: new ResourcesCost({ Metal: 6000, Crystal: 6000, Deuterium: 0 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.LightFighter, Name: "Light Fighter", BaseCost: new ResourcesCost({ Metal: 3000, Crystal: 1000, Deuterium: 0 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.HeavyFighter, Name: "Heavy Fighter", BaseCost: new ResourcesCost({ Metal: 6000, Crystal: 4000, Deuterium: 0 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.Cruiser, Name: "Cruiser", BaseCost: new ResourcesCost({ Metal: 20000, Crystal: 7000, Deuterium: 2000 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.Battleship, Name: "Battleship", BaseCost: new ResourcesCost({ Metal: 45000, Crystal: 15000, Deuterium: 0 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.ColonyShip, Name: "Colony Ship", BaseCost: new ResourcesCost({ Metal: 10000, Crystal: 20000, Deuterium: 10000 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.Recycler, Name: "Recycler", BaseCost: new ResourcesCost({ Metal: 10000, Crystal: 6000, Deuterium: 2000 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.EspionageProbe, Name: "Espionage Probe", BaseCost: new ResourcesCost({ Metal: 0, Crystal: 1000, Deuterium: 0 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.Bomber, Name: "Bomber", BaseCost: new ResourcesCost({ Metal: 50000, Crystal: 25000, Deuterium: 15000 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.SolarSatellite, Name: "Solar Satellite", BaseCost: new ResourcesCost({ Metal: 0, Crystal: 2000, Deuterium: 500 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.Destroyer, Name: "Destroyer", BaseCost: new ResourcesCost({ Metal: 60000, Crystal: 50000, Deuterium: 15000 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.DeathStar, Name: "Death Star", BaseCost: new ResourcesCost({ Metal: 5000000, Crystal: 4000000, Deuterium: 1000000 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.Battlecruiser, Name: "Battlecruiser", BaseCost: new ResourcesCost({ Metal: 30000, Crystal: 40000, Deuterium: 15000 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.Crawler, Name: "Crawler", BaseCost: new ResourcesCost({ Metal: 2000, Crystal: 2000, Deuterium: 1000 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.Reaper, Name: "Reaper", BaseCost: new ResourcesCost({ Metal: 85000, Crystal: 55000, Deuterium: 20000 }) }),
  new Tech({ Type: TechType.Ship, Id: ShipType.Pathfinder, Name: "Pathfinder", BaseCost: new ResourcesCost({ Metal: 8000, Crystal: 15000, Deuterium: 8000 }) }),

  /* DEFENSE */
  new Tech({ Type: TechType.Defense, Id: DefenceType.RocketLauncher, Name: "Rocket Launcher", BaseCost: new ResourcesCost({ Metal: 2000, Crystal: 0, Deuterium: 0 }) }),
  new Tech({ Type: TechType.Defense, Id: DefenceType.LightLaser, Name: "Light Laser", BaseCost: new ResourcesCost({ Metal: 1500, Crystal: 500, Deuterium: 0 }) }),
  new Tech({ Type: TechType.Defense, Id: DefenceType.HeavyLaser, Name: "Heavy Laser", BaseCost: new ResourcesCost({ Metal: 6000, Crystal: 2000, Deuterium: 0 }) }),
  new Tech({ Type: TechType.Defense, Id: DefenceType.GaussCannon, Name: "Gauss Cannon", BaseCost: new ResourcesCost({ Metal: 20000, Crystal: 15000, Deuterium: 2000 }) }),
  new Tech({ Type: TechType.Defense, Id: DefenceType.IonCannon, Name: "Ion Cannon", BaseCost: new ResourcesCost({ Metal: 5000, Crystal: 3000, Deuterium: 0 }) }),
  new Tech({ Type: TechType.Defense, Id: DefenceType.PlasmaTurret, Name: "Plasma Turret", BaseCost: new ResourcesCost({ Metal: 50000, Crystal: 50000, Deuterium: 30000 }) }),
  new Tech({ Type: TechType.Defense, Id: DefenceType.SmallShieldDome, Name: "Small Shield Dome", BaseCost: new ResourcesCost({ Metal: 10000, Crystal: 10000, Deuterium: 0 }) }),
  new Tech({ Type: TechType.Defense, Id: DefenceType.LargeShieldDome, Name: "Large Shield Dome", BaseCost: new ResourcesCost({ Metal: 50000, Crystal: 50000, Deuterium: 0 }) }),
  new Tech({ Type: TechType.Defense, Id: DefenceType.AntiBallisticMissiles, Name: "Anti-Ballistic Missiles", BaseCost: new ResourcesCost({ Metal: 8000, Crystal: 2000, Deuterium: 0 }) }),
  new Tech({ Type: TechType.Defense, Id: DefenceType.InterplanetaryMissiles, Name: "Interplanetary Missiles", BaseCost: new ResourcesCost({ Metal: 12500, Crystal: 2500, Deuterium: 10000 }) }),


];