export class ResourcesCost {
  // Base costs
  public Metal: number | 0;
  public Crystal: number | 0;
  public Deuterium: number | 0;
  public ResourcesFactor: number = 1;

  // Required energy and population
  public Energy: number | 0;
  public EnergyFactor: number = 1;
  public Population: number | 0;
  public PopulationFactor: number = 1;

  // Consumption
  public EnergyConsumption: number = 0;
  public EnergyConsumptionFactor: number = 1;
  public DeuteriumConsumption: number = 0;
  public DeuteriumConsumptionFactor: number = 1;

  // Build time
  public Time: number | 0;
  public TimeFactor: number = 1;

  constructor(data: Partial<ResourcesCost>) {
    this.Metal = data.Metal ?? 0;
    this.Crystal = data.Crystal ?? 0;
    this.Deuterium = data.Deuterium ?? 0;
    this.Energy = data.Energy ?? 0;
    this.ResourcesFactor = data.ResourcesFactor ?? 1;
    this.EnergyFactor = data.EnergyFactor ?? 1;
    this.Population = data.Population ?? 0;
    this.PopulationFactor = data.PopulationFactor ?? 1;
    this.Time = data.Time ?? 0;
    this.TimeFactor = data.TimeFactor ?? 1;
    this.EnergyConsumption = data.EnergyConsumption ?? 0;
    this.EnergyConsumptionFactor = data.EnergyConsumptionFactor ?? 1;
  }
}