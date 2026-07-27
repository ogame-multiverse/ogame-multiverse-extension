import { ImperialProperty } from './imperialProperty';
import { LifeformBuildingType, LifeformResearchType } from './enums/techTypes';
import { PositionType } from './enums/positionType';
import { LifeformType } from './enums/lifeformType';

// Planet owns lifeform-related maps
export class Planet extends ImperialProperty {
  public LifeformType?: LifeformType;
  public Population?: number;
  public MoonId?: number;
  public LifeformBuildings: Record<LifeformBuildingType, number>;
  public LifeformResearch: Record<LifeformResearchType, number>;
  public AvailableEnergy?: number;

  constructor(data: Partial<Planet>) {
    super(PositionType.Planet, { ...data, PlanetId: data.Id });
    this.MoonId = data.MoonId;
    this.LifeformType = data.LifeformType;
    this.LifeformBuildings = (data.LifeformBuildings as Record<LifeformBuildingType, number>) || ({} as Record<LifeformBuildingType, number>);
    this.LifeformResearch = (data.LifeformResearch as Record<LifeformResearchType, number>) || ({} as Record<LifeformResearchType, number>);
    this.AvailableEnergy = data.AvailableEnergy;
  }
}
