export class ProductionBonus {
  public Metal: number;
  public Crystal: number;
  public Deuterium: number;
  public Energy: number;
  public Population: number;
  public Food: number;
  public Storage: number;

  constructor(data: Partial<ProductionBonus> = {}) {
    this.Metal = data.Metal ?? 0;
    this.Crystal = data.Crystal ?? 0;
    this.Deuterium = data.Deuterium ?? 0;
    this.Energy = data.Energy ?? 0;
    this.Population = data.Population ?? 0;
    this.Food = data.Food ?? 0;
    this.Storage = data.Storage ?? 0;
  }
}