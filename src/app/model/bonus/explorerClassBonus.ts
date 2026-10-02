export class ExplorerClassBonus {
  public research: string | number;
  public expedition: string | number;
  public colonization: string | number;
  public expeditionSlots: number;
  public enemyReduction: string | number;
  public phalanxRange: string | number;
  public plunderInactive: string | number;

  constructor(data: Partial<ExplorerClassBonus> = {}) {
    this.research = data.research ?? 0;
    this.expedition = data.expedition ?? 0;
    this.colonization = data.colonization ?? 0;
    this.expeditionSlots = data.expeditionSlots ?? 0;
    this.enemyReduction = data.enemyReduction ?? 0;
    this.phalanxRange = data.phalanxRange ?? 0;
    this.plunderInactive = data.plunderInactive ?? 0;
  }
}