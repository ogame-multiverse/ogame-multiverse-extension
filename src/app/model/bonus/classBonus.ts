import { ClassBonusInfo } from "./classBonusInfo";
import { ExplorerClassBonus } from "./explorerClassBonus";
import { MinerClassBonus } from "./minerClassBonus";
import { WarriorClassBonus } from "./warriorClassBonus";

export class ClassBonus {
  public MinerInfo: ClassBonusInfo;
  public WarriorInfo: ClassBonusInfo;
  public ExplorerInfo: ClassBonusInfo;

  public Miner: MinerClassBonus;
  public Warrior: WarriorClassBonus;
  public Explorer: ExplorerClassBonus;

  constructor(data: Partial<ClassBonus> = {}) {
    this.MinerInfo = data.MinerInfo ?? new ClassBonusInfo();
    this.WarriorInfo = data.WarriorInfo ?? new ClassBonusInfo();
    this.ExplorerInfo = data.ExplorerInfo ?? new ClassBonusInfo();

    this.Miner = data.Miner ?? new MinerClassBonus();
    this.Warrior = data.Warrior ?? new WarriorClassBonus();
    this.Explorer = data.Explorer ?? new ExplorerClassBonus();
  }
}