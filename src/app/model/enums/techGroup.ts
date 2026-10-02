import { BuildingType } from '../enums/techTypes';

export enum TechGroup {
  Supply = 'supply',
  Station = 'station',
  Research = 'research',
  LifeformBuildings = 'lifeformbuildings',
  LifeformResearch = 'lifeformresearch',
  Ships = 'ships',
  Defence = 'defence',
}

/**
 * Supply Buildings
 */
export const SuppliesBuildingTypes: BuildingType[] = [
  BuildingType.MetalMine,
  BuildingType.CrystalMine,
  BuildingType.DeuteriumSynthesizer,
  BuildingType.SolarPlant,
  BuildingType.FusionPlant,
  BuildingType.MetalStorage,
  BuildingType.CrystalStorage,
  BuildingType.DeuteriumStorage,
];

/**
 * Facilities Buildings
 */
export const StationBuildingTypes: BuildingType[] = [
  BuildingType.RoboticsFactory,
  BuildingType.Shipyard,
  BuildingType.ResearchLab,
  BuildingType.AllianceDepot,
  BuildingType.MissileSilo,
  BuildingType.NaniteFactory,
  BuildingType.Terraformer,
  BuildingType.RepairDock,

  BuildingType.MoonBase,
  BuildingType.SensorPhalanx,
  BuildingType.JumpGate,
];

