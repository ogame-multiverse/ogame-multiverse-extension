export class MinerClassBonus {
  public resourceProduction: string | number;
  public energyProduction: string | number;
  public crawlerBonus: string | number;
  public transporterSpeed: string | number;
  public transporterCargo: string | number;
  public maxCrawlerBonus: string | number;

  constructor(data: Partial<MinerClassBonus> = {}) {
    this.resourceProduction = data.resourceProduction ?? 0;
    this.energyProduction = data.energyProduction ?? 0;
    this.crawlerBonus = data.crawlerBonus ?? 0;
    this.transporterSpeed = data.transporterSpeed ?? 0;
    this.transporterCargo = data.transporterCargo ?? 0;
    this.maxCrawlerBonus = data.maxCrawlerBonus ?? 0;
  }
}