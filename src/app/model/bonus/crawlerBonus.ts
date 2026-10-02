export class CrawlerBonus {
  public Production: number | 0;
  public Consumption: number | 0;
  constructor(data: Partial<CrawlerBonus>) {
    this.Production = data.Production ?? 0;
    this.Consumption = data.Consumption ?? 0;
  }
}

