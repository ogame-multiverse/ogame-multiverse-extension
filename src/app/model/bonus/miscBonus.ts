import { CrawlerBonus } from "./crawlerBonus";

export class MiscBonus {
  public DiscoveryBonus: number;
  public BuggyBonus: CrawlerBonus;
  public FuelPayback: number;
  public PhalanxRangeBoost: number;

  constructor(data: Partial<MiscBonus> = {}) {
    this.DiscoveryBonus = data.DiscoveryBonus ?? 0;
    this.BuggyBonus = data.BuggyBonus ?? new CrawlerBonus({});
    this.FuelPayback = data.FuelPayback ?? 0;
    this.PhalanxRangeBoost = data.PhalanxRangeBoost ?? 0;
  }
}