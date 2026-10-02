export class DefenseBonus {
  public Armor: number;
  public Shield: number;
  public Weapon: number;

  constructor(data: Partial<DefenseBonus> = {}) {
    this.Armor = data.Armor ?? 0;
    this.Shield = data.Shield ?? 0;
    this.Weapon = data.Weapon ?? 0;
  }
}