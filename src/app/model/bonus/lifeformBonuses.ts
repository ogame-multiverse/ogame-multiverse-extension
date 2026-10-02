import { ClassBonus } from "./classBonus";
import { DefenseBonus } from "./defenseBonus";
import { ExpeditionBonus } from "./expeditionBonus";
import { MiscBonus } from "./miscBonus";
import { ProductionBonus } from "./productionBonus";
import { ShipBonus } from "./shipBonus";
import { SpeciesInfo } from "./speciesInfo";
import { TechnologyBonus } from "./technologyBonus";

export class LifeformBonuses {
  public species: Record<number, SpeciesInfo>;
  public productionBonus: ProductionBonus;
  public expeditionBonus: ExpeditionBonus;
  public technologyCostReduction: TechnologyBonus;
  public technologyTimeReduction: TechnologyBonus;
  public shipsBonus: Record<number, ShipBonus>;
  public defensesBonus: Record<number, DefenseBonus>;
  public classBonus: ClassBonus;
  public miscBonus: MiscBonus;

  constructor(data: Partial<LifeformBonuses> = {}) {
    this.species = data.species ?? {};
    this.productionBonus = data.productionBonus ?? new ProductionBonus({});
    this.expeditionBonus = data.expeditionBonus ?? new ExpeditionBonus({});
    this.technologyCostReduction = data.technologyCostReduction ?? new TechnologyBonus({});
    this.technologyTimeReduction = data.technologyTimeReduction ?? new TechnologyBonus({});
    this.shipsBonus = data.shipsBonus ?? {};
    this.defensesBonus = data.defensesBonus ?? {};
    this.classBonus = data.classBonus ?? new ClassBonus({});
    this.miscBonus = data.miscBonus ?? new MiscBonus({});
  }
}